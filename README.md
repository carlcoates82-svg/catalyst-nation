# Catalyst Nation

The web dashboard half of the Catalyst Nation product — CEOs and business
owners sign in and see their own venture; studio admins see the whole
portfolio. Next.js (App Router) + Supabase (Auth + Postgres + RLS).

The other half is [Catalyst OS](../Desktop/the-ai-foundry/Catalyst%20Nation-os-mcp)
(the MCP server Carl drives via Claude) — for now it still runs on its own
local SQLite file. Repointing it at this same Supabase project is a later
piece.

Auth is **email + password**, not magic links — magic links turned out to be
unreliable (single-use tokens dying before the user could click them, and
Supabase's email-template editor being too flaky to customize reliably), so
password auth avoids the whole email round-trip.

## First-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) —
   free tier, `eu-west-1` region. Note the **Project URL**, **anon public
   key**, and **service role key** (Project Settings → API).

2. **Copy the env file** and fill in those three values:

   ```bash
   cp .env.local.example .env.local
   ```

3. **Run the migrations, in order.** Open the Supabase SQL editor and paste
   in each of `supabase/migrations/0001_init.sql`, `0002_venture_member_writes.sql`,
   `0003_profiles_email.sql`, then `supabase/seed.sql` (one demo venture with
   budgets/KPI/risk/gate data).

4. **Create your own account** in Supabase Dashboard → **Authentication →
   Users → Add user → Create new user**. Enter your email, set a password,
   and tick **Auto Confirm User**. This creates the `profiles` row via the
   trigger automatically (no email sent).

5. **Make yourself a studio admin.** In the SQL editor:

   ```sql
   update public.profiles set is_studio_admin = true where id = (
     select id from auth.users where email = 'you@example.com'
   );
   ```

   Sign in at `/login` with that email/password — you should see the full
   portfolio view instead of "not yet linked to a venture".

## Adding a venture and a CEO / business owner

No SQL or Supabase dashboard needed — it's all in the app now, for studio
admins:

1. **Portfolio dashboard** → **Create venture** form — name, sector, thesis,
   buyer, founder CEO.
2. Open that venture's page → **Team** section → **Invite as CEO** — enter
   their email and a temporary password (share it with them out of band,
   e.g. WhatsApp). If that email already has an account (e.g. they run more
   than one portfolio company), leave the password blank — it reuses their
   existing login and just adds this venture to it.

They'll land straight on their venture next time they sign in, and can't see
any other venture or the portfolio view.

## Develop

```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint
```
