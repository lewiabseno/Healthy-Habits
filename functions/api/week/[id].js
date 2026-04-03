// GET /api/week/:id — get full week with plan_data
// PUT /api/week/:id — update week plan_data
const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, params, data: { userId } } = context;
  const row = await env.DB.prepare(
    'SELECT * FROM weekly_plans WHERE id = ? AND user_id = ?'
  ).bind(params.id, userId).first();
  if (!row) return json({ error: 'Not found' }, 404);
  row.plan_data = JSON.parse(row.plan_data);
  return json(row);
}

export async function onRequestPut(context) {
  const { env, request, params, data: { userId } } = context;
  const body = await request.json();
  const updates = [];
  const binds = [];
  if (body.planData !== undefined) { updates.push('plan_data = ?'); binds.push(JSON.stringify(body.planData)); }
  if (body.label !== undefined) { updates.push('label = ?'); binds.push(body.label); }
  if (updates.length === 0) return json({ error: 'Nothing to update' }, 400);

  binds.push(params.id, userId);
  await env.DB.prepare(
    `UPDATE weekly_plans SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...binds).run();

  return json({ ok: true });
}
