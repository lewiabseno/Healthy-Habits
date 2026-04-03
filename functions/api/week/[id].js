import { badRequest, notFound, validateStr, validateWeekPlan } from '../_validate.js';
const json = (data, status = 200) => Response.json(data, { status });

const MAX_PLAN_SIZE = 100 * 1024;

export async function onRequestGet(context) {
  const { env, params, data: { userId } } = context;
  if (!params.id || params.id.length > 64) return badRequest('Invalid ID');

  const row = await env.DB.prepare(
    'SELECT * FROM weekly_plans WHERE id = ? AND user_id = ?'
  ).bind(params.id, userId).first();
  if (!row) return notFound('Week not found');
  row.plan_data = JSON.parse(row.plan_data);
  return json(row);
}

export async function onRequestPut(context) {
  const { env, request, params, data: { userId } } = context;
  if (!params.id || params.id.length > 64) return badRequest('Invalid ID');

  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > MAX_PLAN_SIZE) return badRequest('Payload too large');

  const body = await request.json();
  const updates = [];
  const binds = [];

  if (body.planData !== undefined) {
    if (typeof body.planData !== 'object') return badRequest('planData must be an object');
    const planErr = validateWeekPlan(body.planData);
    if (planErr) return badRequest(planErr);
    const planStr = JSON.stringify(body.planData);
    if (planStr.length > MAX_PLAN_SIZE) return badRequest('Plan data too large');
    updates.push('plan_data = ?');
    binds.push(planStr);
  }
  if (body.label !== undefined) {
    if (!validateStr(body.label, 128)) return badRequest('Label too long');
    updates.push('label = ?');
    binds.push(body.label);
  }
  if (updates.length === 0) return badRequest('Nothing to update');

  binds.push(params.id, userId);
  const result = await env.DB.prepare(
    `UPDATE weekly_plans SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...binds).run();

  if (result.meta.changes === 0) return notFound('Week not found');
  return json({ ok: true });
}
