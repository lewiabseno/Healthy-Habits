const MEAL_MACRO_LIMITS = {
  calories: { min: 0, max: 10000 },
  protein: { min: 0, max: 1000 },
  carbs: { min: 0, max: 1000 },
  fat: { min: 0, max: 1000 },
};

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateMacroFields(meal, path) {
  for (const [macro, limits] of Object.entries(MEAL_MACRO_LIMITS)) {
    const value = meal[macro];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < limits.min || value > limits.max) {
      return `${path}.${macro} must be a number between ${limits.min} and ${limits.max}`;
    }
  }
  return null;
}

export function validateMealCollection(meals, path = 'meals', requireAtLeastOne = true) {
  if (!isPlainObject(meals)) return `${path} must be an object`;

  const entries = Object.entries(meals);
  if (requireAtLeastOne && entries.length === 0) return `${path} must have at least one key`;

  for (const [key, meal] of entries) {
    if (!isPlainObject(meal)) return `${path}.${key} must be an object`;
    if (!meal.name || typeof meal.name !== 'string') return `${path}.${key}.name is required`;
    const macroErr = validateMacroFields(meal, `${path}.${key}`);
    if (macroErr) return macroErr;
  }

  return null;
}

export function validateMealOverrides(overrides, path = 'mealOverrides') {
  if (overrides === undefined) return null;
  if (!isPlainObject(overrides)) return `${path} must be an object`;

  for (const [dayKey, meals] of Object.entries(overrides)) {
    const dayIndex = Number(dayKey);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
      return `${path}.${dayKey} must use day indexes 0-6`;
    }
    const mealErr = validateMealCollection(meals, `${path}.${dayKey}`);
    if (mealErr) return mealErr;
  }

  return null;
}
