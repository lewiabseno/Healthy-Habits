const json = (data, status = 200) => Response.json(data, { status });

export async function onRequestGet(context) {
  const { env, request, data: { userId } } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  switch (type) {
    case 'exercise-names': {
      const { results } = await env.DB.prepare(
        'SELECT DISTINCT exercise_name FROM workout_logs WHERE user_id = ? AND weight IS NOT NULL ORDER BY exercise_name'
      ).bind(userId).all();
      return json(results.map(r => r.exercise_name));
    }

    case 'exercise-progression': {
      const name = url.searchParams.get('name');
      if (!name) return json({ error: 'name required' }, 400);
      const { results } = await env.DB.prepare(
        `SELECT wp.week_start, wp.label, MAX(wl.weight) as max_weight
         FROM workout_logs wl
         JOIN weekly_plans wp ON wl.plan_id = wp.id
         WHERE wl.user_id = ? AND wl.exercise_name = ? AND wl.weight IS NOT NULL
         GROUP BY wp.week_start
         ORDER BY wp.week_start ASC`
      ).bind(userId, name).all();
      return json(results);
    }

    case 'personal-bests': {
      const { results } = await env.DB.prepare(
        `SELECT exercise_name, weight as best_weight, reps as best_reps
         FROM workout_logs
         WHERE user_id = ? AND weight IS NOT NULL
         AND (exercise_name, weight) IN (
           SELECT exercise_name, MAX(weight) FROM workout_logs
           WHERE user_id = ? AND weight IS NOT NULL
           GROUP BY exercise_name
         )
         GROUP BY exercise_name
         ORDER BY exercise_name`
      ).bind(userId, userId).all();
      return json(results);
    }

    case 'completion': {
      const { results: plans } = await env.DB.prepare(
        'SELECT id, week_start, label, plan_data FROM weekly_plans WHERE user_id = ? ORDER BY week_start DESC LIMIT 8'
      ).bind(userId).all();

      const rates = [];
      for (const plan of plans) {
        const planData = JSON.parse(plan.plan_data);
        let planned = 0;
        (planData.workouts || []).forEach(w => {
          (w.exercises || []).forEach(ex => { planned += ex.sets || 0; });
        });
        const { results: [{ count }] } = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM workout_logs WHERE plan_id = ? AND weight IS NOT NULL'
        ).bind(plan.id).all();
        rates.push({
          weekStart: plan.week_start, label: plan.label, planned, logged: count,
          rate: planned > 0 ? Math.round((count / planned) * 100) : 0,
        });
      }
      return json(rates.reverse());
    }

    case 'adherence': {
      const { results: plans } = await env.DB.prepare(
        'SELECT id, week_start, label, plan_data FROM weekly_plans WHERE user_id = ? ORDER BY week_start DESC LIMIT 8'
      ).bind(userId).all();

      const rates = [];
      for (const plan of plans) {
        const planData = JSON.parse(plan.plan_data);
        const possible = Object.keys(planData.meals || {}).length * 7;
        const { results: [{ count }] } = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM meal_checks WHERE plan_id = ? AND checked = 1'
        ).bind(plan.id).all();
        rates.push({
          weekStart: plan.week_start, label: plan.label, possible, checked: count,
          rate: possible > 0 ? Math.round((count / possible) * 100) : 0,
        });
      }
      return json(rates.reverse());
    }

    default:
      return json({ error: 'Unknown type. Use: exercise-names, exercise-progression, personal-bests, completion, adherence' }, 400);
  }
}
