# MISSION CHECKLIST TERMINAL

Internal sniper-team mission preparation checklist with real-time squad sync.
Terminal aesthetic, green-on-black, monospace.

## Stack

- React 18 + Vite (single component, `src/MissionChecklist.jsx`)
- Supabase (Postgres + Realtime) for shared state
- Per-operator checklists with squad-wide roll-up view
- Offline-tolerant: mutations queue locally and flush on reconnect

## One-time setup

### 1. Run the schema in Supabase

Open your Supabase project at https://supabase.com → SQL Editor → New query.
Paste the contents of `schema.sql` and click **Run**. This creates the tables,
row-level security policies, and adds the tables to the realtime publication.

### 2. Set environment variables

Copy `.env.example` to `.env`:

```
cp .env.example .env
```

The example file is already filled in with the project URL and anon key.

### 3. Install and run

```
npm install
npm run dev
```

Open http://localhost:5173

## Using it

**First operator on a mission:** click `[ CREATE MISSION ]`, set a mission code
(e.g. `NIGHTHAWK-07`) and a squad password. Pick a callsign. You're in.

**Other squad members:** click `[ JOIN MISSION ]`, type the same code and
password, and pick their own callsign. Each operator gets their own checklist.

**Roll-up view:** click `[ ROLL-UP ]` in the top bar to see a live table of
every operator on the mission with completion %, status (READY / PREP /
OFFLINE), and last-seen time. Updates in real time via Supabase Realtime.

**Offline:** if connectivity drops, the checklist keeps working. Toggles and
edits queue locally and flush automatically when the link comes back. The
status line at the bottom shows `LINK: OFFLINE` and the queue depth.

## Deploying to GitHub Pages

A GitHub Actions workflow is included at `.github/workflows/deploy.yml`.
It builds the app and publishes to GitHub Pages on every push to `main`.

One-time setup:

1. Create a **public** GitHub repo named exactly `Mission-Check-List`
   (the Vite `base` path in `vite.config.js` and the workflow assume this name).
2. Push this folder to the repo:
   ```
   git init
   git add .
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/<your-user>/Mission-Check-List.git
   git push -u origin main
   ```
3. In the GitHub repo: **Settings → Pages → Build and deployment → Source**
   set to **GitHub Actions**.
4. Push triggers a build automatically. Watch progress under the **Actions** tab.
   When it finishes, the app is live at:
   `https://<your-user>.github.io/Mission-Check-List/`

If you rename the repo, update the `base` value in `vite.config.js` to match.

The Supabase URL and anon key are inlined in the workflow file. Anon keys are
public by design — that's the intended use of an anon key — so this is safe
even though the repo is public. The actual security gate is the squad password
which is hashed before being stored in Supabase.

## Security model

This is a closed internal tool. Authentication is a shared squad password,
hashed (SHA-256) before being stored on the mission row. Anyone who knows the
mission code AND the squad password can read and write that mission's data.
The Supabase anon key is exposed in the browser by design — that's the
intended use of an anon key. The real gate is the squad password check.

If you need stronger isolation (per-operator accounts, audit logs, etc.),
switch to Supabase Auth and tighten the RLS policies in `schema.sql`.

## Files

```
schema.sql              -- run once in Supabase
src/MissionChecklist.jsx -- the app
src/main.jsx            -- React entrypoint
index.html              -- Vite entrypoint
vite.config.js          -- Vite config
package.json            -- deps + scripts
.env.example            -- copy to .env
```
