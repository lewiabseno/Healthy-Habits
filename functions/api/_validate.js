// Shared validation + authorization helpers for API endpoints

export function badRequest(msg) {
  return Response.json({ error: msg }, { status: 400 });
}

export function notFound(msg = 'Not found') {
  return Response.json({ error: msg }, { status: 404 });
}

// Verify a plan belongs to the requesting user
export async function verifyPlanOwnership(env, planId, userId) {
  if (!planId || typeof planId !== 'string' || planId.length > 64) return false;
  const row = await env.DB.prepare(
    'SELECT id FROM weekly_plans WHERE id = ? AND user_id = ?'
  ).bind(planId, userId).first();
  return !!row;
}

// Validate common field types
export function validateInt(val, min = 0, max = 9999) {
  return typeof val === 'number' && Number.isInteger(val) && val >= min && val <= max;
}

export function validateNum(val, min = 0, max = 99999) {
  return typeof val === 'number' && isFinite(val) && val >= min && val <= max;
}

export function validateStr(val, maxLen = 255) {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
}

export function validateDate(val) {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

const MEAL_MACRO_LIMITS = {
  calories: { min: 0, max: 10000 },
  protein: { min: 0, max: 1000 },
  carbs: { min: 0, max: 1000 },
  fat: { min: 0, max: 1000 },
};

export function validateMealCollection(meals, path = 'meals', requireAtLeastOne = true) {
  if (!meals || typeof meals !== 'object' || Array.isArray(meals)) {
    return `${path} must be an object`;
  }

  const entries = Object.entries(meals);
  if (requireAtLeastOne && entries.length === 0) {
    return `${path} must have at least one key`;
  }

  for (const [key, meal] of entries) {
    if (!meal || typeof meal !== 'object' || Array.isArray(meal)) {
      return `${path}.${key} must be an object`;
    }
    if (!validateStr(meal.name, 255)) {
      return `${path}.${key}.name is required`;
    }

    for (const [macro, limits] of Object.entries(MEAL_MACRO_LIMITS)) {
      const value = meal[macro];
      if (value === undefined || value === null) continue;
      if (!validateNum(value, limits.min, limits.max)) {
        return `${path}.${key}.${macro} must be a number between ${limits.min} and ${limits.max}`;
      }
    }
  }

  return null;
}

export function validateMealOverrides(overrides, path = 'mealOverrides') {
  if (overrides === undefined) return null;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return `${path} must be an object`;
  }

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

export function validateWeekPlan(planData, path = 'planData') {
  if (!planData || typeof planData !== 'object' || Array.isArray(planData)) {
    return `${path} must be an object`;
  }

  const mealErr = validateMealCollection(planData.meals, `${path}.meals`);
  if (mealErr) return mealErr;

  const overrideErr = validateMealOverrides(planData.mealOverrides, `${path}.mealOverrides`);
  if (overrideErr) return overrideErr;

  return null;
}
