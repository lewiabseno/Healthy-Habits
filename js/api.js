// API client — calls Cloudflare Pages Functions at /api/*
// All functions return parsed JSON or throw on error.

async function api(path, opts = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ============================================
// WEEKLY PLANS
// ============================================

export async function fetchWeeks() {
  return api('weeks');
}

export async function fetchPlan(planId) {
  const row = await api(`week/${planId}`);
  return row;
}

export async function createWeek(weekStart, label, planData) {
  return api('weeks', {
    method: 'POST',
    body: JSON.stringify({ weekStart, label, planData }),
  });
}

export async function updateWeek(planId, planData, label) {
  return api(`week/${planId}`, {
    method: 'PUT',
    body: JSON.stringify({ planData, label }),
  });
}

export async function findWeekByDate(weekStart) {
  const weeks = await fetchWeeks();
  return weeks.find(w => w.week_start === weekStart) || null;
}

// ============================================
// WORKOUT LOGS
// ============================================

export async function loadWorkoutLogs(planId, dayIndex) {
  return api(`workout-logs?planId=${planId}&day=${dayIndex}`);
}

export async function upsertSet(planId, dayIndex, exerciseIndex, setIndex, exerciseName, weight, reps) {
  return api('workout-logs', {
    method: 'POST',
    body: JSON.stringify({ planId, dayIndex, exerciseIndex, setIndex, exerciseName, weight: weight !== '' ? parseFloat(weight) : null, reps: reps !== '' ? parseInt(reps) : null }),
  });
}

// ============================================
// MEAL CHECKS
// ============================================

export async function loadMealChecks(planId, dayIndex) {
  return api(`meal-checks?planId=${planId}&day=${dayIndex}`);
}

export async function upsertMealCheck(planId, mealKey, dayIndex, checked) {
  return api('meal-checks', {
    method: 'POST',
    body: JSON.stringify({ planId, mealKey, dayIndex, checked }),
  });
}

// ============================================
// GROCERY CHECKS
// ============================================

export async function loadGroceryChecks(planId) {
  return api(`grocery-checks?planId=${planId}`);
}

export async function upsertGroceryCheck(planId, category, itemIndex, checked) {
  return api('grocery-checks', {
    method: 'POST',
    body: JSON.stringify({ planId, category, itemIndex, checked }),
  });
}

// ============================================
// BODYWEIGHT LOGS
// ============================================

export async function loadBodyweightHistory() {
  return api('bodyweight');
}

export async function upsertBodyweight(date, weight, unit = 'lbs') {
  return api('bodyweight', {
    method: 'POST',
    body: JSON.stringify({ date, weight: parseFloat(weight), unit }),
  });
}

// ============================================
// BODY FAT LOGS
// ============================================

export async function loadBodyfatHistory() {
  return api('bodyfat');
}

export async function upsertBodyfat(date, value) {
  return api('bodyfat', {
    method: 'POST',
    body: JSON.stringify({ date, value: parseFloat(value) }),
  });
}

// ============================================
// DASHBOARD QUERIES
// ============================================

export async function loadAllExerciseNames() {
  return api('dashboard?type=exercise-names');
}

export async function loadExerciseProgression(exerciseName) {
  return api(`dashboard?type=exercise-progression&name=${encodeURIComponent(exerciseName)}`);
}

export async function loadPersonalBests() {
  return api('dashboard?type=personal-bests');
}

export async function loadWorkoutCompletionRates() {
  return api('dashboard?type=completion');
}

export async function loadMealAdherenceRates() {
  return api('dashboard?type=adherence');
}

// ============================================
// RPE LOGS
// ============================================

export async function loadRpe(planId, dayIndex) {
  return api(`rpe?planId=${planId}&day=${dayIndex}`);
}

export async function upsertRpe(planId, dayIndex, exerciseIndex, rpe) {
  return api('rpe', {
    method: 'POST',
    body: JSON.stringify({ planId, dayIndex, exerciseIndex, rpe }),
  });
}

// ============================================
// DAY NOTES
// ============================================

export async function loadDayNotes(planId, dayIndex) {
  const data = await api(`day-notes?planId=${planId}&day=${dayIndex}`);
  return data.length > 0 ? data[0].notes : '';
}

export async function upsertDayNotes(planId, dayIndex, notes) {
  return api('day-notes', {
    method: 'POST',
    body: JSON.stringify({ planId, dayIndex, notes }),
  });
}

// ============================================
// STRETCH CHECKS
// ============================================

export async function loadStretchChecks(planId, dayIndex) {
  return api(`stretch-checks?planId=${planId}&day=${dayIndex}`);
}

export async function upsertStretchCheck(planId, dayIndex, stretchType, stretchIndex, checked) {
  return api('stretch-checks', {
    method: 'POST',
    body: JSON.stringify({ planId, dayIndex, stretchType, stretchIndex, checked }),
  });
}
