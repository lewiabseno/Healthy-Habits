// GET /api/weeks — list all weeks for user
// POST /api/weeks — create a new week
const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, data: { userId } } = context;
  const { results } = await env.DB.prepare(
    'SELECT id, week_start, label FROM weekly_plans WHERE user_id = ? ORDER BY week_start DESC'
  ).bind(userId).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { env, request, data: { userId } } = context;
  const body = await request.json();
  const { weekStart, label, planData } = body;
  if (!weekStart || !planData) return json({ error: 'weekStart and planData required' }, 400);

  const { results } = await env.DB.prepare(
    `INSERT INTO weekly_plans (user_id, week_start, label, plan_data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, week_start) DO UPDATE SET plan_data = excluded.plan_data, label = excluded.label
     RETURNING id, week_start, label`
  ).bind(userId, weekStart, label || '', JSON.stringify(planData)).all();

  return json(results[0], 201);
}
