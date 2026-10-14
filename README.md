# Anusree's Daily Tracker

A cute, local-first student planner built as a real application — not a dashboard mockup.
Timetable, daily planner, study tracker, project manager, assignment manager, habit tracker,
sleep tracker with a cycle estimator, calendar, reminders and productivity analytics, all in a
white-and-pastel anime-inspired cat-and-bunny theme.

Every number in the app is derived from records you actually create. There are no invented
statistics anywhere, including in the empty states.

![App icon](public/icons/icon-512.png)

**Live app:** <https://anusree-daily-tracker.vercel.app>

---

## Table of contents

- [What it does](#what-it-does)
- [Technology](#technology)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Cloud sync with Supabase](#cloud-sync-with-supabase)
- [How the scheduling engine works](#how-the-scheduling-engine-works)
- [How sleep is calculated](#how-sleep-is-calculated)
- [Notifications: what works and what does not](#notifications-what-works-and-what-does-not)
- [Data storage, export and backup](#data-storage-export-and-backup)
- [PWA and offline behaviour](#pwa-and-offline-behaviour)
- [Testing, linting and building](#testing-linting-and-building)
- [Deployment](#deployment)
- [Accessibility](#accessibility)
- [Adding a backend or cloud sync later](#adding-a-backend-or-cloud-sync-later)
- [Known limitations](#known-limitations)

---

## What it does

| Module | Highlights |
| --- | --- |
| **Dashboard** | Greeting, real day rollup, next-up card, today's timeline, focus timer, habits, sleep, projects and an "needs attention" list |
| **Daily Planner** | Timeline with start/complete/miss actions, planned vs actual minutes, carry-forward, unscheduled inbox, manual log with undo |
| **My Timetable** | Weekly routine blocks stored as recurring series, week grid, per-week sleep view, copy-this-week-into-a-future-week |
| **Calendar** | Day, week, month and agenda views, `.ics` export with real `RRULE`s, overlap warnings |
| **Study Tracker** | Subjects with weekly targets, free-form sessions, Pomodoro, per-subject analytics, duration correction |
| **Project Tracker** | Projects, tasks, subtasks, checklists with weights, dependencies, list + Kanban board, weighted progress |
| **Tasks & Assignments** | Unified task manager with filters, sorting, search, subtasks, reminders and one-click scheduling |
| **Habits** | Daily or weekday-specific habits, numeric targets, schedule-aware streaks, 14-day grid and 28-day history |
| **Sleep Tracker** | Weeknight/weekend schedule that crosses midnight, single-night exceptions, live sessions, manual nights, wind-down and morning routines, 90-minute cycle estimator, analytics |
| **Analytics** | Planned vs actual, study/project hours, task completion, habit rate, sleep duration and timing, balance check |
| **Settings** | Profile, mascot, accent, goals, timer durations, notification categories, backup/restore, CSV and `.ics` export |

---

## Technology

- **React 19 + TypeScript**, built with **Vite 8** (no Next.js anywhere).
- **Tailwind CSS v4** with a CSS-first `@theme` design-token layer.
- **Radix UI** primitives behind a small hand-written component kit (`src/components/ui`).
- **Lucide React** for icons, **Motion** available for animation (the shell uses CSS keyframes
  for the cheap, always-on micro-interactions).
- **Recharts** for charts.
- **date-fns** for date maths.
- **Dexie.js** over **IndexedDB** for local persistence.
- **React Router** for routing, **Zod** for validation.
- **vite-plugin-pwa** for the manifest and service worker.
- **Vitest** for unit tests.

---

## Getting started

### Prerequisites

- **Node.js 20 or newer** (developed on Node 24).
- A modern browser (Chrome, Edge, Firefox or Safari) with IndexedDB enabled.

### Install and run

```bash
npm install
npm run dev
```

Vite prints a local URL (by default <http://localhost:5173>). Open it and the app creates its
default settings, sleep schedule and routines on first run.

> **npm cache note.** If your npm cache lives outside the project and your environment restricts
> writes there, point npm at a project-local cache:
> `npm install --cache ./.npm-cache`.

### All scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) then produce a production build in `dist/` |
| `npm run typecheck` | Typecheck only |
| `npm run lint` | ESLint over the whole project |
| `npm run lint:fix` | ESLint with `--fix` |
| `npm test` | Run the unit test suite once |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run icons` | Regenerate the PWA icon set from the SVG artwork |
| `npm run preview` | Serve the production build with Vite's preview server |
| `npm run serve:dist` | Serve `dist/` with a dependency-free static server (useful when `vite preview` is unavailable) |

---

## Project structure

```
src/
  app/            App shell, routing, and the single app context (state + mutations)
  pages/          One module per route
  components/
    layout/       Sidebar, header, logo
    dashboard/    Focus timer card
    calendar/     Event form, event card, daily timeline
    timetable/    Week grid
    planner/      (planner UI lives in pages/PlannerPage plus calendar components)
    study/        Study timer
    projects/     (project UI lives in pages/ProjectsPage)
    tasks/        (task UI lives in pages/TasksPage)
    habits/       Habit grid and quick list
    sleep/        Sleep card, session editors
    notifications/ Notification centre
    analytics/    Progress card, trend chart, category breakdown, range picker
    ui/           Design-system primitives (button, dialog, field, chip, …)
    mascots/      Inline SVG cat, bunny and decorations
  hooks/          Tracker data subscription, timers, notifications, window context
  services/
    scheduling/   Recurrence expansion, conflicts, events, sleep materialisation
    notifications/Reminder construction and delivery
    persistence/  Storage interface + Dexie implementation
    analytics/    Day rollups, range summaries, streaks, sleep series
    export/       .ics, CSV, JSON backup and restore
  db/             Dexie schema, versioning, maintenance helpers
  types/          The single source of truth for domain types
  lib/            Date/time and general helpers
  config/         Defaults, categories, navigation, palette
  styles/         Design tokens and global CSS
  sw.js           Service worker (plain JS, see the PWA section)
scripts/          Icon generator and the static preview server
```

**Layering rule.** UI components never talk to IndexedDB directly and never contain scheduling
maths. Pages call the app context; the context calls services; services call the storage port.
That is what makes the storage layer swappable.

---

## Cloud sync with Supabase

The app is **local-first with cloud mirroring**. IndexedDB on your device stays the working store —
that is why it opens instantly and works offline — and Supabase mirrors your records so the same
planner appears on your laptop and your phone.

Cloud sync is **optional and additive**. With no credentials configured the app behaves exactly as a
purely local planner; the Settings → Cloud sync tab then shows the setup steps instead of a broken
form.

### Setup

1. **Create a project** at [supabase.com](https://supabase.com).

2. **Create the schema.** Open *SQL Editor → New query*, paste the contents of
   [`supabase/migrations/0001_records.sql`](supabase/migrations/0001_records.sql) and run it. This
   creates the `records`, `reminder_jobs` and `push_subscriptions` tables, the `record_counts` view,
   the `server_at` trigger, and enables Row Level Security with owner-scoped policies.

   With the Supabase CLI instead:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

3. **Enable email sign-in.** *Authentication → Providers → Email*: turn it on and make sure
   **magic link / OTP** is enabled. Under *Authentication → URL Configuration* add every URL the app
   is served from to **Redirect URLs**, for example:

   ```
   http://localhost:5173/**
   https://anusree-daily-tracker.vercel.app/**
   ```

4. **Add the environment variables.** Copy `.env.example` to `.env.local` and fill in:

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon or publishable key>
   ```

   Then add the same two variables to your Vercel project (*Project → Settings → Environment
   Variables*) and redeploy.

5. **Sign in.** Open Settings → Cloud sync, enter your email, and click the link that arrives. On
   first sign-in the app decides what to do automatically:

   - if this device already holds real work, it uploads that once and then pulls;
   - if this is a fresh install, it skips the upload and simply downloads — so a new device cannot
     overwrite your account with empty defaults.

### How synchronisation works

| Concern | Approach |
| --- | --- |
| **Local store** | IndexedDB via Dexie. Every read and write is local and instant. |
| **What is synced** | 16 entity types (settings, subjects, projects, project tasks, tasks, events, activity records, study sessions, habits, habit entries, sleep schedule, sleep exceptions, sleep sessions, sleep routines, routine completions, timer state markers). |
| **What is *not* synced** | Notification jobs and the change log are derived local state and are rebuilt from records. Running timers are deliberately device-local: two devices must never fight over one stopwatch. |
| **Push** | The append-only `changeLog` is collapsed to the newest row per record and upserted in batches of 400, so a push is proportional to what actually changed. |
| **Pull** | Incremental by a server-stamped `server_at` cursor, 1000 rows at a time. |
| **Conflicts** | Last-write-wins **per record**, keyed on each record's own `updatedAt`. |
| **Deletes** | Soft tombstones, so deleting on one device is not resurrected by a stale copy on another. |
| **Triggers** | Sync runs on first sign-in, on a 2.5 s debounce after any local mutation, on tab focus, on visibility change, on reconnect, every 5 minutes as a safety net, and on demand from the header indicator. |
| **Offline** | Every remote call is skipped while offline and the queued work is pushed on reconnect. |

### Security model

- **Row Level Security is on for every table**, and each policy is scoped to `auth.uid()`. One
  signed-in user can never read or write another user's rows.
- **Only the anon key ships to the browser.** `VITE_`-prefixed values are part of the bundle, so the
  `service_role` key — which bypasses RLS — must never be added to one. It is only ever needed
  server-side, for a cron worker.
- **The session** is stored as a refresh token in `localStorage` for this origin, with automatic
  refresh.
- **Signing out never blocks the app.** It simply stops mirroring; your local data is untouched.
- **Nothing is uploaded** until you explicitly sign in.

### Deleting cloud data

Settings → Cloud sync → **Delete cloud data** removes every row this account stored on Supabase
(RLS-scoped, so nothing else can be touched) and resets the local cursors. Your copy on this device
is left alone and can be uploaded again at any time.

---

### Recurrence

A repeating block is stored **once** as a *series template* (`isSeriesTemplate: true`) carrying a
`RecurrenceRule`. Concrete days are generated on read, so editing the routine updates every future
week while the past keeps the history it had.

Supported rules: `daily`, `weekdays`, `weekends`, `weekly`, and `custom` (an explicit weekday set),
each with an `interval`, an optional `endDate`, and an optional `count`.

- Weekly-ish frequencies repeat on their own multi-week rhythm rather than ISO week parity, which
  is what a planner actually wants: *"every 2 weeks on Mon & Thu, starting 3 Feb"*.
- `count`-limited series are resolved against the full span from the series start, so a cap is
  honoured exactly and never restarts in a later window.

### Exceptions

Cancelling or moving a single day does **not** touch the series. The planner writes a small
"cancel marker" row (a `cancelled` event carrying the `seriesId` and the original occurrence date),
and the occurrence builder skips that one day. Deleting the series removes the template and every
marker with it.

### Conflicts

Overlaps are detected over concrete occurrences within a ±3 day window, so a warning appears for
the actual day you are editing rather than for the whole series. Overlaps with planned sleep are
called out separately, because study landing on top of planned sleep is the one conflict worth
naming explicitly. Nothing is ever blocked — you tick **"Save anyway — I know these overlap"** and
the block is written.

### Overnight events

`endTime <= startTime` means the block crosses midnight (23:00 → 07:00). It is stored with
`overnight: true`, renders as a single block on its start day, and is exported to `.ics` with the
end date rolled forward.

### One source of truth for sleep

Sleep is **generated**, not stored: `sleepEventsForRange` turns the schedule (plus any single-night
exception and any recorded session) into ordinary `ScheduledEvent` rows. The timeline merges them
with your stored events, so the calendar, timetable, conflict detection and reminders all handle
sleep without a special case — and a nightly schedule and a one-off edit can never fight each other.

---

## How sleep is calculated

Three different quantities are kept apart on purpose:

| Quantity | Meaning |
| --- | --- |
| **Time in bed** | `wake − bedtime`. Always known. |
| **Estimated sleep** | `wake − estimated sleep onset − recorded awake time`. Only shown when an onset is recorded or entered. |
| **Awakenings** | Individually recorded interruptions, summed into the awake time. |

When no sleep onset is known the app shows **time in bed** and marks the estimate as unknown. It
never claims time in bed was actual sleep.

### Sleep-cycle estimator

Given a bedtime (or a required wake time) and your own "minutes to fall asleep", it lists 3–8
options at approximate **90-minute** intervals.

> 90 minutes is an *average*, not a fact about any individual night. Real cycles vary between
> people and from night to night. This tool cannot detect REM, light or deep sleep, cannot tell you
> when you actually woke, and cannot guarantee a better morning. It is a planning aid, **not a
> medical device**. If you are persistently exhausted or sleeping badly, talk to a doctor.

A session is never auto-completed. `confirmed` only becomes true after you end the session or save
a manual entry, and starting a second session while one is open is prevented rather than stacked.

An overnight session is attributed to the night it started: the sleep "day" is the date of the
bedtime, and before noon the current night is still considered yesterday's.

---

## Notifications: what works and what does not

### What is implemented

- Browser Notifications API with a **user-initiated permission flow** (Settings → Notifications, or
  the notification centre).
- A **test notification** button.
- An **in-app notification centre** with delivery history, grouped by day and mark-as-read.
- **Multi-reminder** support per block: at start time, 5, 10, 15, 30 and 60 minutes before, or any
  combination.
- Reminder categories you can enable or disable individually (study, project, assignment, activity,
  habit, wind-down, bedtime, wake-up, focus timer).
- **Persisted reminder jobs** in IndexedDB, rebuilt from live records whenever anything changes, so
  editing an event, moving a habit time or changing a deadline can never leave a stale reminder.
- **Duplicate prevention in two layers**: a `dedupeKey` of `refType:refId:occurrence:offset` that is
  checked against delivery history before firing, plus the notification `tag` so the OS replaces
  rather than stacks.
- **Reminders are recalculated on reload and on app resume** (`visibilitychange` and `focus`).
- Permission denial is handled gracefully: everything still lands in the in-app centre, and the UI
  says so plainly.

### The honest limitation

Reminders are scheduled **in the browser while the app is open**. Neither JavaScript timers nor a
service worker can wake a **closed** browser at an exact minute — that is a browser platform
constraint, not a gap that a service worker can close.

Therefore:

- Do **not** rely on this app as an alarm clock or as a guaranteed wake-up alarm.
- If the tab is closed, no reminder fires at the moment it was due. When you next open the app, jobs
  that are still in the future are rescheduled and anything long past is discarded rather than
  spammed at you.
- Genuinely reliable reminders for a closed browser require **server-side scheduling with Web Push**,
  which is **not** implemented in this local-first build. The optional path is described below.

### Optional: server-side Web Push (not implemented)

The local-first app is fully usable without it. To add reliable background reminders you would need:

1. A small server (Node/Express or a Supabase Edge Function) with a VAPID key pair.
2. A `push_subscriptions` table storing endpoint + keys per user.
3. A client `pushManager.subscribe()` call after permission is granted, posting the subscription to
   the server.
4. A scheduler (cron) that reads reminder jobs and sends Web Push to those subscriptions.
5. A `push` event handler in the service worker that calls `showNotification`.

**Never put the VAPID private key, database credentials or any API secret in frontend code.** Only
the VAPID *public* key belongs in the client. HTTPS is required for Web Push (localhost is exempt
for development).

---

## Data storage, export and backup

### Where your data lives

Everything is in **IndexedDB**, in a database named `anusree-daily-tracker`, via Dexie. The schema is
versioned: version 1 defines every table and every future change must add a new `.version()` block
with an upgrade function rather than mutating v1.

Tables: `settings`, `subjects`, `projects`, `projectTasks`, `tasks`, `events`, `activities`,
`studySessions`, `timerStates`, `habits`, `habitEntries`, `sleepSchedule`, `sleepExceptions`,
`sleepSessions`, `sleepRoutines`, `sleepRoutineCompletions`, `notificationJobs`, `notificationLog`,
and an append-only `changeLog`.

Records survive refresh, tab close and browser restart. Nothing is uploaded anywhere, and the app
makes no analytics or tracking requests.

**Active timers survive too.** Elapsed time is always *derived* — `accumulatedSeconds + (now −
runningSince)` — never accumulated by an interval, so a refresh, a background tab or a sleeping
device recovers the exact total after the fact.

### The `changeLog` table

Every mutation appends a self-contained change envelope (entity, id, action, snapshot, `syncedAt`).
Nothing reads it yet; it exists so a future sync worker can replay local mutations without a
rewrite.

### Exports

| Format | Contents | Where |
| --- | --- | --- |
| **JSON backup** | Every table, with a format marker, version, counts and export timestamp | Settings → Data |
| **CSV** | Study sessions, activity history, tasks, sleep records, habit history | Settings → Data |
| **`.ics`** | Scheduled blocks, with repeating blocks exported as real `RRULE`s (imports into Google Calendar, Apple Calendar and Outlook) | Calendar, Settings |

### Import and restore

Choosing a backup file opens a **preview** first: how many records of each type, how many already
exist locally, the export date and the file version. Nothing is written until you confirm.

- **Merge** (default) adds records that are not already present and skips duplicates.
- **Replace** clears the current tables first — for restoring onto a fresh device.

Malformed files, wrong file types and backups from a newer app version are rejected with a plain
explanation instead of a stack trace.

### Clearing data

Settings → Data offers **Restore defaults** and **Clear all local data**. Both go through a
confirmation dialog that names exactly what will be deleted. There is no cloud copy, so clearing is
permanent unless you downloaded a backup.

---

## PWA and offline behaviour

- A web app manifest (`Anusree's Daily Tracker`, standalone display, pastel theme, maskable icon).
- Icons generated from the app's own SVG mark into 192/512 PNG, a 512 maskable PNG, an
  apple-touch-icon and a favicon (`npm run icons`).
- A service worker (`src/sw.js`) written as **plain JavaScript on purpose**: Vite hashes asset
  names, so the precache list can only be known after the build. `vite-plugin-pwa` runs in
  `injectManifest` mode and substitutes `self.__WB_MANIFEST` with the real list.
- The **application shell is precached**, so the app opens offline. Navigations use
  cache-then-revalidate so a new build is picked up on the next visit.
- **Only the shell is cached.** No API responses, no user data — nothing sensitive could leak into a
  shared HTTP cache. The only runtime caching is same-origin static assets that were part of the
  build.
- A software update never takes over mid-session: a new build is downloaded and then announced in a
  banner with a **Reload now** button.
- Third-party font requests are deliberately not intercepted; the app degrades gracefully to system
  fonts.

---

## Testing, linting and building

```bash
npm run typecheck   # tsc -b, no emit
npm run lint        # ESLint (0 errors expected)
npm test            # 56 unit tests
npm run build       # typecheck + production build into dist/
```

### What the test suite covers

`src/services/scheduling/recurrence.test.ts` — daily/weekly/weekdays/weekends rules, intervals,
end dates, exact `count` handling across windows, occurrence expansion, cancelled and moved
exceptions, overnight blocks, conflict detection including study-over-sleep, and shifting blocks
across midnight in both directions.

`src/services/scheduling/sleep-events.test.ts` — weeknight vs weekend schedules crossing midnight,
single-night exceptions, generated sleep blocks and their completion state, wind-down generation,
and the sleep maths (time in bed, onset delay, awakenings, a null estimate when the onset is
unknown, and never returning a negative estimate).

`src/services/analytics/selectors.test.ts` — habit streaks that skip unscheduled days, "today is
still open" behaviour, best-streak runs after a gap, 28-day consistency, weighted checklist and
project progress, routine completion, and day rollups.

### Manual smoke test

1. **Persistence** — add a block, reload the page and confirm it is still there.
2. **Timer recovery** — start a study session, reload mid-session, confirm the elapsed time is
   correct.
3. **Recurrence** — create a weekday routine block, cancel one day, confirm the rest of the series
   is untouched.
4. **Midnight** — create a 23:00 → 07:00 sleep block or event and confirm it shows as one block and
   exports to `.ics` with a next-day end.
5. **Overlap warning** — schedule a study block over planned sleep and confirm the warning names
   sleep, and that saving requires the acknowledgement tick.
6. **Reminder deduplication** — allow notifications, set a reminder a minute ahead, and confirm you
   get exactly one notification even after reloading the page.
7. **Responsive layout** — check the sidebar collapse, the mobile drawer, the bottom tab bar, and
   the horizontal scrolling week grid and habit table on a phone viewport.
8. **Keyboard** — `Ctrl/Cmd + K` opens search, tab through a dialog, and confirm focus is visible
   everywhere.

---

## Deployment

The build is a static bundle with no server requirement.

```bash
npm run build
# upload the contents of dist/
```

### SPA routing

React Router uses history mode, so the host must serve `index.html` for unknown paths.

- **Netlify** — `public/_redirects` with `/* /index.html 200`.
- **Vercel** — a rewrite of `/(.*)` to `/index.html`.
- **GitHub Pages** — publish `dist/`; if you deploy to a subpath, set Vite's `base` accordingly and
  the manifest paths will follow.
- **Nginx** — `try_files $uri $uri/ /index.html;`

### HTTPS

Service workers, `Notification` permission and Web Push all require a **secure context**. `localhost`
is treated as secure for development; any real deployment needs HTTPS. A static host with automatic
TLS certificates is the simplest route.

### Cache headers

Serve `sw.js` with `Cache-Control: no-cache` (or a short max-age) so service-worker updates are
picked up. The hashed files under `assets/` are content-addressed and can be cached
immutably. `npm run serve:dist` demonstrates a correct minimal setup for local verification.

---

## Accessibility

- Semantic landmarks: a labelled `<nav>`, `<header>`, `<main>` and a `<table>` for the habit grid.
- Visible focus rings on every interactive element, driven by `:focus-visible`.
- Dialogs are real Radix dialogs, so focus trapping, `Escape` to close, `aria-modal` and labelled
  titles work as expected.
- Form fields are labelled; validation messages are tied to the field that failed.
- `aria-pressed` on toggle buttons, `aria-current="page"` on the active nav item, and `aria-label`s
  on icon-only buttons.
- Colour contrast was chosen so text on pastel chips uses a deeper variant of the same hue rather
  than the pastel itself.
- Touch targets are at least 32–44 px, and the mobile bottom bar respects `env(safe-area-inset-bottom)`.
- `prefers-reduced-motion: reduce` disables the floaty animations and smooth scrolling.

---

## Adding a backend or cloud sync later

The storage layer is already isolated behind one interface:

```
src/services/persistence/
  storage.ts        the Storage port (all reads/writes the app performs)
  base.ts           shared plumbing + the ChangeSink contract
  dexie-storage.ts  the local-first implementation
  index.ts          the factory the app calls (getStorage())
```

To add a backend:

1. Implement `Storage` against your API (e.g. `SupabaseStorage`).
2. Register it in `getStorage()` in `src/services/persistence/index.ts`.
3. Drain `changeLog` (or have the server write its own) to push local mutations, and apply
   last-write-wins per record using `updatedAt`.
4. Add authentication and server-side authorization. Records already carry stable uuid `id`s and
   `updatedAt` stamps precisely so they can be merged across devices without collisions.
5. Add server-side reminder scheduling and Web Push if you need closed-browser alerts.

No page component needs to change.

---

## Known limitations

These are deliberate, documented boundaries rather than unfinished work.

1. **Closed-browser reminders do not fire.** Explained in full above. The app is not an alarm clock.
2. **No accounts or cloud sync.** Data is per browser profile; clearing site data deletes it unless
   you have a backup. Changing browser or device means exporting and importing.
3. **The sleep-cycle estimator is an estimate.** 90-minute cycles are an average and the tool has no
   sensor data. It is a planning aid, not a medical device.
4. **Calendar import is not implemented.** Export to `.ics`, CSV and JSON is; importing an external
   `.ics` is not, and Google Calendar integration is not wired up (it would need an OAuth client and
   a server-side token exchange).
5. **Habit reminders are generated for the next 7 days.** A habit reminder further out appears once
   the horizon rolls forward, which happens automatically as you use the app.
6. **Recurrence exceptions are cancel-and-rebook.** Moving a single occurrence of a series stores a
   replacement block plus a cancel marker for the original day. It behaves correctly, but it means a
   moved occurrence is a standalone block that no longer follows later series edits.
7. **Month view renders up to three blocks per day cell** with a "+N more" indicator, in the
   interest of staying readable on a phone.
8. **One study session at a time.** Starting a second session while one is active is prevented
   rather than silently allowing overlapping timers.
9. **The `changeLog` grows unbounded.** It is currently unused, so nothing prunes it; a sync
   implementation should trim rows once they are acknowledged.

---

## Licence and credits

Built as a personal project for Anusree. The mascots, logo and icons are original inline SVG / SVG
artwork generated inside this repository, not third-party assets.
