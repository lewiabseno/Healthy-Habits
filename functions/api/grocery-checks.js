import { badRequest, verifyPlanOwnership, validateInt, validateStr } from './_validate.js';
const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const planId = new URL(request.url).searchParams.get('planId');
  if (!planId) return badRequest('planId required');
  if (!(await verifyPlanOwnership(env, planId, userId))) return json([], 200);

  const { results } = await env.DB.prepare(
    'SELECT category, item_index, checked FROM grocery_checks WHERE plan_id = ? AND user_id = ? LIMIT 500'
  ).bind(planId, userId).all();
  return json(results.map(r => ({ ...r, checked: !!r.checked })));
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { planId, category, itemIndex, checked } = await request.json();

  if (!validateStr(planId, 64)) return badRequest('Invalid planId');
  if (!validateStr(category, 128)) return badRequest('Invalid category');
  if (!validateInt(itemIndex, 0, 200)) return badRequest('Invalid itemIndex');
  if (typeof checked !== 'boolean') return badRequest('checked must be boolean');
  if (!(await verifyPlanOwnership(env, planId, userId))) return badRequest('Plan not found');

  await env.DB.prepare(
    `INSERT INTO grocery_checks (user_id, plan_id, category, item_index, checked)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id, category, item_index)
     DO UPDATE SET checked = excluded.checked`
  ).bind(userId, planId, category, itemIndex, checked ? 1 : 0).run();

  return json({ ok: true });
}
