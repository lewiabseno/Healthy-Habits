import { badRequest, validateStr, validateDate } from './_validate.js';
const json = (data, status = 200) => Response.json(data, { status });

const MAX_PLAN_SIZE = 100 * 1024; // 100KB max for plan JSON

export async function onRequestGet(context) {
  const { env, data: { userId } } = context;
  const { results } = await env.DB.prepare(
    'SELECT id, week_start, label FROM weekly_plans WHERE user_id = ? ORDER BY week_start DESC LIMIT 200'
  ).bind(userId).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;

  // Check content length
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > MAX_PLAN_SIZE) return badRequest(`Payload too large (max ${MAX_PLAN_SIZE / 1024}KB)`);

  const body = await request.json();
  const { weekStart, label, planData } = body;

  if (!validateDate(weekStart)) return badRequest('weekStart must be YYYY-MM-DD format');
  if (label && !validateStr(label, 128)) return badRequest('Label too long (max 128 chars)');
  if (!planData || typeof planData !== 'object') return badRequest('planData must be an object');

  const planStr = JSON.stringify(planData);
  if (planStr.length > MAX_PLAN_SIZE) return badRequest(`Plan data too large (max ${MAX_PLAN_SIZE / 1024}KB)`);

  const { results } = await env.DB.prepare(
    `INSERT INTO weekly_plans (user_id, week_start, label, plan_data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, week_start) DO UPDATE SET plan_data = excluded.plan_data, label = excluded.label
     RETURNING id, week_start, label`
  ).bind(userId, weekStart, label || '', planStr).all();

  return json(results[0], 201);
}
