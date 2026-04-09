# Z5 TERMINAL

Internal team operations platform — mission planning, equipment tracking, squad
management, and operational checklists. Built as a lightweight field-terminal UI
with a retro CRT aesthetic.

**Live:** Deployed via GitHub Pages with automated CI/CD.

## Stack

- React 18 + Vite
- Supabase (Auth + Postgres + Realtime + RLS)
- Terminal aesthetic: monospace typography, CRT scanline overlay

## Features

- Role-based access control (Admin, Officer, Squad Leader, Operator)
- Squad lifecycle management with status tracking
- Mission creation, assignment, and checklist progress
- Announcement broadcasting
- Personal equipment registry with model/serial tracking
- Interactive calendar with mission scheduling
- Realtime updates via Supabase subscriptions

## Roles

- **ADMIN** — full platform control, all squads and members visible.
- **OFFICER** — cross-squad authority. Manages squads, generates invites,
  views all members.
- **SQUAD LEADER** — manages their own squad. Can generate invite codes and
  create missions.
- **OPERATOR** — manages own profile, gear inventory, and mission checklists.

## Setup

### 1. Database

Run the latest schema SQL file in Supabase → SQL Editor → New query → **Run**.

### 2. Environment variables

```
cp .env.example .env
```

Update with your Supabase project URL and anon key.

### 3. Install and run

```
npm install
npm run dev
```

Open `http://localhost:5173`

## First-run bootstrap

1. The first registered account is automatically promoted to **ADMIN**.
2. Sign in, navigate to **ROSTER**, and create your first squad.
3. Generate invite codes and distribute to team members.
4. Operators register with their invite code and are assigned to the
   correct squad and role automatically.

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes
to GitHub Pages on every push to `main`. The Vite `base` path is set to match
the repository name.

One-time GitHub setup: **Settings → Pages → Source → GitHub Actions**.

## Project structure

```
src/
  main.jsx              — React entry point
  App.jsx               — Top-level routing and auth gate
  supabase.js           — Supabase client configuration
  auth.jsx              — AuthProvider, useAuth, role helpers
  theme.js              — Color palette and style atoms
  ui.jsx                — Shared UI primitives (Btn, Input, Panel, …)
  missionTemplate.js    — Mission type definitions and task templates
  screens/
    Auth.jsx            — Login and registration
    Shell.jsx           — Post-login navigation shell
    Home.jsx            — Dashboard (upcoming missions, announcements)
    Calendar.jsx        — Monthly calendar with mission overlay
    Missions.jsx        — Mission list and announcement composer
    MissionCreate.jsx   — Mission creation form
    Checklist.jsx       — Mission detail, task checklist, delete flow
    Profile.jsx         — Identity, gear inventory, password management
    Gear.jsx            — Personal equipment registry
    Roster.jsx          — Squad management and invite codes (admin/officer)
```

## Roadmap

**Phase 1** — Authentication, squads, roles, gear inventory.
**Phase 2** *(current)* — Missions, checklists, calendar, announcements, squad
lifecycle status.
**Phase 3** — Training course module: cohorts, lesson modules, attendance
tracking, trainee dashboard.

## License

Internal use only. Not for public distribution.
