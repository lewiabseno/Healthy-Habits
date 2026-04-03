import { badRequest, verifyPlanOwnership, validateInt, validateNum, validateStr } from './_validate.js';
const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const day = url.searchParams.get('day');
  if (!planId) return badRequest('planId required');
  if (!(await verifyPlanOwnership(env, planId, userId))) return json([], 200);

  let query = 'SELECT exercise_index, set_index, exercise_name, weight, reps FROM workout_logs WHERE plan_id = ? AND user_id = ?';
  const binds = [planId, userId];
  if (day !== null) { const d = parseInt(day); if (isNaN(d) || d < 0 || d > 6) return badRequest('day must be 0-6'); query += ' AND day_index = ?'; binds.push(d); }
  query += ' ORDER BY exercise_index, set_index LIMIT 500';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const body = await request.json();
  const { planId, dayIndex, exerciseIndex, setIndex, exerciseName, weight, reps } = body;

  if (!validateStr(planId, 64)) return badRequest('Invalid planId');
  if (!validateInt(dayIndex, 0, 6)) return badRequest('dayIndex must be 0-6');
  if (!validateInt(exerciseIndex, 0, 50)) return badRequest('Invalid exerciseIndex');
  if (!validateInt(setIndex, 0, 20)) return badRequest('Invalid setIndex');
  if (!validateStr(exerciseName, 255)) return badRequest('Invalid exerciseName');
  if (weight !== null && weight !== undefined && !validateNum(weight, 0, 9999)) return badRequest('Invalid weight');
  if (reps !== null && reps !== undefined && !validateInt(reps, 0, 999)) return badRequest('Invalid reps');
  if (!(await verifyPlanOwnership(env, planId, userId))) return badRequest('Plan not found');

  await env.DB.prepare(
    `INSERT INTO workout_logs (user_id, plan_id, day_index, exercise_index, set_index, exercise_name, weight, reps)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, day_index, exercise_index, set_index)
     DO UPDATE SET weight = excluded.weight, reps = excluded.reps, exercise_name = excluded.exercise_name, logged_at = datetime('now')`
  ).bind(userId, planId, dayIndex, exerciseIndex, setIndex, exerciseName, weight ?? null, reps ?? null).run();

  return json({ ok: true });
}
