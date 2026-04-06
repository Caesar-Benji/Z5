# Z5 TERMINAL

Internal sniper team operations environment. Phase 1: authentication, squads,
roles, and personal gear inventory. Phase 2 will add missions and checklists.
Phase 3 will add notifications.

## Stack

- React 18 + Vite
- Supabase (Auth + Postgres + Realtime)
- White-on-black terminal aesthetic, monospace, CRT scanlines

## Roles

- **ADMIN** — full control. First user to sign up with `benjaminaidinov@gmail.com`
  is automatically promoted to admin (no invite code needed).
- **TEAM OFFICER** — cross-squad authority. Manages squads, generates invites,
  views all members.
- **SQUAD LEADER** — manages their own squad. Can generate invite codes for
  snipers in their own squad.
- **SNIPER** — manages their own profile and gear inventory.

## One-time setup

### 1. Run the schema in Supabase

Open Supabase → SQL Editor → New query → paste `schema_v2.sql` → **Run**.
This drops the legacy v1 tables and rebuilds the v2 schema with auth wiring,
RLS policies, the signup trigger, and the invite-redemption RPC.

### 2. Set environment variables

```
cp .env.example .env
```

The example file already contains the project URL and anon key.

### 3. Install and run

```
npm install
npm run dev
```

Open http://localhost:5173

## Bootstrap (first run)

1. Click **[ NEW OPERATOR ]** on the login screen.
2. Enter email `benjaminaidinov@gmail.com`, a password, and a callsign.
   The form detects the bootstrap email and skips the invite code requirement.
3. Click **[ REGISTER ]**.
4. Switch to **[ LOGIN ]** and sign in with the same email + password.
   You're now in as ADMIN.
5. Go to **[ ROSTER ]** → **REGISTER NEW SQUAD** → create your first squad
   (e.g. `WRAITH`).
6. In **INVITE CODES**, pick the squad and role, click **[ GENERATE CODE ]**.
   Share that code with the operator.
7. The operator clicks **[ NEW OPERATOR ]**, enters their email, password,
   callsign, and the invite code → they get assigned to the squad with the
   correct role automatically.

## Deploying to GitHub Pages

A GitHub Actions workflow at `.github/workflows/deploy.yml` builds the app and
publishes to GitHub Pages on every push to `main`. The Vite `base` path is
`/Z5/` so the repo MUST be named exactly `Z5`.

One-time setup:

1. Create a **public** GitHub repo named exactly `Z5`.
2. Push this folder to it:
   ```
   git remote set-url origin https://github.com/<your-user>/Z5.git
   git add -A
   git commit -m "Z5 phase 1: auth, squads, roles, gear"
   git push -u origin main --force
   ```
3. In the GitHub repo: **Settings → Pages → Build and deployment → Source**
   set to **GitHub Actions**.
4. Watch the build under the **Actions** tab. When green, the app is live at:
   `https://<your-user>.github.io/Z5/`

## Files

```
schema_v2.sql              -- run once in Supabase
src/main.jsx               -- React entry
src/App.jsx                -- top-level routing (auth gate)
src/supabase.js            -- supabase client + bootstrap email
src/auth.jsx               -- AuthProvider + useAuth + role helpers
src/theme.js               -- color palette + style atoms
src/ui.jsx                 -- shared UI primitives (Btn, Input, Panel, ...)
src/screens/Auth.jsx       -- login + signup
src/screens/Shell.jsx      -- post-login navigation
src/screens/Profile.jsx    -- own identity + password change
src/screens/Gear.jsx       -- own gear inventory
src/screens/Roster.jsx     -- squads + members + invite codes
```

## Roadmap

**Phase 1 (this build)** — auth, squads, roles, gear inventory.
**Phase 2** — missions linked to squads, per-mission checklist progress, squad
roll-up view of mission readiness.
**Phase 3** — notifications: in-app feed + live banner, real-time via
Supabase Realtime, broadcast or per-squad targeting.
