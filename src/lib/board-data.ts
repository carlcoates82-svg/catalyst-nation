import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Venture, Budget, Kpi, Risk, Gate, Validation, Agent } from "@/lib/domain";

export interface BoardPackData {
  venture: Venture;
  budgets: Budget[];
  kpis: Kpi[];
  risks: Risk[];
  gates: Gate[];
  validation: Validation[];
  agents: Agent[];
}

/** Shared by the board pack web page and its PDF route — same data, two renderers. */
export async function getBoardPackData(ventureId: number): Promise<BoardPackData> {
  const supabase = await createClient();

  const { data: venture } = await supabase
    .from("ventures")
    .select("*")
    .eq("id", ventureId)
    .single();
  if (!venture) notFound();

  const [
    { data: budgets },
    { data: kpis },
    { data: risks },
    { data: gates },
    { data: validation },
    { data: agents },
  ] = await Promise.all([
    supabase.from("budgets").select("*").eq("venture_id", ventureId).order("phase"),
    supabase
      .from("kpis")
      .select("*")
      .eq("venture_id", ventureId)
      .order("as_of", { ascending: false })
      .order("id", { ascending: false })
      .limit(6),
    supabase.from("risks").select("*").eq("venture_id", ventureId).eq("status", "open"),
    supabase
      .from("gates")
      .select("*")
      .eq("venture_id", ventureId)
      .order("id", { ascending: false })
      .limit(10),
    supabase
      .from("validation")
      .select("*")
      .eq("venture_id", ventureId)
      .order("id", { ascending: false })
      .limit(10),
    supabase.from("agents").select("*").eq("venture_id", ventureId),
  ]);

  return {
    venture: venture as Venture,
    budgets: (budgets ?? []) as Budget[],
    kpis: (kpis ?? []) as Kpi[],
    risks: (risks ?? []) as Risk[],
    gates: (gates ?? []) as Gate[],
    validation: (validation ?? []) as Validation[],
    agents: (agents ?? []) as Agent[],
  };
}
