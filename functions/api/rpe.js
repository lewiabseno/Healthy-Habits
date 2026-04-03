const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const day = url.searchParams.get('day');
  if (!planId) return json({ error: 'planId required' }, 400);

  let query = 'SELECT day_index, exercise_index, rpe FROM rpe_logs WHERE plan_id = ? AND user_id = ?';
  const binds = [planId, userId];
  if (day !== null) { query += ' AND day_index = ?'; binds.push(parseInt(day)); }

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { planId, dayIndex, exerciseIndex, rpe } = await request.json();

  await env.DB.prepare(
    `INSERT INTO rpe_logs (user_id, plan_id, day_index, exercise_index, rpe)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, day_index, exercise_index)
     DO UPDATE SET rpe = excluded.rpe`
  ).bind(userId, planId, dayIndex, exerciseIndex, rpe).run();

  return json({ ok: true });
}
