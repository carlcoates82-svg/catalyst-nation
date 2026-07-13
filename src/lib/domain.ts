// Shared domain vocabulary — mirrors Catalyst OS (`Catalyst Nation-os-mcp/src/types.ts`).
// Keep in sync by hand for now; both sides read/write the same Supabase schema.

export const STAGES = [
  "Discover",
  "Validate",
  "Design",
  "Build",
  "Pilot",
  "Prove",
  "Launch",
  "Scale",
] as const;
export type Stage = (typeof STAGES)[number];

export const VENTURE_STATUSES = ["active", "paused", "killed", "launched"] as const;
export type VentureStatus = (typeof VENTURE_STATUSES)[number];

export const GATE_DECISIONS = ["proceed", "hold", "kill"] as const;
export type GateDecision = (typeof GATE_DECISIONS)[number];

export const BUDGET_PHASES = ["validation", "mvp", "pilot", "other"] as const;
export type BudgetPhase = (typeof BUDGET_PHASES)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_STATUSES = ["open", "mitigating", "closed"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const VALIDATION_KINDS = [
  "interview",
  "willingness-to-pay",
  "pilot-signal",
  "competitor",
  "other",
] as const;
export type ValidationKind = (typeof VALIDATION_KINDS)[number];

export interface Venture {
  id: number;
  name: string;
  sector: string | null;
  thesis: string | null;
  buyer: string | null;
  founder_ceo: string | null;
  stage: Stage;
  status: VentureStatus;
  created_at: string;
  updated_at: string;
}

export interface Gate {
  id: number;
  venture_id: number;
  stage: string;
  decision: string;
  rationale: string | null;
  created_at: string;
}

export interface Validation {
  id: number;
  venture_id: number;
  kind: string;
  note: string;
  willingness_to_pay: number | null;
  created_at: string;
}

export interface Budget {
  id: number;
  venture_id: number;
  phase: string;
  allocated: number;
  spent: number;
  currency: string;
}

export interface Kpi {
  id: number;
  venture_id: number;
  as_of: string;
  arr: number | null;
  customers: number | null;
  pipeline: number | null;
  note: string | null;
  created_at: string;
}

export interface Risk {
  id: number;
  venture_id: number | null;
  description: string;
  severity: string;
  likelihood: string;
  owner: string | null;
  mitigation: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  is_studio_admin: boolean;
  created_at: string;
}

export interface VentureMember {
  venture_id: number;
  user_id: string;
  role: "ceo" | "admin";
  created_at: string;
}

export function money(n: number, ccy = "EUR"): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 0,
  }).format(n);
}
