import { badRequest, validateDate, validateNum } from './_validate.js';
const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, data: { userId } } = context;
  const { results } = await env.DB.prepare(
    'SELECT recorded_date, weight, unit FROM bodyweight_logs WHERE user_id = ? ORDER BY recorded_date ASC LIMIT 365'
  ).bind(userId).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { date, weight, unit } = await request.json();

  if (!validateDate(date)) return badRequest('Invalid date format');
  if (!validateNum(weight, 1, 999)) return badRequest('Weight must be 1-999');
  const validUnit = (unit === 'kg') ? 'kg' : 'lbs';

  await env.DB.prepare(
    `INSERT INTO bodyweight_logs (user_id, recorded_date, weight, unit)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, recorded_date)
     DO UPDATE SET weight = excluded.weight, unit = excluded.unit`
  ).bind(userId, date, weight, validUnit).run();

  return json({ ok: true });
}
