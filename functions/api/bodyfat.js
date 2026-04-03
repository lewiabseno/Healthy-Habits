const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, data: { userId } } = context;
  const { results } = await env.DB.prepare(
    'SELECT recorded_date, value FROM bodyfat_logs WHERE user_id = ? ORDER BY recorded_date ASC LIMIT 84'
  ).bind(userId).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const { date, value } = await request.json();

  await env.DB.prepare(
    `INSERT INTO bodyfat_logs (user_id, recorded_date, value)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, recorded_date)
     DO UPDATE SET value = excluded.value`
  ).bind(userId, date, value).run();

  return json({ ok: true });
}
