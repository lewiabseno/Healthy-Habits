const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const planId = new URL(request.url).searchParams.get('planId');
  if (!planId) return json({ error: 'planId required' }, 400);

  const { results } = await env.DB.prepare(
    'SELECT category, item_index, checked FROM grocery_checks WHERE plan_id = ? AND user_id = ?'
  ).bind(planId, userId).all();
  return json(results.map(r => ({ ...r, checked: !!r.checked })));
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { planId, category, itemIndex, checked } = await request.json();

  await env.DB.prepare(
    `INSERT INTO grocery_checks (user_id, plan_id, category, item_index, checked)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, category, item_index)
     DO UPDATE SET checked = excluded.checked`
  ).bind(userId, planId, category, itemIndex, checked ? 1 : 0).run();

  return json({ ok: true });
}
