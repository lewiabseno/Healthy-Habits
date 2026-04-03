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
