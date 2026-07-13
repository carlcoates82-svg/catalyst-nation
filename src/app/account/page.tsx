import Image from "next/image";
import { requireProfile } from "@/lib/auth";
import { changePasswordAction, signOutAction } from "@/lib/actions";
import { inputClass, submitClass } from "@/lib/ui";

export default async function AccountPage() {
  const profile = await requireProfile();

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <div className="mb-10 flex items-center gap-3">
        <Image src="/brand/mark-catalyst.svg" alt="" width={28} height={28} />
        <span className="text-sm font-medium tracking-wide text-ash">CATALYST NATION</span>
      </div>

      <h1 className="mb-1 text-2xl font-semibold text-off-white">Account</h1>
      <p className="mb-8 text-sm text-ash">
        {profile.email}
        {profile.is_studio_admin ? " · studio admin" : ""}
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ash">
          Change password
        </h2>
        <form action={changePasswordAction} className="space-y-2">
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="New password (min 8 characters)"
            className={inputClass}
          />
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            placeholder="Confirm new password"
            className={inputClass}
          />
          <button type="submit" className={submitClass}>
            Update password
          </button>
        </form>
      </section>

      <section>
        <form action={signOutAction}>
          <button type="submit" className="text-sm text-ash hover:text-off-white">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
