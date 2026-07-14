"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextStage, type Stage, type VentureStatus } from "@/lib/domain";
import {
  createAnthropicClient,
  estimateCost,
  AGENT_MODEL,
  MAX_WEB_SEARCHES_PER_TASK,
} from "@/lib/anthropic";

/** Server actions are callable directly, not just from the forms that
 * render them — so admin-only actions must re-check here, not just hide
 * the form in the UI. */
async function requireStudioAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_studio_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_studio_admin) throw new Error("Not authorized");

  return supabase;
}

function requireVentureId(formData: FormData): number {
  const id = Number(formData.get("venture_id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid venture id");
  return id;
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function recordKpiAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const supabase = await createClient();

  const { error } = await supabase.from("kpis").insert({
    venture_id,
    as_of: new Date().toISOString().slice(0, 10),
    arr: numberOrNull(formData.get("arr")),
    customers: numberOrNull(formData.get("customers")),
    pipeline: numberOrNull(formData.get("pipeline")),
    note: (formData.get("note") as string) || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/venture/${venture_id}`);
}

export async function recordValidationAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const note = String(formData.get("note") ?? "").trim();
  if (!note) throw new Error("Note is required");

  const supabase = await createClient();
  const { error } = await supabase.from("validation").insert({
    venture_id,
    kind: String(formData.get("kind") ?? "other"),
    note,
    willingness_to_pay: numberOrNull(formData.get("willingness_to_pay")),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/venture/${venture_id}`);
}

export async function addRiskAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Description is required");

  const supabase = await createClient();
  const { error } = await supabase.from("risks").insert({
    venture_id,
    description,
    severity: String(formData.get("severity") ?? "medium"),
    likelihood: String(formData.get("likelihood") ?? "medium"),
    status: "open",
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/venture/${venture_id}`);
}

export async function createVentureAction(formData: FormData) {
  const supabase = await requireStudioAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const { error } = await supabase.from("ventures").insert({
    name,
    sector: (formData.get("sector") as string) || null,
    thesis: (formData.get("thesis") as string) || null,
    buyer: (formData.get("buyer") as string) || null,
    founder_ceo: (formData.get("founder_ceo") as string) || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

/** Links a CEO/business owner to a venture, creating their login if they
 * don't already have one. Reuses an existing account (by email) if they're
 * already a member of another venture. */
export async function inviteCeoAction(formData: FormData) {
  const supabase = await requireStudioAdmin();
  const venture_id = requireVentureId(formData);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email) throw new Error("Email is required");

  const { data: existingProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  let userId = existingProfile?.id as string | undefined;

  if (!userId) {
    if (!password) throw new Error("Password is required for a new account");
    const admin = createAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    userId = created.user.id;
  }

  const { error: linkError } = await supabase
    .from("venture_members")
    .upsert({ venture_id, user_id: userId, role: "ceo" }, { onConflict: "venture_id,user_id" });
  if (linkError) throw new Error(linkError.message);

  revalidatePath(`/venture/${venture_id}`);
}

/** Grants studio-admin (full portfolio) access, creating the account first
 * if this email doesn't have one yet. Uses the admin client throughout —
 * there's no RLS UPDATE policy on profiles (deliberately, so a regular
 * session can never self-grant admin), so this bypasses RLS the same way
 * account creation already does. */
export async function inviteAdminAction(formData: FormData) {
  await requireStudioAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email) throw new Error("Email is required");

  const admin = createAdminClient();

  const { data: existingProfile, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  let userId = existingProfile?.id as string | undefined;

  if (!userId) {
    if (!password) throw new Error("Password is required for a new account");
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    userId = created.user.id;
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ is_studio_admin: true })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/dashboard");
}

/** Mirrors Catalyst OS's advance_stage: proceed moves one step along the
 * Protocol (reaching Scale marks the venture launched), kill marks it
 * killed, hold just logs the gate with no venture change. Admin-only. */
export async function advanceStageAction(formData: FormData) {
  const supabase = await requireStudioAdmin();
  const venture_id = requireVentureId(formData);
  const decision = String(formData.get("decision") ?? "");
  if (!["proceed", "hold", "kill"].includes(decision)) {
    throw new Error("Invalid decision");
  }
  const rationale = (formData.get("rationale") as string) || null;

  const { data: venture, error: fetchError } = await supabase
    .from("ventures")
    .select("stage, status")
    .eq("id", venture_id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { error: gateError } = await supabase.from("gates").insert({
    venture_id,
    stage: venture.stage,
    decision,
    rationale,
  });
  if (gateError) throw new Error(gateError.message);

  if (decision === "kill") {
    const { error } = await supabase
      .from("ventures")
      .update({ status: "killed" satisfies VentureStatus })
      .eq("id", venture_id);
    if (error) throw new Error(error.message);
  } else if (decision === "proceed") {
    const next = nextStage(venture.stage as Stage);
    if (next) {
      const status: VentureStatus = next === "Scale" ? "launched" : venture.status;
      const { error } = await supabase
        .from("ventures")
        .update({ stage: next, status })
        .eq("id", venture_id);
      if (error) throw new Error(error.message);

      // Catalyst OS → Paperclip handoff: the gate decision becomes the
      // mission the venture's agent team works towards. Skipped if an
      // open goal for this stage already exists (e.g. gate re-recorded).
      const title = `Reach ${next}`;
      const { data: existingGoal } = await supabase
        .from("goals")
        .select("id")
        .eq("venture_id", venture_id)
        .eq("title", title)
        .eq("status", "open")
        .maybeSingle();
      if (!existingGoal) {
        const { error: goalError } = await supabase.from("goals").insert({
          venture_id,
          title,
          description: rationale
            ? `Auto-created from the ${venture.stage} gate: ${rationale}`
            : `Auto-created from the ${venture.stage} gate decision.`,
        });
        if (goalError) throw new Error(goalError.message);
      }
    }
  }

  revalidatePath(`/venture/${venture_id}`);
  revalidatePath(`/venture/${venture_id}/agents`);
}

/** Mirrors Catalyst OS's recordSpend: auto-creates a zero-allocation budget
 * row for the phase if one doesn't exist yet, then adds to spent. */
async function addSpendToVentureBudget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venture_id: number,
  phase: string,
  amount: number
) {
  const { data: existing, error: fetchError } = await supabase
    .from("budgets")
    .select("id, spent")
    .eq("venture_id", venture_id)
    .eq("phase", phase)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  if (!existing) {
    const { error } = await supabase
      .from("budgets")
      .insert({ venture_id, phase, allocated: 0, spent: amount, currency: "EUR" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("budgets")
      .update({ spent: existing.spent + amount })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  }
}

export async function recordSpendAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const phase = String(formData.get("phase") ?? "other");
  const amount = Number(formData.get("amount"));
  if (!(amount > 0)) throw new Error("Amount must be positive");

  const supabase = await createClient();
  await addSpendToVentureBudget(supabase, venture_id, phase, amount);

  revalidatePath(`/venture/${venture_id}`);
}

export async function changePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  if (password !== confirm) throw new Error("Passwords do not match");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---- Paperclip: agents, goals, tasks ---------------------------------

export async function createAgentAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const name = String(formData.get("name") ?? "").trim();
  const system_prompt = String(formData.get("system_prompt") ?? "").trim();
  if (!name) throw new Error("Name is required");
  if (!system_prompt) throw new Error("System prompt is required");

  const supabase = await createClient();
  const { error } = await supabase.from("agents").insert({
    venture_id,
    name,
    role: (formData.get("role") as string) || null,
    system_prompt,
    budget_allocated: numberOrNull(formData.get("budget_allocated")) ?? 0,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/venture/${venture_id}/agents`);
}

/** Cascades to the agent's tasks and activity_log via the FK constraints
 * in 0004_paperclip.sql — deleting an agent removes its full history. */
export async function deleteAgentAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const agent_id = Number(formData.get("agent_id"));
  if (!agent_id) throw new Error("Invalid agent id");

  const supabase = await createClient();
  const { error } = await supabase.from("agents").delete().eq("id", agent_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/venture/${venture_id}/agents`);
}

export async function createGoalAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");

  const supabase = await createClient();
  const { error } = await supabase.from("goals").insert({
    venture_id,
    title,
    description: (formData.get("description") as string) || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/venture/${venture_id}/agents`);
}

export async function createTaskAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const goal_id = Number(formData.get("goal_id"));
  const agent_id = Number(formData.get("agent_id"));
  const title = String(formData.get("title") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  if (!goal_id || !agent_id) throw new Error("Goal and agent are required");
  if (!title || !instructions) throw new Error("Title and instructions are required");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    venture_id,
    goal_id,
    agent_id,
    title,
    instructions,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/venture/${venture_id}/agents`);
}

/** Runs one task through its agent via a single Claude completion, with
 * web search enabled. Updates task status, logs to activity_log, adds the
 * estimated cost to the agent's budget_spent and syncs it into the
 * venture's 'agents' budget burn. Returns whether the run succeeded plus
 * the result text so chained runs can pass context forward. Never throws
 * for a failed run — failure is recorded on the task instead. */
async function executeTaskRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venture_id: number,
  task: { id: number; instructions: string },
  agent: { id: number; system_prompt: string },
  priorContext?: string
): Promise<{ ok: boolean; resultText: string }> {
  await supabase.from("tasks").update({ status: "running" }).eq("id", task.id);

  const client = createAnthropicClient();
  try {
    const userMessage = priorContext
      ? `Context from earlier tasks completed in this run:\n\n${priorContext}\n\n---\n\nYour task: ${task.instructions}`
      : task.instructions;

    const response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system: agent.system_prompt,
      messages: [{ role: "user", content: userMessage }],
      tools: [
        {
          type: "web_search_20260318",
          name: "web_search",
          max_uses: MAX_WEB_SEARCHES_PER_TASK,
        },
      ],
    });

    const resultText = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .filter(Boolean)
      .join("\n");

    const sources = response.content
      .filter((block) => block.type === "web_search_tool_result")
      .flatMap((block) =>
        Array.isArray(block.content)
          ? block.content.map((r) => ({ title: r.title, url: r.url }))
          : []
      );

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const webSearches = response.usage.server_tool_use?.web_search_requests ?? 0;
    const cost = estimateCost(inputTokens, outputTokens, webSearches);

    await supabase
      .from("tasks")
      .update({
        status: "done",
        result: resultText,
        sources: sources.length ? sources : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    await supabase.from("activity_log").insert({
      venture_id,
      agent_id: agent.id,
      task_id: task.id,
      event_type: "task_completed",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost: cost,
      detail: webSearches ? `${webSearches} web search${webSearches === 1 ? "" : "es"}` : null,
    });

    // Re-read budget_spent rather than trusting a caller-supplied value —
    // in a chained run the same agent may have spent since we loaded it.
    const { data: freshAgent } = await supabase
      .from("agents")
      .select("budget_spent")
      .eq("id", agent.id)
      .single();
    await supabase
      .from("agents")
      .update({ budget_spent: (freshAgent?.budget_spent ?? 0) + cost })
      .eq("id", agent.id);

    // Paperclip → Catalyst OS sync: the run's cost also lands on the
    // venture's own budget burn (its 'agents' phase row), so the studio
    // record stays current without anyone re-keying spend.
    if (cost > 0) {
      await addSpendToVentureBudget(supabase, venture_id, "agents", cost);
    }

    return { ok: true, resultText };
  } catch (err) {
    await supabase.from("tasks").update({ status: "failed" }).eq("id", task.id);
    await supabase.from("activity_log").insert({
      venture_id,
      agent_id: agent.id,
      task_id: task.id,
      event_type: "task_failed",
      detail: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, resultText: "" };
  }
}

/** The core Paperclip action: runs one task via its agent on a Run click. */
export async function runTaskAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const task_id = Number(formData.get("task_id"));
  if (!task_id) throw new Error("Invalid task id");

  const supabase = await createClient();

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*, agents(*)")
    .eq("id", task_id)
    .single();
  if (taskError) throw new Error(taskError.message);
  const agent = task.agents as { id: number; system_prompt: string };

  await executeTaskRun(supabase, venture_id, task, agent);

  revalidatePath(`/venture/${venture_id}/agents`);
  revalidatePath(`/venture/${venture_id}`); // budget burn synced above
}

// How many queued tasks one "Run all" click will chain through. Keeps a
// whole chain inside the page's maxDuration and caps worst-case spend of
// a single click; run the button again to continue a longer queue.
const MAX_CHAIN_TASKS = 4;

/** Autonomous chain v1: runs every queued (todo) task under a goal in
 * sequence, feeding each completed task's result into the next task's
 * context so later tasks build on earlier ones. Stops at MAX_CHAIN_TASKS
 * or on the first failure. Still human-triggered — one click per chain. */
export async function runGoalAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const goal_id = Number(formData.get("goal_id"));
  if (!goal_id) throw new Error("Invalid goal id");

  const supabase = await createClient();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*, agents(*)")
    .eq("goal_id", goal_id)
    .eq("status", "todo")
    .order("id")
    .limit(MAX_CHAIN_TASKS);
  if (error) throw new Error(error.message);

  let context = "";
  for (const task of tasks ?? []) {
    const agent = task.agents as { id: number; name: string; system_prompt: string };
    const { ok, resultText } = await executeTaskRun(
      supabase,
      venture_id,
      task,
      agent,
      context || undefined
    );
    if (!ok) break; // a failed step invalidates what later steps would build on

    context += `${context ? "\n\n" : ""}[${task.title}]\n${resultText.slice(0, 2000)}`;
  }

  revalidatePath(`/venture/${venture_id}/agents`);
  revalidatePath(`/venture/${venture_id}`);
}

// Cap on how many tasks one "Plan tasks" click may create.
const MAX_PLANNED_TASKS = 4;

/** Autonomous chain v1, planning half: asks Claude to break a goal into
 * up to MAX_PLANNED_TASKS concrete tasks assigned to the venture's
 * existing agents, and queues them as todo. Nothing runs until a human
 * clicks Run — planning and execution stay separate, deliberately. */
export async function planGoalTasksAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const goal_id = Number(formData.get("goal_id"));
  if (!goal_id) throw new Error("Invalid goal id");

  const supabase = await createClient();
  const [{ data: goal, error: goalError }, { data: agents, error: agentsError }] =
    await Promise.all([
      supabase.from("goals").select("*").eq("id", goal_id).single(),
      supabase
        .from("agents")
        .select("id, name, role, system_prompt")
        .eq("venture_id", venture_id)
        .eq("status", "active"),
    ]);
  if (goalError) throw new Error(goalError.message);
  if (agentsError) throw new Error(agentsError.message);
  if (!agents?.length) throw new Error("Create an agent before planning tasks");

  const agentDescriptions = agents
    .map((a) => `- "${a.name}"${a.role ? ` (${a.role})` : ""}: ${a.system_prompt.slice(0, 200)}`)
    .join("\n");

  const client = createAnthropicClient();
  const response = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: 1024,
    system:
      "You are the task planner for a venture studio's AI agent team. " +
      "Break the given goal into concrete, independent research or analysis tasks, " +
      "each assigned to the best-suited agent from the list. " +
      `Respond with ONLY a JSON array of at most ${MAX_PLANNED_TASKS} objects, ` +
      'each shaped {"agent": "<exact agent name>", "title": "<short task title>", ' +
      '"instructions": "<specific instructions for the agent>"}. No other text.',
    messages: [
      {
        role: "user",
        content: `Goal: ${goal.title}${goal.description ? `\n${goal.description}` : ""}\n\nAvailable agents:\n${agentDescriptions}`,
      },
    ],
  });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Planner returned no task list");

  let planned: { agent?: string; title?: string; instructions?: string }[];
  try {
    planned = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Planner returned malformed JSON");
  }

  const agentByName = new Map(agents.map((a) => [a.name, a]));
  const rows = planned
    .filter((p) => p.title && p.instructions)
    .slice(0, MAX_PLANNED_TASKS)
    .map((p) => ({
      venture_id,
      goal_id,
      agent_id: (agentByName.get(p.agent ?? "") ?? agents[0]).id,
      title: p.title!,
      instructions: p.instructions!,
    }));
  if (!rows.length) throw new Error("Planner proposed no usable tasks");

  const { error: insertError } = await supabase.from("tasks").insert(rows);
  if (insertError) throw new Error(insertError.message);

  revalidatePath(`/venture/${venture_id}/agents`);
}

/** Recovery for a task orphaned in "running" — e.g. the serverless
 * function got killed mid-run (timeout, crash) before runTaskAction's own
 * try/catch could mark it done or failed. Only resets tasks that are
 * actually stuck in "running"; a no-op otherwise. */
export async function resetTaskAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const task_id = Number(formData.get("task_id"));
  if (!task_id) throw new Error("Invalid task id");

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "todo" })
    .eq("id", task_id)
    .eq("status", "running");
  if (error) throw new Error(error.message);

  revalidatePath(`/venture/${venture_id}/agents`);
}

/** The explicit "Paperclip → Catalyst OS" sync point: a human decides a
 * completed task's output is worth recording as validation evidence on
 * the venture record, rather than it happening automatically. */
export async function pushValidationFromTaskAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const task_id = Number(formData.get("task_id"));
  if (!task_id) throw new Error("Invalid task id");

  const supabase = await createClient();
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("title, result, agents(name)")
    .eq("id", task_id)
    .single();
  if (taskError) throw new Error(taskError.message);
  if (!task.result) throw new Error("Task has no result yet");

  const agentName = (task.agents as unknown as { name: string } | null)?.name ?? "Agent";
  const { error } = await supabase.from("validation").insert({
    venture_id,
    kind: "other",
    note: `[${agentName} — ${task.title}] ${task.result}`,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/venture/${venture_id}/agents`);
  revalidatePath(`/venture/${venture_id}`);
}
