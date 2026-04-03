const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const day = url.searchParams.get('day');
  if (!planId) return json({ error: 'planId required' }, 400);

  let query = 'SELECT meal_key, checked FROM meal_checks WHERE plan_id = ? AND user_id = ?';
  const binds = [planId, userId];
  if (day !== null) { query += ' AND day_index = ?'; binds.push(parseInt(day)); }

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results.map(r => ({ ...r, checked: !!r.checked })));
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { planId, mealKey, dayIndex, checked } = await request.json();

  await env.DB.prepare(
    `INSERT INTO meal_checks (user_id, plan_id, meal_key, day_index, checked)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, meal_key, day_index)
     DO UPDATE SET checked = excluded.checked`
  ).bind(userId, planId, mealKey, dayIndex, checked ? 1 : 0).run();

  return json({ ok: true });
}
