const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const day = url.searchParams.get('day');
  if (!planId) return json({ error: 'planId required' }, 400);

  let query = 'SELECT day_index, notes FROM day_notes WHERE plan_id = ? AND user_id = ?';
  const binds = [planId, userId];
  if (day !== null) { query += ' AND day_index = ?'; binds.push(parseInt(day)); }

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { planId, dayIndex, notes } = await request.json();

  await env.DB.prepare(
    `INSERT INTO day_notes (user_id, plan_id, day_index, notes)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, day_index)
     DO UPDATE SET notes = excluded.notes`
  ).bind(userId, planId, dayIndex, notes).run();

  return json({ ok: true });
}
