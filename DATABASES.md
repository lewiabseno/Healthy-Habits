# Database Schema

Healthy Habits uses two storage backends depending on the mode:

- **Production**: Cloudflare D1 (SQLite) — 9 tables, all queries via `/api/*` endpoints
- **Demo**: Browser localStorage — 10 keys, all access via direct JS

Both store the same logical data. The production schema is the source of truth.

---

## D1 Schema (Production)

All tables use `user_id TEXT` scoped to the authenticated user (from Cloudflare Access JWT email). IDs are 32-char random hex strings. Plan-linked tables use `ON DELETE CASCADE` foreign keys.

See `schema.sql` for the full CREATE statements.

### weekly_plans

Stores the imported weekly plan JSON. One row per user per week.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Random hex ID |
| `user_id` | TEXT | User email from Access JWT |
| `week_start` | TEXT | Monday date `YYYY-MM-DD` |
| `label` | TEXT | Display label (e.g., "March 30 - April 5") |
| `plan_data` | TEXT | Full plan JSON (workouts, meals, grocery) |
| `created_at` | TEXT | ISO timestamp |

**Unique**: `(user_id, week_start)` — one plan per user per week, upsert on conflict.

**Notes**: `plan_data` stores the entire imported JSON as a TEXT blob. This avoids normalizing the flexible nested structure (workouts → exercises → sets, meals, grocery categories). The plan is always loaded as a whole unit.

---

### workout_logs

One row per set logged. Denormalized `exercise_name` for dashboard queries.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Random hex ID |
| `user_id` | TEXT | User email |
| `plan_id` | TEXT FK | References `weekly_plans(id)` |
| `day_index` | INTEGER | 0=Mon through 6=Sun |
| `exercise_index` | INTEGER | Position in the day's exercise list |
| `set_index` | INTEGER | Set number (0-based) |
| `exercise_name` | TEXT | Denormalized name for dashboard GROUP BY |
| `weight` | REAL | Weight lifted (nullable if not yet logged) |
| `reps` | INTEGER | Reps performed (nullable) |
| `logged_at` | TEXT | ISO timestamp |

**Unique**: `(user_id, plan_id, day_index, exercise_index, set_index)` — upsert on conflict.

**Why denormalize exercise_name?** Without it, dashboard queries would need to JOIN with `weekly_plans` and parse the JSONB `plan_data` to find exercise names. Storing it directly enables simple `GROUP BY exercise_name`.

---

### meal_checks

Tracks which meals were eaten each day.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Random hex ID |
| `user_id` | TEXT | User email |
| `plan_id` | TEXT FK | References `weekly_plans(id)` |
| `meal_key` | TEXT | Slot name (e.g., "breakfast", "snack1", "lunch") |
| `day_index` | INTEGER | 0=Mon through 6=Sun |
| `checked` | INTEGER | 0=not eaten, 1=eaten |

**Unique**: `(user_id, plan_id, meal_key, day_index)` — upsert on conflict.

**Notes**: Meals are the same every day unless overridden via `mealOverrides` in the plan JSON. Checks are per-day to track daily adherence.

---

### grocery_checks

Tracks which grocery items were bought. Per-week, not per-day.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Random hex ID |
| `user_id` | TEXT | User email |
| `plan_id` | TEXT FK | References `weekly_plans(id)` |
| `category` | TEXT | Category name (e.g., "Produce", "Protein") |
| `item_index` | INTEGER | Position in the category's item array |
| `checked` | INTEGER | 0=not bought, 1=bought |

**Unique**: `(user_id, plan_id, category, item_index)` — upsert on conflict.

---

### bodyweight_logs

Daily bodyweight entries.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Random hex ID |
| `user_id` | TEXT | User email |
| `recorded_date` | TEXT | Date `YYYY-MM-DD` |
| `weight` | REAL | Weight value (validated 1-999) |
| `unit` | TEXT | `lbs` or `kg` (whitelisted) |

**Unique**: `(user_id, recorded_date)` — one entry per user per day, upsert on conflict.

---

### bodyfat_logs

Daily body fat percentage entries.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Random hex ID |
| `user_id` | TEXT | User email |
| `recorded_date` | TEXT | Date `YYYY-MM-DD` |
| `value` | REAL | Body fat % (validated 1-60) |

**Unique**: `(user_id, recorded_date)` — one entry per user per day, upsert on conflict.

---

### rpe_logs

Rate of Perceived Exertion per exercise.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Random hex ID |
| `user_id` | TEXT | User email |
| `plan_id` | TEXT FK | References `weekly_plans(id)` |
| `day_index` | INTEGER | 0=Mon through 6=Sun |
| `exercise_index` | INTEGER | Position in the day's exercise list |
| `rpe` | TEXT | RPE value (whitelisted: "", "6", "6.5"..."10") |

**Unique**: `(user_id, plan_id, day_index, exercise_index)` — upsert on conflict.

---

### day_notes

Free-text daily notes (energy, soreness, sleep quality).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Random hex ID |
| `user_id` | TEXT | User email |
| `plan_id` | TEXT FK | References `weekly_plans(id)` |
| `day_index` | INTEGER | 0=Mon through 6=Sun |
| `notes` | TEXT | User notes (max 2000 chars) |

**Unique**: `(user_id, plan_id, day_index)` — upsert on conflict.

---

### stretch_checks

Tracks warm-up and cool-down stretch completion.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Random hex ID |
| `user_id` | TEXT | User email |
| `plan_id` | TEXT FK | References `weekly_plans(id)` |
| `day_index` | INTEGER | 0=Mon through 6=Sun |
| `stretch_type` | TEXT | `warmup` or `cooldown` |
| `stretch_index` | INTEGER | Position in the stretch array |
| `checked` | INTEGER | 0=not done, 1=done |

**Unique**: `(user_id, plan_id, day_index, stretch_type, stretch_index)` — upsert on conflict.

---

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_plans_user` | weekly_plans | `(user_id, week_start DESC)` | Fast week listing per user |
| `idx_logs_plan` | workout_logs | `(plan_id, day_index)` | Load day's sets quickly |
| `idx_logs_exercise` | workout_logs | `(user_id, exercise_name)` | Dashboard progression queries |
| `idx_meals_plan` | meal_checks | `(plan_id, day_index)` | Load day's meal checks |
| `idx_grocery_plan` | grocery_checks | `(plan_id)` | Load week's grocery checks |
| `idx_bw_user` | bodyweight_logs | `(user_id, recorded_date DESC)` | Bodyweight trend chart |
| `idx_bf_user` | bodyfat_logs | `(user_id, recorded_date DESC)` | Body fat trend chart |

---

## localStorage Schema (Demo Mode)

All keys prefixed with `hh-`. Data is per-device, not synced.

| Key | Type | Description |
|-----|------|-------------|
| `hh-data-version` | integer | Migration system version number |
| `hh-weeks` | JSON array | `[{ id, weekStart, label, planData }]` |
| `hh-workout-logs` | JSON object | `{ "planId_dayIdx": { exIdx: { setIdx: { weight, reps } } } }` |
| `hh-meal-checks` | JSON object | `{ "planId_dayIdx": { mealKey: boolean } }` |
| `hh-grocery-checks` | JSON object | `{ "planId": { "category_itemIdx": boolean } }` |
| `hh-stretch-checks` | JSON object | `{ "planId_dayIdx_type_stretchIdx": boolean }` |
| `hh-rpe` | JSON object | `{ "planId_dayIdx_rpe_exIdx": string }` |
| `hh-day-notes` | JSON object | `{ "planId_dayIdx_notes": string }` |
| `hh-bodyweight` | JSON array | `[{ date, weight }]` |
| `hh-bodyfat` | JSON array | `[{ date, value }]` |

---

## Key Design Decisions

**JSONB for plan_data**: Plans have a flexible, nested structure (workouts → exercises, meals, grocery categories). Normalizing into rigid tables would complicate imports and require schema migrations when the plan format evolves. The JSON column stores the full plan; only log tables are normalized for cross-week aggregation.

**Denormalized exercise_name**: Enables `GROUP BY exercise_name` for dashboard charts without joining and parsing plan JSON. Written at insert time from the plan data.

**Upsert pattern**: Every write uses `INSERT ... ON CONFLICT ... DO UPDATE`. The UI never checks if a row exists first — it just sends the current state. This makes all writes idempotent.

**Composite unique constraints**: Natural keys (user + plan + day + exercise + set) prevent duplicate rows and serve as the upsert conflict target.

**ON DELETE CASCADE**: When a weekly plan is deleted, all associated logs, checks, notes, and RPE data are automatically cleaned up.

---

## Adding New Tables

When adding a new table:

1. Add `CREATE TABLE` to `schema.sql` with `IF NOT EXISTS`
2. Add a new API endpoint in `functions/api/`
3. Add client functions in `js/api.js`
4. Add localStorage fallback in the relevant frontend module
5. Run the new CREATE TABLE on D1 via the console
6. Update this document
