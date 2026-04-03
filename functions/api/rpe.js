import { badRequest, verifyPlanOwnership, validateInt, validateStr } from './_validate.js';
const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const day = url.searchParams.get('day');
  if (!planId) return badRequest('planId required');
  if (!(await verifyPlanOwnership(env, planId, userId))) return json([], 200);

  let query = 'SELECT day_index, exercise_index, rpe FROM rpe_logs WHERE plan_id = ? AND user_id = ?';
  const binds = [planId, userId];
  if (day !== null) { query += ' AND day_index = ?'; binds.push(parseInt(day)); }
  query += ' LIMIT 500';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { planId, dayIndex, exerciseIndex, rpe } = await request.json();

  if (!validateStr(planId, 64)) return badRequest('Invalid planId');
  if (!validateInt(dayIndex, 0, 6)) return badRequest('dayIndex must be 0-6');
  if (!validateInt(exerciseIndex, 0, 50)) return badRequest('Invalid exerciseIndex');
  if (!validateStr(rpe, 4)) return badRequest('Invalid RPE value');
  if (!(await verifyPlanOwnership(env, planId, userId))) return badRequest('Plan not found');

  await env.DB.prepare(
    `INSERT INTO rpe_logs (user_id, plan_id, day_index, exercise_index, rpe)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, day_index, exercise_index)
     DO UPDATE SET rpe = excluded.rpe`
  ).bind(userId, planId, dayIndex, exerciseIndex, rpe).run();

  return json({ ok: true });
}
