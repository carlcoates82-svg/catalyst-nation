"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
