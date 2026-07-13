import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { money, type Venture, type Budget, type Kpi, type Risk, type Gate, type Validation } from "@/lib/domain";
import { recordKpiAction, recordSpendAction, recordValidationAction, addRiskAction } from "@/lib/actions";

const inputClass =
  "w-full rounded-md border border-slate bg-graphite px-3 py-2 text-sm text-off-white placeholder:text-ash focus:border-emerald focus:outline-none";
const submitClass =
  "rounded-md bg-emerald px-4 py-2 text-sm font-medium text-graphite transition hover:bg-emerald-deep";

export default async function VenturePage({
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
    .select("*")
    .eq("id", ventureId)
    .single();

  if (!venture) notFound();
  const v = venture as Venture;

  const [{ data: budgets }, { data: kpis }, { data: risks }, { data: gates }, { data: validation }] =
    await Promise.all([
      supabase.from("budgets").select("*").eq("venture_id", ventureId).order("phase"),
      supabase
        .from("kpis")
        .select("*")
        .eq("venture_id", ventureId)
        .order("as_of", { ascending: false })
        .order("id", { ascending: false })
        .limit(3),
      supabase
        .from("risks")
        .select("*")
        .eq("venture_id", ventureId)
        .eq("status", "open"),
      supabase
        .from("gates")
        .select("*")
        .eq("venture_id", ventureId)
        .order("id", { ascending: false })
        .limit(5),
      supabase
        .from("validation")
        .select("*")
        .eq("venture_id", ventureId)
        .order("id", { ascending: false }),
    ]);

  const budgetList = (budgets ?? []) as Budget[];
  const kpiList = (kpis ?? []) as Kpi[];
  const riskList = (risks ?? []) as Risk[];
  const gateList = (gates ?? []) as Gate[];
  const validationList = (validation ?? []) as Validation[];
  const latestKpi = kpiList[0];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="mb-10 flex items-center gap-3">
        <Image src="/brand/mark-catalyst.svg" alt="" width={28} height={28} />
        <span className="text-sm font-medium tracking-wide text-ash">CATALYST NATION</span>
      </div>

      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-off-white">{v.name}</h1>
        <span className="rounded-full border border-emerald/40 px-2.5 py-1 text-xs text-emerald">
          {v.stage}
        </span>
      </div>
      <p className="mb-8 text-sm text-ash">
        {v.sector ?? "—"} · {v.status}
        {v.founder_ceo ? ` · Founder CEO: ${v.founder_ceo}` : ""}
      </p>

      {v.thesis && (
        <Section title="Thesis">
          <p className="text-sm text-off-white">{v.thesis}</p>
        </Section>
      )}

      <Section title="Traction">
        {latestKpi ? (
          <div className="grid grid-cols-3 gap-4">
            <Stat label="ARR" value={money(latestKpi.arr ?? 0)} />
            <Stat label="Customers" value={String(latestKpi.customers ?? 0)} />
            <Stat label="Pipeline" value={money(latestKpi.pipeline ?? 0)} />
          </div>
        ) : (
          <Empty text="No KPIs recorded yet." />
        )}
        <form action={recordKpiAction} className="mt-4 grid grid-cols-3 gap-2">
          <input type="hidden" name="venture_id" value={ventureId} />
          <input name="arr" type="number" min="0" step="1" placeholder="ARR" className={inputClass} />
          <input name="customers" type="number" min="0" step="1" placeholder="Customers" className={inputClass} />
          <input name="pipeline" type="number" min="0" step="1" placeholder="Pipeline" className={inputClass} />
          <input name="note" placeholder="Note (optional)" className={`${inputClass} col-span-2`} />
          <button type="submit" className={submitClass}>
            Record KPI
          </button>
        </form>
      </Section>

      <Section title="Budget">
        {budgetList.length ? (
          <div className="space-y-2">
            {budgetList.map((b) => {
              const over = b.allocated > 0 && b.spent > b.allocated;
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-md border border-slate bg-charcoal px-4 py-3 text-sm"
                >
                  <span className="capitalize text-off-white">{b.phase}</span>
                  <span className={over ? "text-bronze" : "text-ash"}>
                    {money(b.spent, b.currency)} / {money(b.allocated, b.currency)}
                    {over ? " · over budget" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text="No budgets set." />
        )}
        <form action={recordSpendAction} className="mt-4 flex gap-2">
          <input type="hidden" name="venture_id" value={ventureId} />
          <select name="phase" className={inputClass} defaultValue="mvp">
            <option value="validation">Validation</option>
            <option value="mvp">MVP</option>
            <option value="pilot">Pilot</option>
            <option value="other">Other</option>
          </select>
          <input
            name="amount"
            type="number"
            min="0"
            step="1"
            required
            placeholder="Amount spent"
            className={inputClass}
          />
          <button type="submit" className={submitClass}>
            Record spend
          </button>
        </form>
      </Section>

      <Section title="Open risks">
        {riskList.length ? (
          <ul className="space-y-2">
            {riskList.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-slate bg-charcoal px-4 py-3 text-sm text-off-white"
              >
                <span className="mr-2 text-xs uppercase tracking-wide text-bronze">
                  {r.severity}/{r.likelihood}
                </span>
                {r.description}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="None recorded." />
        )}
        <form action={addRiskAction} className="mt-4 flex gap-2">
          <input type="hidden" name="venture_id" value={ventureId} />
          <select name="severity" className={inputClass} defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select name="likelihood" className={inputClass} defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            name="description"
            required
            placeholder="Risk description"
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={submitClass}>
            Add risk
          </button>
        </form>
      </Section>

      <Section title="Validation evidence">
        {validationList.length ? (
          <ul className="space-y-2">
            {validationList.map((val) => (
              <li
                key={val.id}
                className="rounded-md border border-slate bg-charcoal px-4 py-3 text-sm text-off-white"
              >
                <span className="mr-2 text-xs uppercase tracking-wide text-ash">{val.kind}</span>
                {val.note}
                {val.willingness_to_pay != null ? ` — WTP ${money(val.willingness_to_pay)}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="No validation evidence recorded." />
        )}
        <form action={recordValidationAction} className="mt-4 flex gap-2">
          <input type="hidden" name="venture_id" value={ventureId} />
          <select name="kind" className={inputClass} defaultValue="interview">
            <option value="interview">Interview</option>
            <option value="willingness-to-pay">Willingness to pay</option>
            <option value="pilot-signal">Pilot signal</option>
            <option value="competitor">Competitor</option>
            <option value="other">Other</option>
          </select>
          <input name="note" required placeholder="Evidence / insight" className={`${inputClass} flex-1`} />
          <input
            name="willingness_to_pay"
            type="number"
            min="0"
            step="1"
            placeholder="WTP (optional)"
            className={inputClass}
          />
          <button type="submit" className={submitClass}>
            Add
          </button>
        </form>
      </Section>

      <Section title="Recent gate decisions">
        {gateList.length ? (
          <ul className="space-y-2">
            {gateList.map((g) => (
              <li key={g.id} className="text-sm text-off-white">
                <span className="text-ash">{g.created_at.slice(0, 10)}</span> · {g.stage}:{" "}
                <span className="font-medium">{g.decision}</span>
                {g.rationale ? ` — ${g.rationale}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="None recorded." />
        )}
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ash">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate bg-charcoal px-4 py-3">
      <p className="text-xs text-ash">{label}</p>
      <p className="text-lg font-semibold text-off-white">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-ash">{text}</p>;
}
