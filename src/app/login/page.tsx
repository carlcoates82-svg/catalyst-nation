"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);
    if (error) {
      setErrorMessage(error.message);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Image
            src="/brand/mark-catalyst.svg"
            alt="Catalyst Nation"
            width={48}
            height={48}
            priority
          />
        </div>

        <h1 className="mb-2 text-center text-xl font-semibold text-off-white">
          Sign in to Catalyst Nation
        </h1>
        <p className="mb-8 text-center text-sm text-ash">
          Enter the email and password given to you by your Catalyst Nation contact.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-md border border-slate bg-charcoal px-4 py-2.5 text-sm text-off-white placeholder:text-ash focus:border-emerald focus:outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-md border border-slate bg-charcoal px-4 py-2.5 text-sm text-off-white placeholder:text-ash focus:border-emerald focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-emerald px-4 py-2.5 text-sm font-medium text-graphite transition hover:bg-emerald-deep disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
        </form>
      </div>
    </main>
  );
}
