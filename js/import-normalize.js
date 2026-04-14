// Safe, deterministic normalization of imported plan JSON.
// Never guesses ambiguous structure or invents missing data.

const TOP_LEVEL_ALIASES = {
  week_start: 'weekStart',
  weekstart: 'weekStart',
  meal_overrides: 'mealOverrides',
  mealoverrides: 'mealOverrides',
  week_label: 'weekLabel',
  weeklabel: 'weekLabel',
};

const MEAL_MACRO_FIELDS = ['calories', 'protein', 'carbs', 'fat'];

export function normalize(raw) {
  const normalized = structuredClone(raw);
  const repairs = [];

  // 1. Map top-level key aliases
  for (const [alias, canonical] of Object.entries(TOP_LEVEL_ALIASES)) {
    if (normalized[alias] !== undefined && normalized[canonical] === undefined) {
      normalized[canonical] = normalized[alias];
      delete normalized[alias];
      repairs.push(`Mapped '${alias}' \u2192 '${canonical}'`);
    }
  }

  // 2. Trim all strings recursively
  trimStrings(normalized, '', repairs);

  // 3. Convert numeric strings to numbers where safe
  if (Array.isArray(normalized.workouts)) {
    normalized.workouts.forEach((w, wi) => {
      if (!Array.isArray(w.exercises)) return;
      w.exercises.forEach((ex, ei) => {
        if (typeof ex.sets === 'string') {
          const n = Number(ex.sets);
          if (Number.isInteger(n) && n >= 1) {
            ex.sets = n;
            repairs.push(`Converted workouts[${wi}].exercises[${ei}].sets from string '${ex.sets}' to number ${n}`);
          }
        }
      });
    });
  }

  // Convert meal macro strings to numbers
  if (normalized.meals && typeof normalized.meals === 'object') {
    for (const [key, meal] of Object.entries(normalized.meals)) {
      if (!meal || typeof meal !== 'object') continue;
      for (const field of MEAL_MACRO_FIELDS) {
        if (typeof meal[field] === 'string') {
          const n = Number(meal[field]);
          if (Number.isFinite(n) && n >= 0) {
            const original = meal[field];
            meal[field] = n;
            repairs.push(`Converted meals.${key}.${field} from string '${original}' to number ${n}`);
          }
        }
      }
    }
  }

  // 4. Default missing optional structures on workouts
  if (Array.isArray(normalized.workouts)) {
    normalized.workouts.forEach((w, wi) => {
      if (w.warmup === undefined) {
        w.warmup = [];
        repairs.push(`Added default empty warmup to workouts[${wi}]`);
      }
      if (w.cooldown === undefined) {
        w.cooldown = [];
        repairs.push(`Added default empty cooldown to workouts[${wi}]`);
      }
    });
  }

  return { normalized, repairs };
}

function trimStrings(obj, path, repairs) {
  if (obj == null || typeof obj !== 'object') return;
  const entries = Array.isArray(obj) ? obj.map((v, i) => [i, v]) : Object.entries(obj);
  for (const [key, value] of entries) {
    const currentPath = path ? `${path}.${key}` : String(key);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== value) {
        obj[key] = trimmed;
        repairs.push(`Trimmed whitespace from ${currentPath}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      trimStrings(value, currentPath, repairs);
    }
  }
}
