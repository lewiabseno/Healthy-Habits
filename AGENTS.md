# Healthy Habits

A mobile-first fitness tracker web app for managing weekly workout plans, meal tracking, and grocery lists. Designed to work with Codex AI — the user gets a new weekly plan as JSON from Codex each week, imports it into the app, logs their workouts throughout the week, then exports the data back to Codex for the next week's programming.

## How It Works

1. **Each week**: User asks Codex to generate a weekly plan JSON (using the format in `JSON_FORMAT.md`)
2. **Import**: User pastes the JSON into the app via the Home tab's Import button
3. **During the week**: User logs workouts (weight/reps per set, RPE, daily notes), checks off meals, checks off grocery items, logs bodyweight and body fat
4. **End of week**: User clicks Export on the Home tab to copy week data to clipboard, pastes it into Codex
5. **Codex uses the export** to track progression and generate the next week's plan with appropriate weight increases

## Tech Stack

- **Vanilla HTML/CSS/JS** — no framework, no build step, no dependencies
- **ES Modules** — native browser module system, files import from each other
- **Chart.js** (CDN) — for progress charts on the dashboard
- **Cloudflare Pages** — static file hosting with auto-deploy from GitHub
- **Cloudflare D1** (SQLite) — cloud database for production data persistence
- **Cloudflare Pages Functions** — serverless API endpoints at `/api/*`
- **Cloudflare Access** — Zero Trust authentication (Google OAuth), protects the entire site

## Dual Mode

The app auto-detects its mode by checking if `/api/me` responds:

- **Demo mode** (local dev, no API): All data stored in localStorage. No auth required. Works by running `npx serve .` and opening `app.html`.
- **Production mode** (Cloudflare Pages with D1): Data stored in Cloudflare D1 SQLite. Cloudflare Access handles Google OAuth login. User identity from JWT header.

The `IS_PRODUCTION` flag from `js/config.js` controls all branching. Every feature has both a D1 path and a localStorage path.

## File Structure

```
index.html              Redirects to app.html
app.html                Main app shell. Content area, bottom tab bar, modals.
manifest.json           PWA manifest for Add to Home Screen
schema.sql              D1 database schema (SQLite)
wrangler.toml           Cloudflare config (D1 binding)
JSON_FORMAT.md          Complete specification of the weekly plan JSON format.
AGENTS.md               This file.

icons/
  icon.svg              App icon (blue with bar chart)

css/
  base.css              CSS variables, reset, typography, system font stack, hidden scrollbars
  layout.css            Tab bar, content area, day pills, section headers, week nav arrows,
                        inline week picker modal, scroll fade gradients
  components.css        Cards, badges, modals, buttons, inputs, exercise cards, meal cards,
                        grocery items, stretch items, rest timers, equipment badges, toasts,
                        RPE selector, day notes, home tab cards, body metrics widget
  dashboard.css         Chart containers, stat cards, range pills, exercise stat row,
                        inline stat headers, personal bests

js/
  config.js             Auto-detects production vs demo mode via /api/me
  auth.js               Cloudflare Access auth — reads user from JWT, signOut via Access logout
  state.js              Shared app state, date utilities, week picker HTML/nav, week switching
  router.js             Hash-based tab routing (#home, #workout, #meals, #dashboard)
  app.js                Entry point — detect mode, load weeks, init modules
  migrate.js            Versioned data migration system for localStorage schema changes

  home.js               Home tab — today's snapshot (workout/meals/weight), week management
                        (Next Week / This Week / Past Weeks), import button, per-week export
  import.js             Import modal — JSON validation, week creation, demo week management
  override.js           Single-day override modal — replace one day's workout or meals
  toast.js              Toast notification system

  workout.js            Workout tab — day pills with logged-data indicators, exercise cards
                        with expandable set logging, equipment-aware weight inputs,
                        warm-up/cool-down sub-tabs with checkable stretches, rest timers,
                        RPE rating per exercise, daily notes, completion tint,
                        previous week placeholders, replace day button
  meals.js              Meals tab — day pills with Prep pill (inline grocery checklist),
                        meal cards with expandable recipes, daily macro totals (planned vs eaten),
                        meal check-off, bodyweight + body fat input widgets, replace day button
  bodyweight.js         Bodyweight chart renderer (used by production dashboard)

  dashboard.js          Dashboard tab — bodyweight trend chart with time range pills
                        (1W/2W/1M/3M/6M/1Y/All), body fat trend chart with range pills,
                        exercise progression chart with inline stat + PB badge,
                        Robinhood-style charts (no dots, smooth lines, touch tooltips)
  api.js                All D1 API client functions using fetch('/api/...')
  weeks.js              Week loading from D1 for production mode

functions/
  api/
    _middleware.js       Auth middleware — extracts user ID from Cloudflare Access JWT
    me.js               GET /api/me — returns current user info
    weeks.js             GET/POST /api/weeks — list/create weeks
    week/[id].js         GET/PUT /api/week/:id — get/update single week
    workout-logs.js      GET/POST /api/workout-logs — load/upsert workout sets
    meal-checks.js       GET/POST /api/meal-checks — load/upsert meal checks
    grocery-checks.js    GET/POST /api/grocery-checks — load/upsert grocery checks
    bodyweight.js        GET/POST /api/bodyweight — load/upsert bodyweight
    bodyfat.js           GET/POST /api/bodyfat — load/upsert body fat
    rpe.js               GET/POST /api/rpe — load/upsert RPE ratings
    day-notes.js         GET/POST /api/day-notes — load/upsert daily notes
    stretch-checks.js    GET/POST /api/stretch-checks — load/upsert stretch completion
    dashboard.js         GET /api/dashboard — exercise names, progression, PBs, completion rates
```

## App Structure

### Four Tabs (bottom nav)

1. **Home** — Landing page and week management.
   - Today's snapshot: current workout, meals eaten, bodyweight + body fat
   - Weekly Plans section: Next Week, This Week, Past Weeks (collapsible)
   - Import Week button, per-week Export buttons
   - Snapshot cards link to Workout/Meals tabs

2. **Workout** — Daily workout logging.
   - Week nav arrows (prev/next) + tap label for month picker modal
   - Day pills scroll horizontally with green dot indicators for logged days
   - Daily notes textarea (energy, soreness, sleep)
   - Each exercise card expands to show set logging inputs (weight + reps)
   - Weight input labels adapt to equipment type (barbell/dumbbell/cable/machine/bodyweight)
   - Previous week's values shown as grayed italic placeholders
   - RPE selector (6-10 scale) per exercise
   - Completed exercises get a bright green tint
   - Warm-Up / Workout / Cool-Down sub-tabs with checkable stretches + progress bar
   - Rest timer info between sets and between exercises
   - Failure/AMRAP exercises show "to failure" placeholder
   - "Replace" button for single-day workout overrides

3. **Meals** — Daily meal tracking with integrated grocery list.
   - Week nav arrows (same as Workout tab)
   - **Prep pill** (before Mon) shows the grocery checklist inline
   - Bodyweight + body fat input widgets in the day header
   - Day pills show each day's meals with check-off functionality
   - Daily totals card shows planned vs eaten macros (cal, protein, carbs, fat)
   - Meals with a `recipe` field have an expandable recipe view
   - "Replace" button for single-day meal overrides (doesn't affect grocery list)

4. **Dashboard** — Progress tracking across weeks.
   - Bodyweight trend chart with time range pills (1W/2W/1M/3M/6M/1Y/All)
   - Body fat trend chart with time range pills
   - Exercise progression chart with dropdown selector
   - Inline stat: current max weight + week-over-week change + PB badge
   - Robinhood-style charts (no dots, smooth curves, touch tooltips, axis labels)
   - Charts always end at today's date

### Data Flow

```
Codex generates JSON → User imports on Home tab → App stores in D1/localStorage
                                                         ↓
User logs workouts (weight/reps/RPE/notes) ←→ D1/localStorage
User checks off meals                     ←→ D1/localStorage
User checks off grocery items              ←→ D1/localStorage
User logs bodyweight + body fat            ←→ D1/localStorage
User checks off warmup/cooldown stretches  ←→ D1/localStorage
                                                         ↓
User clicks Export on Home tab → JSON copied to clipboard → User pastes into Codex → Next week
```

## JSON Format

See `JSON_FORMAT.md` for the complete specification. Key points:

- `weekStart` must be a Monday in YYYY-MM-DD format
- Exercise `name` must be consistent across weeks for progress tracking (case-insensitive matching)
- `equipment` field determines weight input behavior (barbell, dumbbell, cable, cable-single, machine, machine-single, bodyweight)
- `warmup`/`cooldown` arrays on workout days enable stretch sub-tabs
- `recipe` object on meals enables expandable recipe view
- `tip` field on workout days shows a general daily tip (not exercise-specific)
- `restBetweenSets` and `restBetweenExercises` fields show rest timer info
- `reps` field supports "AMRAP" and "failure" for to-failure sets
- Single-day overrides use the same structure but without `day`/`dayName`

## Export Format

The export JSON includes:
- **Body metrics**: current weight, body fat, weekly changes, daily logs
- **Workout summary**: per-day exercises with logged weight/reps per set, RPE ratings, daily notes
- **Warmup/cooldown**: stretch completion status
- **Meal summary**: per-day eaten/skipped meals with calories and protein totals

## D1 Database Schema (Production)

Tables: `weekly_plans`, `workout_logs`, `meal_checks`, `grocery_checks`, `bodyweight_logs`, `bodyfat_logs`, `rpe_logs`, `day_notes`, `stretch_checks`

- All data scoped to `user_id` (from Cloudflare Access JWT email)
- `weekly_plans.plan_data` stores the full JSON as TEXT
- `workout_logs` has a denormalized `exercise_name` column for dashboard queries
- All log tables use upsert with unique constraints for idempotent writes
- See `schema.sql` for full schema

## Data Migration System

The app uses a versioned migration system (`js/migrate.js`) for localStorage schema changes in demo mode.

**How to add a migration:**
1. Increment `DATA_VERSION` in `migrate.js`
2. Add a function to the `migrations` object keyed by the new version number
3. The function reads old data, transforms it, and writes it back

**Never:**
- Change the meaning of an existing localStorage key without a migration
- Delete a key that existing code reads without a migration
- Change the structure of `hh-weeks` entries without migrating

## localStorage Schema (Demo Mode)

| Key | Format | Description |
|-----|--------|-------------|
| `hh-data-version` | integer | Current data schema version |
| `hh-weeks` | `[{ id, weekStart, label, planData }]` | All imported weekly plans |
| `hh-workout-logs` | `{ "planId_dayIdx": { exIdx: { setIdx: { weight, reps } } } }` | Set-level workout data |
| `hh-meal-checks` | `{ "planId_dayIdx": { mealKey: boolean } }` | Per-day meal check-offs |
| `hh-grocery-checks` | `{ "planId": { "category_itemIdx": boolean } }` | Per-week grocery checks |
| `hh-stretch-checks` | `{ "planId_dayIdx_type_stretchIdx": boolean }` | Warmup/cooldown completion |
| `hh-rpe` | `{ "planId_dayIdx_rpe_exIdx": string }` | RPE rating per exercise |
| `hh-day-notes` | `{ "planId_dayIdx_notes": string }` | Daily user notes |
| `hh-bodyweight` | `[{ date, weight }]` | Bodyweight log entries |
| `hh-bodyfat` | `[{ date, value }]` | Body fat % log entries |

## Deployment

**Hosting**: Cloudflare Pages (auto-deploy from GitHub `master` branch)
**Database**: Cloudflare D1 (`healthy-habits`, binding name `DB`)
**Auth**: Cloudflare Access (Zero Trust, Google OAuth, restricted to one email)
**URL**: healthy-habits.pages.dev

## Key Conventions

- All dates use Monday as day 0 through Sunday as day 6
- Week labels auto-generate as "Month Day - Month Day" (e.g. "March 30 - April 5")
- The app auto-selects the current calendar week on load
- Meal plans are the same every day of the week unless overridden per-day via `mealOverrides`
- Grocery list is per-week (not per-day), accessible via the Prep pill in the Meals tab
- `IS_PRODUCTION` from `config.js` controls all demo/production branching
- Every feature must have both a D1 API path and a localStorage fallback path
- Exercise names are compared case-insensitively for progress tracking
- Scrollbars are hidden globally for native iOS feel
- All touch targets are minimum 44px for mobile usability
