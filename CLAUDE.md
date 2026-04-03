# Healthy Habits

A mobile-first fitness tracker web app for managing weekly workout plans, meal tracking, and grocery lists. Designed to work with Claude AI — the user gets a new weekly plan as JSON from Claude each week, imports it into the app, logs their workouts throughout the week, then exports the data back to Claude for the next week's programming.

## How It Works

1. **Each week**: User asks Claude to generate a weekly plan JSON (using the format in `JSON_FORMAT.md`)
2. **Import**: User pastes the JSON into the app via the Import button
3. **During the week**: User logs workouts (weight/reps per set), checks off meals, checks off grocery items
4. **End of week**: User clicks Export to copy workout data to clipboard, pastes it into Claude
5. **Claude uses the export** to track progression and generate the next week's plan with appropriate weight increases

## Tech Stack

- **Vanilla HTML/CSS/JS** — no framework, no build step, no dependencies
- **ES Modules** — native browser module system, files import from each other
- **Chart.js** (CDN) — for progress charts on the dashboard
- **Supabase** (CDN, optional) — for cloud database + auth when deployed
- **Netlify** — static file hosting

## Dual Mode

The app runs in two modes based on whether Supabase is configured in `js/config.js`:

- **Demo mode** (`config.js` has placeholder values): All data stored in localStorage. No auth required. Works by opening `app.html` directly or via any static server.
- **Production mode** (`config.js` has real Supabase credentials): Data stored in Supabase PostgreSQL. Google OAuth or email magic link auth required. Login page at `index.html`, app at `app.html`.

## File Structure

```
index.html              Login page (Google OAuth + email magic link). Redirects to app.html in demo mode.
app.html                Main app shell. Top bar, content area, bottom tab bar, modals.
netlify.toml            Netlify redirects and security headers.
JSON_FORMAT.md          Complete specification of the weekly plan JSON format.
CLAUDE.md               This file.

css/
  base.css              CSS variables, reset, typography, system font stack
  layout.css            Top bar, tab bar, content area, day pills, login page layout
  components.css        Cards, badges, modals, buttons, inputs, exercise cards, meal cards,
                        grocery items, stretch items, rest timers, equipment badges, toasts
  dashboard.css         Chart containers, stat cards, personal bests grid, bodyweight widget

js/
  config.js             Supabase URL + anon key constants (placeholder by default)
  supabase.js           Initializes the Supabase client from config
  auth.js               Login/logout handlers, session guard, magic link + Google OAuth
  state.js              Shared app state object + date utility functions
  router.js             Hash-based tab routing (#workout, #meals, #dashboard)
  app.js                Entry point — auth guard, init modules, load weeks

  weeks.js              Week picker dropdown, load/switch weeks from Supabase or localStorage
  import.js             Import modal — JSON validation, week creation, demo week management
  export.js             Export button — copies workout log data as JSON to clipboard
  override.js           Single-day override modal — replace one day's workout or meals
  toast.js              Toast notification system

  workout.js            Workout tab — day pills, exercise cards with expandable set logging,
                        equipment-aware weight inputs, warm-up/cool-down sub-tabs with
                        checkable stretches, rest timers, completion tint, replace day button
  meals.js              Meals tab — day pills with Prep pill (inline grocery checklist),
                        meal cards with expandable recipes, daily macro totals (planned vs eaten),
                        meal check-off, replace day button
  grocery.js            Standalone grocery module (currently unused — grocery is inline in meals.js
                        via the Prep pill, but this file remains for potential Supabase mode use)

  dashboard.js          Dashboard tab — exercise progression charts, personal bests grid,
                        workout completion rates, meal adherence rates (bar charts)
  bodyweight.js         Bodyweight logging widget + trend chart (used by dashboard)
  api.js                All Supabase CRUD functions — weekly plans, workout logs, meal checks,
                        grocery checks, bodyweight logs, dashboard queries
```

## App Structure

### Three Tabs (bottom nav)

1. **Workout** — The main tab. Shows the selected day's workout with exercises.
   - Day pills scroll horizontally, auto-selects today
   - Each exercise card expands to show set logging inputs (weight + reps)
   - Weight input labels adapt to equipment type (barbell → "bar total", dumbbell → "per DB", cable-single → "per arm", etc.)
   - Completed exercises get a green tint
   - Warm-Up / Workout / Cool-Down sub-tabs appear when stretch data exists
   - Stretches are checkable with a progress bar
   - Rest timer info shows between sets and between exercises
   - "Replace" button allows importing a single-day workout override

2. **Meals** — Daily meal tracking with an integrated grocery list.
   - **Prep pill** (before Mon) shows the grocery checklist inline — no separate grocery tab
   - Day pills show each day's meals with check-off functionality
   - Each meal shows macros (cal, protein, carbs, fat)
   - Daily totals card shows planned vs eaten macros
   - Meals with a `recipe` field have an expandable recipe view (ingredients, instructions, prep/cook time)
   - "Replace" button allows importing single-day meal overrides (doesn't affect grocery list)

3. **Dashboard** — Progress tracking across weeks.
   - Bodyweight logging widget + trend chart
   - Exercise progression chart (select exercise from dropdown, see max weight over weeks)
   - Personal bests grid
   - Workout completion rate (bar chart, last 8 weeks)
   - Meal adherence rate (bar chart, last 8 weeks)

### Top Bar

- App title
- Week picker dropdown (shows date range like "March 30 - April 5")
- Export button (copies week's workout data as JSON to clipboard)
- Import button (opens modal to paste a full week JSON)
- Logout button (hidden in demo mode)

### Data Flow

```
Claude generates JSON → User pastes into Import → App stores in Supabase/localStorage
                                                         ↓
User logs workouts (weight/reps) ←→ Supabase/localStorage
User checks off meals            ←→ Supabase/localStorage
User checks off grocery items    ←→ Supabase/localStorage
                                                         ↓
User clicks Export → JSON copied to clipboard → User pastes into Claude → Next week's plan
```

## JSON Format

See `JSON_FORMAT.md` for the complete specification. Key points:

- `weekStart` must be a Monday in YYYY-MM-DD format
- Exercise `name` must be consistent across weeks for progress tracking
- `equipment` field determines weight input behavior (barbell, dumbbell, cable, cable-single, machine, machine-single, bodyweight)
- `warmup`/`cooldown` arrays on workout days enable stretch sub-tabs
- `recipe` object on meals enables expandable recipe view
- `tip` field on workout days shows a general daily tip (not exercise-specific)
- Single-day overrides use the same structure but without `day`/`dayName`

## Supabase Schema (for production)

Tables: `weekly_plans`, `workout_logs`, `meal_checks`, `grocery_checks`, `bodyweight_logs`

- All tables use Row Level Security (RLS) scoped to `auth.uid() = user_id`
- `weekly_plans.plan_data` stores the full JSON as JSONB
- `workout_logs` has a denormalized `exercise_name` column for dashboard queries
- All log tables use upsert with unique constraints for idempotent writes
- RPC function `get_personal_bests(p_user_id)` for the dashboard

## Data Migration System

The app uses a versioned migration system (`js/migrate.js`) to safely evolve the localStorage schema without breaking existing user data.

**How it works:**
1. `DATA_VERSION` constant tracks the current schema version
2. On app load, `runMigrations()` compares stored version to current
3. If behind, runs each migration function sequentially (v1→v2→v3...)
4. If a migration fails, it stops and retries next load
5. Version stored in `hh-data-version` localStorage key

**When to add a migration:**
- Renaming a localStorage key
- Changing the structure of stored data
- Adding required fields to existing data
- Merging or splitting storage keys

**How to add a migration:**
1. Increment `DATA_VERSION` in `migrate.js`
2. Add a function to the `migrations` object keyed by the new version number
3. The function should read old data, transform it, and write it back

**Never:**
- Change the meaning of an existing localStorage key without a migration
- Delete a key that existing code reads without a migration to move the data
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

## Key Conventions

- All dates use Monday as day 0 through Sunday as day 6
- Week labels auto-generate as "Month Day - Month Day" (e.g. "March 30 - April 5")
- The app auto-selects today's day on load
- Meal plans are the same every day of the week unless overridden per-day via `mealOverrides`
- Grocery list is per-week (not per-day), accessible via the Prep pill in the Meals tab
