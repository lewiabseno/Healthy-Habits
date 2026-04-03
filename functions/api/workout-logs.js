// GET /api/workout-logs?planId=&day= — load sets for a day
// POST /api/workout-logs — upsert a set
const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const day = url.searchParams.get('day');
  if (!planId) return json({ error: 'planId required' }, 400);

  let query = 'SELECT exercise_index, set_index, exercise_name, weight, reps FROM workout_logs WHERE plan_id = ? AND user_id = ?';
  const binds = [planId, userId];
  if (day !== null) { query += ' AND day_index = ?'; binds.push(parseInt(day)); }
  query += ' ORDER BY exercise_index, set_index';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const body = await request.json();
  const { planId, dayIndex, exerciseIndex, setIndex, exerciseName, weight, reps } = body;

  await env.DB.prepare(
    `INSERT INTO workout_logs (user_id, plan_id, day_index, exercise_index, set_index, exercise_name, weight, reps)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, day_index, exercise_index, set_index)
     DO UPDATE SET weight = excluded.weight, reps = excluded.reps, exercise_name = excluded.exercise_name, logged_at = datetime('now')`
  ).bind(userId, planId, dayIndex, exerciseIndex, setIndex, exerciseName, weight ?? null, reps ?? null).run();

  return json({ ok: true });
}
