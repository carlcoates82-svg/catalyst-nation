import Image from "next/image";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getBoardPackData } from "@/lib/board-data";
import { money } from "@/lib/domain";
import { PrintButton } from "@/components/print-button";
import { KpiTrend } from "@/components/kpi-trend";

export default async function BoardPackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const ventureId = Number(id);

  const {
    venture: v,
    budgets: budgetList,
    kpis: kpiList,
    risks: riskList,
    gates: gateList,
    validation: validationList,
    agents: agentList,
  } = await getBoardPackData(ventureId);
  const latestKpi = kpiList[0];
  const kpiAsc = [...kpiList].reverse(); // oldest → newest for the trend charts

  const totalBudgetAllocated = budgetList.reduce((sum, b) => sum + b.allocated, 0);
  const totalBudgetSpent = budgetList.reduce((sum, b) => sum + b.spent, 0);
  const agentBudgetAllocated = agentList.reduce((sum, a) => sum + a.budget_allocated, 0);
  const agentBudgetSpent = agentList.reduce((sum, a) => sum + a.budget_spent, 0);

  const generatedAt = new Date().toLocaleDateString("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 print:max-w-none print:bg-white print:px-10 print:py-8 print:text-black">
      <div className="mb-10 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Image src="/brand/mark-catalyst.svg" alt="" width={28} height={28} />
          <span className="text-sm font-medium tracking-wide text-ash">CATALYST NATION</span>
        </div>
        <Link href="/account" className="text-xs text-ash hover:text-off-white">
          Account
        </Link>
      </div>

      <div className="mb-1 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/venture/${ventureId}`} className="text-xs text-ash hover:text-off-white">
          ← {v.name}
        </Link>
        <div className="flex items-center gap-3">
          <a
            href={`/venture/${ventureId}/board/pdf`}
            className="rounded-md border border-slate px-4 py-2 text-xs text-off-white hover:bg-slate"
          >
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      <header className="mb-10 border-b border-slate pb-6 print:border-neutral-300">
        <p className="mb-1 text-xs uppercase tracking-wide text-ash print:text-neutral-500">
          Board pack · Generated {generatedAt}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-off-white print:text-black">{v.name}</h1>
          <span className="rounded-full border border-emerald/40 px-2.5 py-1 text-xs text-emerald print:border-neutral-400 print:text-black">
            {v.stage}
          </span>
        </div>
        <p className="mt-1 text-sm text-ash print:text-neutral-600">
          {v.sector ?? "—"} · {v.status}
          {v.founder_ceo ? ` · Founder CEO: ${v.founder_ceo}` : ""}
        </p>
        {v.thesis && <p className="mt-3 text-sm text-off-white print:text-black">{v.thesis}</p>}
      </header>

      <Section title="Traction">
        {latestKpi ? (
          <>
            <div className="mb-4 grid grid-cols-3 gap-4">
              <Stat
                label="ARR"
                value={money(latestKpi.arr ?? 0)}
                trend={kpiAsc.map((k) => k.arr)}
              />
              <Stat
                label="Customers"
                value={String(latestKpi.customers ?? 0)}
                trend={kpiAsc.map((k) => k.customers)}
              />
              <Stat
                label="Pipeline"
                value={money(latestKpi.pipeline ?? 0)}
                trend={kpiAsc.map((k) => k.pipeline)}
              />
            </div>
            {kpiList.length > 1 && (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-ash print:text-neutral-500">
                    <th className="pb-2 font-normal">Date</th>
                    <th className="pb-2 font-normal">ARR</th>
                    <th className="pb-2 font-normal">Customers</th>
                    <th className="pb-2 font-normal">Pipeline</th>
                    <th className="pb-2 font-normal">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiList.map((k) => (
                    <tr
                      key={k.id}
                      className="border-t border-slate text-off-white print:border-neutral-200 print:text-black"
                    >
                      <td className="py-2 text-ash print:text-neutral-600">{k.as_of}</td>
                      <td className="py-2">{money(k.arr ?? 0)}</td>
                      <td className="py-2">{k.customers ?? 0}</td>
                      <td className="py-2">{money(k.pipeline ?? 0)}</td>
                      <td className="py-2 text-ash print:text-neutral-600">{k.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <Empty text="No KPIs recorded yet." />
        )}
      </Section>

      <Section title="Budget">
        {budgetList.length ? (
          <div className="space-y-2">
            {budgetList.map((b) => {
              const over = b.allocated > 0 && b.spent > b.allocated;
              return (
                <Row key={b.id} left={<span className="capitalize">{b.phase}</span>} over={over}>
                  {money(b.spent, b.currency)} / {money(b.allocated, b.currency)}
                  {over ? " · over budget" : ""}
                </Row>
              );
            })}
            <Row
              left={<span className="font-semibold">Total</span>}
              over={totalBudgetAllocated > 0 && totalBudgetSpent > totalBudgetAllocated}
              bold
            >
              {money(totalBudgetSpent)} / {money(totalBudgetAllocated)}
            </Row>
          </div>
        ) : (
          <Empty text="No budgets set." />
        )}
      </Section>

      <Section title="AI agent spend (Paperclip)">
        {agentList.length ? (
          <div className="space-y-2">
            {agentList.map((a) => {
              const over = a.budget_allocated > 0 && a.budget_spent > a.budget_allocated;
              return (
                <Row key={a.id} left={a.name} over={over}>
                  {money(a.budget_spent, a.currency)} / {money(a.budget_allocated, a.currency)}
                  {over ? " · over budget" : ""}
                </Row>
              );
            })}
            <Row
              left={<span className="font-semibold">Total</span>}
              over={agentBudgetAllocated > 0 && agentBudgetSpent > agentBudgetAllocated}
              bold
            >
              {money(agentBudgetSpent)} / {money(agentBudgetAllocated)}
            </Row>
          </div>
        ) : (
          <Empty text="No agents running for this venture." />
        )}
      </Section>

      <Section title="Open risks">
        {riskList.length ? (
          <ul className="space-y-2">
            {riskList.map((r) => (
              <li key={r.id} className="text-sm text-off-white print:text-black">
                <span className="mr-2 text-xs uppercase tracking-wide text-bronze print:text-neutral-700">
                  {r.severity}/{r.likelihood}
                </span>
                {r.description}
                {r.mitigation ? ` — Mitigation: ${r.mitigation}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="None open." />
        )}
      </Section>

      <Section title="Validation evidence">
        {validationList.length ? (
          <ul className="space-y-2">
            {validationList.map((val) => (
              <li key={val.id} className="text-sm text-off-white print:text-black">
                <span className="mr-2 text-xs uppercase tracking-wide text-ash print:text-neutral-500">
                  {val.kind}
                </span>
                {val.note}
                {val.willingness_to_pay != null ? ` — WTP ${money(val.willingness_to_pay)}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="None recorded." />
        )}
      </Section>

      <Section title="Gate history">
        {gateList.length ? (
          <ul className="space-y-2">
            {gateList.map((g) => (
              <li key={g.id} className="text-sm text-off-white print:text-black">
                <span className="text-ash print:text-neutral-500">{g.created_at.slice(0, 10)}</span> ·{" "}
                {g.stage}: <span className="font-medium">{g.decision}</span>
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
    <section className="mb-8 print:break-inside-avoid">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ash print:text-neutral-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: (number | null)[];
}) {
  return (
    <div className="rounded-md border border-slate bg-charcoal px-4 py-3 print:border-neutral-300 print:bg-white">
      <p className="text-xs text-ash print:text-neutral-500">{label}</p>
      <p className="text-lg font-semibold text-off-white print:text-black">{value}</p>
      {trend && (
        <div className="text-emerald print:text-emerald-deep">
          <KpiTrend values={trend} />
        </div>
      )}
    </div>
  );
}

function Row({
  left,
  children,
  over,
  bold,
}: {
  left: React.ReactNode;
  children: React.ReactNode;
  over?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate bg-charcoal px-4 py-3 text-sm print:border-neutral-300 print:bg-white">
      <span className={`text-off-white print:text-black ${bold ? "font-semibold" : ""}`}>{left}</span>
      <span
        className={
          over
            ? "text-bronze print:font-semibold print:text-neutral-900"
            : "text-ash print:text-neutral-600"
        }
      >
        {children}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-ash print:text-neutral-500">{text}</p>;
}
