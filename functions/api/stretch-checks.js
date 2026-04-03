import { badRequest, verifyPlanOwnership, validateInt, validateStr } from './_validate.js';
const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const day = url.searchParams.get('day');
  if (!planId) return badRequest('planId required');
  if (!(await verifyPlanOwnership(env, planId, userId))) return json([], 200);

  let query = 'SELECT day_index, stretch_type, stretch_index, checked FROM stretch_checks WHERE plan_id = ? AND user_id = ?';
  const binds = [planId, userId];
  if (day !== null) { query += ' AND day_index = ?'; binds.push(parseInt(day)); }
  query += ' LIMIT 500';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results.map(r => ({ ...r, checked: !!r.checked })));
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { planId, dayIndex, stretchType, stretchIndex, checked } = await request.json();

  if (!validateStr(planId, 64)) return badRequest('Invalid planId');
  if (!validateInt(dayIndex, 0, 6)) return badRequest('dayIndex must be 0-6');
  if (!validateStr(stretchType, 16)) return badRequest('Invalid stretchType');
  if (!validateInt(stretchIndex, 0, 50)) return badRequest('Invalid stretchIndex');
  if (typeof checked !== 'boolean') return badRequest('checked must be boolean');
  if (!(await verifyPlanOwnership(env, planId, userId))) return badRequest('Plan not found');

  await env.DB.prepare(
    `INSERT INTO stretch_checks (user_id, plan_id, day_index, stretch_type, stretch_index, checked)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, day_index, stretch_type, stretch_index)
     DO UPDATE SET checked = excluded.checked`
  ).bind(userId, planId, dayIndex, stretchType, stretchIndex, checked ? 1 : 0).run();

  return json({ ok: true });
}
