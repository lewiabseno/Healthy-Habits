import { badRequest, verifyPlanOwnership, validateInt, validateStr } from './_validate.js';
const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const day = url.searchParams.get('day');
  if (!planId) return badRequest('planId required');
  if (!(await verifyPlanOwnership(env, planId, userId))) return json([], 200);

  let query = 'SELECT day_index, notes FROM day_notes WHERE plan_id = ? AND user_id = ?';
  const binds = [planId, userId];
  if (day !== null) { const d = parseInt(day); if (isNaN(d) || d < 0 || d > 6) return badRequest('day must be 0-6'); query += ' AND day_index = ?'; binds.push(d); }
  query += ' LIMIT 50';

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { planId, dayIndex, notes } = await request.json();

  if (!validateStr(planId, 64)) return badRequest('Invalid planId');
  if (!validateInt(dayIndex, 0, 6)) return badRequest('dayIndex must be 0-6');
  if (notes === undefined || notes === null) return badRequest('notes field required');
  if (typeof notes !== 'string' || notes.length > 2000) return badRequest('Notes too long (max 2000 chars)');
  if (!(await verifyPlanOwnership(env, planId, userId))) return badRequest('Plan not found');

  await env.DB.prepare(
    `INSERT INTO day_notes (user_id, plan_id, day_index, notes)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, day_index)
     DO UPDATE SET notes = excluded.notes`
  ).bind(userId, planId, dayIndex, notes).run();

  return json({ ok: true });
}
