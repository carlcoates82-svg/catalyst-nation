import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Venture } from "@/lib/domain";
import { createVentureAction, inviteAdminAction } from "@/lib/actions";
import { inputClass, submitClass } from "@/lib/ui";

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

  const { data: admins } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("is_studio_admin", true);
  const adminList = admins ?? [];

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

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ash">
          Create venture
        </h2>
        <form action={createVentureAction} className="grid grid-cols-2 gap-2">
          <input name="name" required placeholder="Venture name" className={inputClass} />
          <input name="sector" placeholder="Sector" className={inputClass} />
          <input name="thesis" placeholder="Thesis (optional)" className={`${inputClass} col-span-2`} />
          <input name="buyer" placeholder="Buyer / budget owner (optional)" className={inputClass} />
          <input name="founder_ceo" placeholder="Founder CEO (optional)" className={inputClass} />
          <button type="submit" className={`${submitClass} col-span-2`}>
            Create venture
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ash">
          Studio team
        </h2>
        {adminList.length ? (
          <ul className="mb-4 space-y-2">
            {adminList.map((a, i) => (
              <li
                key={i}
                className="rounded-md border border-slate bg-charcoal px-4 py-3 text-sm text-off-white"
              >
                {a.email ?? "(no email on file)"}{" "}
                <span className="text-xs uppercase tracking-wide text-ash">admin</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-ash">No studio admins on file.</p>
        )}
        <form action={inviteAdminAction} className="grid grid-cols-[1fr_auto_auto] gap-2">
          <input
            name="email"
            type="email"
            required
            placeholder="cofounder@example.com"
            className={inputClass}
          />
          <input
            name="password"
            type="text"
            placeholder="Temp password (new accounts only)"
            className={inputClass}
          />
          <button type="submit" className={submitClass}>
            Invite as Studio Admin
          </button>
        </form>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="mb-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image src="/brand/mark-catalyst.svg" alt="" width={28} height={28} />
          <span className="text-sm font-medium tracking-wide text-ash">
            CATALYST NATION
          </span>
        </div>
        <Link href="/account" className="text-xs text-ash hover:text-off-white">
          Account
        </Link>
      </div>
      {children}
    </main>
  );
}
