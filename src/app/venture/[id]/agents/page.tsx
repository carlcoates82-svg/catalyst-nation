import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  money,
  type Agent,
  type Goal,
  type AgentTask,
  type ActivityLogEntry,
} from "@/lib/domain";
import {
  createAgentAction,
  deleteAgentAction,
  createGoalAction,
  createTaskAction,
  runTaskAction,
  runGoalAction,
  planGoalTasksAction,
  resetTaskAction,
  pushValidationFromTaskAction,
} from "@/lib/actions";
import { inputClass, submitClass } from "@/lib/ui";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

// Bumped from 60s — a broad research task with several web searches can
// take longer, and a killed function left a task permanently stuck in
// "running" with no recovery UI (see resetTaskAction below for the fix to
// that specific failure mode; this just makes it less likely to trigger).
export const maxDuration = 300;

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const ventureId = Number(id);
  const supabase = await createClient();

  const { data: venture } = await supabase
    .from("ventures")
    .select("id, name")
    .eq("id", ventureId)
    .single();
  if (!venture) notFound();

  const [{ data: agents }, { data: goals }, { data: tasksRaw }, { data: activity }] =
    await Promise.all([
      supabase.from("agents").select("*").eq("venture_id", ventureId).order("id"),
      supabase.from("goals").select("*").eq("venture_id", ventureId).order("id"),
      supabase
        .from("tasks")
        .select("*")
        .eq("venture_id", ventureId)
        .order("id", { ascending: false }),
      supabase
        .from("activity_log")
        .select("*")
        .eq("venture_id", ventureId)
        .order("id", { ascending: false })
        .limit(10),
    ]);

  const agentList = (agents ?? []) as Agent[];
  const goalList = (goals ?? []) as Goal[];
  const taskList = (tasksRaw ?? []) as AgentTask[];
  const activityList = (activity ?? []) as ActivityLogEntry[];

  const agentById = new Map(agentList.map((a) => [a.id, a]));
  const goalById = new Map(goalList.map((g) => [g.id, g]));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="mb-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image src="/brand/mark-catalyst.svg" alt="" width={28} height={28} />
          <span className="text-sm font-medium tracking-wide text-ash">CATALYST NATION</span>
        </div>
        <Link href="/account" className="text-xs text-ash hover:text-off-white">
          Account
        </Link>
      </div>

      <div className="mb-1 flex items-center gap-3">
        <Link href={`/venture/${ventureId}`} className="text-xs text-ash hover:text-off-white">
          ← {venture.name}
        </Link>
      </div>
      <h1 className="mb-8 text-2xl font-semibold text-off-white">Agents</h1>

      <Section title="Agents">
        {agentList.length ? (
          <ul className="mb-4 space-y-2">
            {agentList.map((a) => {
              const over = a.budget_allocated > 0 && a.budget_spent > a.budget_allocated;
              return (
                <li
                  key={a.id}
                  className="rounded-md border border-slate bg-charcoal px-4 py-3 text-sm text-off-white"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.name}</span>
                    <div className="flex items-center gap-3">
                      <span className={over ? "text-bronze" : "text-ash"}>
                        {money(a.budget_spent, a.currency)} / {money(a.budget_allocated, a.currency)}
                        {over ? " · over budget" : ""}
                      </span>
                      <form action={deleteAgentAction}>
                        <input type="hidden" name="venture_id" value={ventureId} />
                        <input type="hidden" name="agent_id" value={a.id} />
                        <ConfirmSubmitButton
                          label="Delete"
                          confirmLabel="Confirm delete?"
                          className="text-xs text-ash hover:text-bronze"
                        />
                      </form>
                    </div>
                  </div>
                  {a.role && <p className="mt-1 text-xs text-ash">{a.role}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty text="No agents yet." />
        )}
        <form action={createAgentAction} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="venture_id" value={ventureId} />
          <input name="name" required placeholder="Agent name" className={inputClass} />
          <input name="role" placeholder="Role (optional)" className={inputClass} />
          <textarea
            name="system_prompt"
            required
            rows={3}
            placeholder="System prompt — defines how this agent behaves and what it's for"
            className={`${inputClass} col-span-2`}
          />
          <input
            name="budget_allocated"
            type="number"
            min="0"
            step="1"
            placeholder="Budget allocated (optional)"
            className={inputClass}
          />
          <button type="submit" className={submitClass}>
            Create agent
          </button>
        </form>
      </Section>

      <Section title="Goals">
        {goalList.length ? (
          <ul className="mb-4 space-y-2">
            {goalList.map((g) => {
              const queued = taskList.filter(
                (t) => t.goal_id === g.id && t.status === "todo"
              ).length;
              return (
                <li
                  key={g.id}
                  className="rounded-md border border-slate bg-charcoal px-4 py-3 text-sm text-off-white"
                >
                  <span className="font-medium">{g.title}</span>{" "}
                  <span className="text-xs uppercase tracking-wide text-ash">{g.status}</span>
                  {g.description && <p className="mt-1 text-xs text-ash">{g.description}</p>}
                  {g.status === "open" && agentList.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      <form action={planGoalTasksAction}>
                        <input type="hidden" name="venture_id" value={ventureId} />
                        <input type="hidden" name="goal_id" value={g.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-slate px-4 py-2 text-sm text-off-white hover:bg-slate"
                        >
                          Plan tasks
                        </button>
                      </form>
                      {queued > 0 && (
                        <form action={runGoalAction}>
                          <input type="hidden" name="venture_id" value={ventureId} />
                          <input type="hidden" name="goal_id" value={g.id} />
                          <button type="submit" className={submitClass}>
                            Run all queued ({queued})
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty text="No goals yet." />
        )}
        <form action={createGoalAction} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="venture_id" value={ventureId} />
          <input name="title" required placeholder="Goal title" className={inputClass} />
          <input name="description" placeholder="Description (optional)" className={inputClass} />
          <button type="submit" className={`${submitClass} col-span-2`}>
            Create goal
          </button>
        </form>
      </Section>

      <Section title="Tasks">
        {taskList.length ? (
          <ul className="mb-4 space-y-3">
            {taskList.map((t) => {
              const agent = agentById.get(t.agent_id);
              const goal = goalById.get(t.goal_id);
              return (
                <li
                  key={t.id}
                  className="rounded-md border border-slate bg-charcoal px-4 py-3 text-sm text-off-white"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-xs uppercase tracking-wide text-ash">{t.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-ash">
                    {goal ? `Goal: ${goal.title}` : ""} {agent ? `· Agent: ${agent.name}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-ash">{t.instructions}</p>
                  {t.result && (
                    <p className="mt-2 whitespace-pre-wrap rounded-md bg-graphite p-3 text-sm text-off-white">
                      {t.result}
                    </p>
                  )}
                  {t.sources && t.sources.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs uppercase tracking-wide text-ash">Sources</p>
                      <ul className="mt-1 space-y-1">
                        {t.sources.map((s, i) => (
                          <li key={i} className="truncate text-xs">
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald hover:underline"
                            >
                              {s.title || s.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    {t.status !== "running" && (
                      <form action={runTaskAction}>
                        <input type="hidden" name="venture_id" value={ventureId} />
                        <input type="hidden" name="task_id" value={t.id} />
                        <button type="submit" className={submitClass}>
                          {t.status === "done" ? "Run again" : "Run"}
                        </button>
                      </form>
                    )}
                    {t.status === "running" && (
                      <form action={resetTaskAction}>
                        <input type="hidden" name="venture_id" value={ventureId} />
                        <input type="hidden" name="task_id" value={t.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-bronze px-4 py-2 text-sm text-bronze hover:bg-bronze/10"
                        >
                          Stuck? Reset
                        </button>
                      </form>
                    )}
                    {t.status === "done" && t.result && (
                      <form action={pushValidationFromTaskAction}>
                        <input type="hidden" name="venture_id" value={ventureId} />
                        <input type="hidden" name="task_id" value={t.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-slate px-4 py-2 text-sm text-off-white hover:bg-slate"
                        >
                          Save as validation evidence
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty text="No tasks yet." />
        )}
        {agentList.length && goalList.length ? (
          <form action={createTaskAction} className="grid grid-cols-2 gap-2">
            <input type="hidden" name="venture_id" value={ventureId} />
            <select name="goal_id" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Choose a goal
              </option>
              {goalList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
            <select name="agent_id" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Choose an agent
              </option>
              {agentList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input name="title" required placeholder="Task title" className={`${inputClass} col-span-2`} />
            <textarea
              name="instructions"
              required
              rows={3}
              placeholder="Instructions for the agent"
              className={`${inputClass} col-span-2`}
            />
            <button type="submit" className={`${submitClass} col-span-2`}>
              Create task
            </button>
          </form>
        ) : (
          <p className="text-sm text-ash">Create an agent and a goal before adding tasks.</p>
        )}
      </Section>

      <Section title="Activity log">
        {activityList.length ? (
          <ul className="space-y-2">
            {activityList.map((e) => {
              const agent = agentById.get(e.agent_id);
              return (
                <li key={e.id} className="text-sm text-off-white">
                  <span className="text-ash">{e.created_at.slice(0, 10)}</span>{" "}
                  {agent ? agent.name : "Agent"} —{" "}
                  <span className="font-medium">{e.event_type}</span>
                  {e.event_type === "task_completed" ? (
                    <span className="text-ash">
                      {" "}
                      ({e.input_tokens}+{e.output_tokens} tokens, ~
                      {money(e.estimated_cost ?? 0, "EUR")}
                      {e.detail ? `, ${e.detail}` : ""})
                    </span>
                  ) : (
                    <span className="text-bronze"> — {e.detail}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty text="No activity yet." />
        )}
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ash">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mb-4 text-sm text-ash">{text}</p>;
}
