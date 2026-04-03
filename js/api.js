import { sb } from './supabase.js';

// ============================================
// WEEKLY PLANS
// ============================================

export async function fetchWeeks(userId) {
  const { data, error } = await sb
    .from('weekly_plans')
    .select('id, week_start, label')
    .eq('user_id', userId)
    .order('week_start', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchPlan(planId) {
  const { data, error } = await sb
    .from('weekly_plans')
    .select('*')
    .eq('id', planId)
    .single();
  if (error) throw error;
  return data;
}

export async function createWeek(userId, weekStart, label, planData) {
  const { data, error } = await sb
    .from('weekly_plans')
    .insert({ user_id: userId, week_start: weekStart, label, plan_data: planData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWeek(planId, planData, label) {
  const update = { plan_data: planData };
  if (label !== undefined) update.label = label;
  const { data, error } = await sb
    .from('weekly_plans')
    .update(update)
    .eq('id', planId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findWeekByDate(userId, weekStart) {
  const { data, error } = await sb
    .from('weekly_plans')
    .select('id, week_start, label')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ============================================
// WORKOUT LOGS
// ============================================

export async function loadWorkoutLogs(planId, dayIndex) {
  const { data, error } = await sb
    .from('workout_logs')
    .select('exercise_index, set_index, exercise_name, weight, reps')
    .eq('plan_id', planId)
    .eq('day_index', dayIndex)
    .order('exercise_index')
    .order('set_index');
  if (error) throw error;
  return data || [];
}

export async function upsertSet(userId, planId, dayIndex, exerciseIndex, setIndex, exerciseName, weight, reps) {
  const row = {
    user_id: userId,
    plan_id: planId,
    day_index: dayIndex,
    exercise_index: exerciseIndex,
    set_index: setIndex,
    exercise_name: exerciseName,
    weight: weight !== '' ? parseFloat(weight) : null,
    reps: reps !== '' ? parseInt(reps) : null,
  };
  const { error } = await sb
    .from('workout_logs')
    .upsert(row, { onConflict: 'user_id,plan_id,day_index,exercise_index,set_index' });
  if (error) throw error;
}

// ============================================
// MEAL CHECKS
// ============================================

export async function loadMealChecks(planId, dayIndex) {
  const { data, error } = await sb
    .from('meal_checks')
    .select('meal_key, checked')
    .eq('plan_id', planId)
    .eq('day_index', dayIndex);
  if (error) throw error;
  return data || [];
}

export async function upsertMealCheck(userId, planId, mealKey, dayIndex, checked) {
  const { error } = await sb
    .from('meal_checks')
    .upsert({
      user_id: userId,
      plan_id: planId,
      meal_key: mealKey,
      day_index: dayIndex,
      checked,
    }, { onConflict: 'user_id,plan_id,meal_key,day_index' });
  if (error) throw error;
}

// ============================================
// GROCERY CHECKS
// ============================================

export async function loadGroceryChecks(planId) {
  const { data, error } = await sb
    .from('grocery_checks')
    .select('category, item_index, checked')
    .eq('plan_id', planId);
  if (error) throw error;
  return data || [];
}

export async function upsertGroceryCheck(userId, planId, category, itemIndex, checked) {
  const { error } = await sb
    .from('grocery_checks')
    .upsert({
      user_id: userId,
      plan_id: planId,
      category,
      item_index: itemIndex,
      checked,
    }, { onConflict: 'user_id,plan_id,category,item_index' });
  if (error) throw error;
}

// ============================================
// BODYWEIGHT LOGS
// ============================================

export async function loadBodyweightHistory(userId) {
  const { data, error } = await sb
    .from('bodyweight_logs')
    .select('recorded_date, weight, unit')
    .eq('user_id', userId)
    .order('recorded_date', { ascending: true })
    .limit(84);
  if (error) throw error;
  return data || [];
}

export async function upsertBodyweight(userId, date, weight, unit = 'lbs') {
  const { error } = await sb
    .from('bodyweight_logs')
    .upsert({
      user_id: userId,
      recorded_date: date,
      weight: parseFloat(weight),
      unit,
    }, { onConflict: 'user_id,recorded_date' });
  if (error) throw error;
}

// ============================================
// DASHBOARD QUERIES
// ============================================

export async function loadExerciseProgression(userId, exerciseName) {
  const { data, error } = await sb
    .from('workout_logs')
    .select('weight, reps, plan_id, weekly_plans(week_start, label)')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
    .not('weight', 'is', null)
    .order('plan_id');
  if (error) throw error;
  // Group by week, find max weight per week
  const byWeek = {};
  (data || []).forEach(row => {
    const ws = row.weekly_plans?.week_start;
    if (!ws) return;
    if (!byWeek[ws] || row.weight > byWeek[ws].maxW) {
      byWeek[ws] = { maxW: row.weight, label: row.weekly_plans.label, date: ws };
    }
  });
  return Object.values(byWeek).sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadAllExerciseNames(userId) {
  const { data, error } = await sb
    .from('workout_logs')
    .select('exercise_name')
    .eq('user_id', userId)
    .not('weight', 'is', null);
  if (error) throw error;
  const names = [...new Set((data || []).map(r => r.exercise_name))];
  names.sort();
  return names;
}

export async function loadPersonalBests(userId) {
  const { data, error } = await sb.rpc('get_personal_bests', { p_user_id: userId });
  if (error) {
    // Fallback: client-side computation
    const { data: logs, error: e2 } = await sb
      .from('workout_logs')
      .select('exercise_name, weight, reps')
      .eq('user_id', userId)
      .not('weight', 'is', null)
      .order('weight', { ascending: false });
    if (e2) throw e2;
    const bests = {};
    (logs || []).forEach(r => {
      if (!bests[r.exercise_name] || r.weight > bests[r.exercise_name].best_weight) {
        bests[r.exercise_name] = { exercise_name: r.exercise_name, best_weight: r.weight, best_reps: r.reps };
      }
    });
    return Object.values(bests);
  }
  return data || [];
}

export async function loadWorkoutCompletionRates(userId) {
  const { data: plans, error: e1 } = await sb
    .from('weekly_plans')
    .select('id, week_start, label, plan_data')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(8);
  if (e1) throw e1;
  if (!plans || plans.length === 0) return [];

  const results = [];
  for (const plan of plans) {
    let planned = 0;
    const workouts = plan.plan_data?.workouts || [];
    workouts.forEach(w => {
      (w.exercises || []).forEach(ex => { planned += ex.sets || 0; });
    });

    const { count, error: e2 } = await sb
      .from('workout_logs')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', plan.id)
      .not('weight', 'is', null);
    if (e2) throw e2;

    results.push({
      weekStart: plan.week_start,
      label: plan.label,
      planned,
      logged: count || 0,
      rate: planned > 0 ? Math.round(((count || 0) / planned) * 100) : 0,
    });
  }
  return results.reverse();
}

export async function loadMealAdherenceRates(userId) {
  const { data: plans, error: e1 } = await sb
    .from('weekly_plans')
    .select('id, week_start, label, plan_data')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(8);
  if (e1) throw e1;
  if (!plans || plans.length === 0) return [];

  const results = [];
  for (const plan of plans) {
    const mealKeys = Object.keys(plan.plan_data?.meals || {});
    const possible = mealKeys.length * 7;

    const { count, error: e2 } = await sb
      .from('meal_checks')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', plan.id)
      .eq('checked', true);
    if (e2) throw e2;

    results.push({
      weekStart: plan.week_start,
      label: plan.label,
      possible,
      checked: count || 0,
      rate: possible > 0 ? Math.round(((count || 0) / possible) * 100) : 0,
    });
  }
  return results.reverse();
}
