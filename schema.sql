-- Healthy Habits D1 Schema (SQLite)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_plans (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  label TEXT,
  plan_data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, week_start)
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  exercise_index INTEGER NOT NULL,
  set_index INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  weight REAL,
  reps INTEGER,
  logged_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, plan_id, day_index, exercise_index, set_index)
);

CREATE TABLE IF NOT EXISTS meal_checks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  meal_key TEXT NOT NULL,
  day_index INTEGER NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, plan_id, meal_key, day_index)
);

CREATE TABLE IF NOT EXISTS grocery_checks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_index INTEGER NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, plan_id, category, item_index)
);

CREATE TABLE IF NOT EXISTS bodyweight_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  recorded_date TEXT NOT NULL,
  weight REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'lbs',
  UNIQUE(user_id, recorded_date)
);

CREATE TABLE IF NOT EXISTS bodyfat_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  recorded_date TEXT NOT NULL,
  value REAL NOT NULL,
  UNIQUE(user_id, recorded_date)
);

CREATE TABLE IF NOT EXISTS rpe_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  exercise_index INTEGER NOT NULL,
  rpe TEXT NOT NULL,
  UNIQUE(user_id, plan_id, day_index, exercise_index)
);

CREATE TABLE IF NOT EXISTS day_notes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE(user_id, plan_id, day_index)
);

CREATE TABLE IF NOT EXISTS stretch_checks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  stretch_type TEXT NOT NULL,
  stretch_index INTEGER NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, plan_id, day_index, stretch_type, stretch_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plans_user ON weekly_plans(user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_logs_plan ON workout_logs(plan_id, day_index);
CREATE INDEX IF NOT EXISTS idx_logs_exercise ON workout_logs(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_meals_plan ON meal_checks(plan_id, day_index);
CREATE INDEX IF NOT EXISTS idx_grocery_plan ON grocery_checks(plan_id);
CREATE INDEX IF NOT EXISTS idx_bw_user ON bodyweight_logs(user_id, recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_bf_user ON bodyfat_logs(user_id, recorded_date DESC);
