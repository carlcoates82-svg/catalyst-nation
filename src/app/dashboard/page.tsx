import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Venture } from "@/lib/domain";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (!profile.is_studio_admin) {
    const { data: membership } = await supabase
      .from("venture_members")
      .select("venture_id")
      .eq("user_id", profile.id)
      .limit(1)
      .maybeSingle();

    if (membership) redirect(`/venture/${membership.venture_id}`);

    return (
      <Shell>
        <p className="text-ash">
          You&apos;re signed in, but not yet linked to a venture. Ask your Catalyst
          Nation contact to add you.
        </p>
      </Shell>
    );
  }

  const { data: ventures } = await supabase
    .from("ventures")
    .select("*")
    .order("id");

  const list = (ventures ?? []) as Venture[];

  const byStage: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const v of list) {
    byStage[v.stage] = (byStage[v.stage] ?? 0) + 1;
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
  }

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-semibold text-off-white">Portfolio</h1>
      <p className="mb-8 text-sm text-ash">
        {list.length} venture{list.length === 1 ? "" : "s"} ·{" "}
        {Object.entries(byStatus)
          .map(([k, n]) => `${n} ${k}`)
          .join(", ") || "none yet"}
      </p>

      <div className="mb-10 flex flex-wrap gap-2">
        {Object.entries(byStage).map(([stage, n]) => (
          <span
            key={stage}
            className="rounded-full border border-slate bg-charcoal px-3 py-1 text-xs text-ash"
          >
            {stage} <span className="text-off-white">{n}</span>
          </span>
        ))}
      </div>

      <div className="divide-y divide-slate overflow-hidden rounded-lg border border-slate">
        {list.length === 0 && (
          <p className="p-6 text-sm text-ash">No ventures yet.</p>
        )}
        {list.map((v) => (
          <Link
            key={v.id}
            href={`/venture/${v.id}`}
            className="flex items-center justify-between gap-4 bg-charcoal px-5 py-4 transition hover:bg-slate"
          >
            <div>
              <p className="font-medium text-off-white">{v.name}</p>
              <p className="text-xs text-ash">
                {v.sector ?? "—"}
                {v.founder_ceo ? ` · CEO: ${v.founder_ceo}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="rounded-full border border-emerald/40 px-2.5 py-1 text-emerald">
                {v.stage}
              </span>
              <span className="text-ash">{v.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="mb-10 flex items-center gap-3">
        <Image src="/brand/mark-catalyst.svg" alt="" width={28} height={28} />
        <span className="text-sm font-medium tracking-wide text-ash">
          CATALYST NATION
        </span>
      </div>
      {children}
    </main>
  );
}
