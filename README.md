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

3. **Run the migration.** Open the Supabase SQL editor and paste in, in
   order:
   - `supabase/migrations/0001_init.sql` — schema, RLS policies, the
     auto-provision-profile trigger.
   - `supabase/seed.sql` — one demo venture with budgets/KPI/risk/gate data.

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

## Adding a CEO / business owner

1. Supabase Dashboard → **Authentication → Users → Add user → Create new
   user** — set their email and a temporary password, tick **Auto Confirm
   User**. Share the password with them out of band (WhatsApp, etc).
2. Link them to their venture in the SQL editor:

   ```sql
   insert into public.venture_members (venture_id, user_id, role)
   select 1, id, 'ceo' from auth.users where email = 'ceo@theirventure.com';
   ```

They'll land straight on `/venture/1` next time they sign in. A
self-service invite flow (no manual SQL) is a later piece.

## Develop

```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint
```
