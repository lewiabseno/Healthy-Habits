// Smart validation: classifies issues into blocking errors vs non-blocking warnings.
// Mode-aware: skips sections not being imported.

import { validateMealCollection, validateMealOverrides } from './plan-validation.js';

const KNOWN_TOP_KEYS = new Set([
  'weekStart', 'weekLabel', 'workouts', 'meals', 'mealOverrides', 'grocery',
]);

export function validateSmart(json, mode = 'full') {
  const errors = [];
  const warnings = [];

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    errors.push('Input must be a JSON object');
    return { errors, warnings };
  }

  // Unknown top-level keys → warnings
  for (const key of Object.keys(json)) {
    if (!KNOWN_TOP_KEYS.has(key)) {
      warnings.push(`Unknown top-level key '${key}' will be ignored`);
    }
  }

  // weekStart always required
  if (typeof json.weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(json.weekStart)) {
    errors.push('weekStart must be a date in YYYY-MM-DD format');
  } else {
    const d = new Date(json.weekStart + 'T12:00:00');
    if (d.getDay() !== 1) {
      errors.push('weekStart must be a Monday');
    }
  }

  // Workouts validation (only if importing workouts or full)
  if (mode === 'full' || mode === 'workouts') {
    if (!Array.isArray(json.workouts) || json.workouts.length === 0) {
      errors.push('workouts must be a non-empty array');
    } else {
      const seenDays = new Set();
      for (let i = 0; i < json.workouts.length; i++) {
        const w = json.workouts[i];
        const p = `workouts[${i}]`;

        if (typeof w.day !== 'number' || !Number.isInteger(w.day) || w.day < 0 || w.day > 6) {
          errors.push(`${p}.day must be an integer 0-6`);
        } else if (seenDays.has(w.day)) {
          errors.push(`${p}.day ${w.day} is a duplicate (already used by another workout)`);
        } else {
          seenDays.add(w.day);
        }

        if (!w.title || typeof w.title !== 'string') {
          errors.push(`${p}.title is required`);
        }

        if (!Array.isArray(w.exercises)) {
          errors.push(`${p}.exercises must be an array`);
        } else {
          for (let j = 0; j < w.exercises.length; j++) {
            const ex = w.exercises[j];
            const ep = `${p}.exercises[${j}]`;
            if (!ex.name || typeof ex.name !== 'string') errors.push(`${ep}.name is required`);
            if (typeof ex.sets !== 'number' || ex.sets < 1) errors.push(`${ep}.sets must be a number >= 1`);
            if (!ex.reps || typeof ex.reps !== 'string') errors.push(`${ep}.reps is required (string)`);
            if (ex.sets > 20) warnings.push(`${ep}.sets is ${ex.sets} — unusually high`);
          }
        }

        // Warnings for missing optional workout fields
        if (!w.warmup || w.warmup.length === 0) {
          warnings.push(`${p} has no warmup exercises`);
        }
        if (!w.cooldown || w.cooldown.length === 0) {
          warnings.push(`${p} has no cooldown exercises`);
        }
      }
    }
  }

  // Meals validation (only if importing meals or full)
  if (mode === 'full' || mode === 'meals') {
    if (!json.meals || typeof json.meals !== 'object' || Object.keys(json.meals).length === 0) {
      errors.push('meals must be an object with at least one meal');
    } else {
      const mealErr = validateMealCollection(json.meals, 'meals');
      if (mealErr) errors.push(mealErr);

      // Warnings for missing macros
      for (const [key, meal] of Object.entries(json.meals)) {
        if (meal && typeof meal === 'object') {
          if (meal.calories === undefined) warnings.push(`meals.${key} has no calorie data`);
          if (meal.protein === undefined) warnings.push(`meals.${key} has no protein data`);
        }
      }
    }

    if (json.mealOverrides !== undefined) {
      const overrideErr = validateMealOverrides(json.mealOverrides, 'mealOverrides');
      if (overrideErr) errors.push(overrideErr);
    }
  }

  // Grocery validation (only if importing grocery or full)
  if (mode === 'full' || mode === 'grocery') {
    if (!json.grocery || typeof json.grocery !== 'object' || Object.keys(json.grocery).length === 0) {
      errors.push('grocery must be an object with at least one category');
    } else {
      for (const [cat, items] of Object.entries(json.grocery)) {
        if (!Array.isArray(items)) {
          errors.push(`grocery.${cat} must be an array`);
        } else if (items.length === 0) {
          warnings.push(`grocery.${cat} is empty`);
        }
      }
    }
  }

  return { errors, warnings };
}
