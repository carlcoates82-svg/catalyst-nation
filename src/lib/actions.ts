"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextStage, type Stage, type VentureStatus } from "@/lib/domain";

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
    }
  }

  revalidatePath(`/venture/${venture_id}`);
}

/** Mirrors Catalyst OS's recordSpend: auto-creates a zero-allocation budget
 * row for the phase if one doesn't exist yet, then adds to spent. */
export async function recordSpendAction(formData: FormData) {
  const venture_id = requireVentureId(formData);
  const phase = String(formData.get("phase") ?? "other");
  const amount = Number(formData.get("amount"));
  if (!(amount > 0)) throw new Error("Amount must be positive");

  const supabase = await createClient();
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
