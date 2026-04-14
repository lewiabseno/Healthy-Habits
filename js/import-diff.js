// Compact section-level diff between a new plan and an existing plan.

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function buildDiff(newPlan, existingPlan, mode = 'full') {
  const result = { workouts: null, meals: null, grocery: null };

  if (mode === 'full' || mode === 'workouts') {
    result.workouts = diffWorkouts(newPlan.workouts || [], existingPlan.workouts || []);
  }
  if (mode === 'full' || mode === 'meals') {
    result.meals = diffMeals(newPlan.meals || {}, existingPlan.meals || {});
  }
  if (mode === 'full' || mode === 'grocery') {
    result.grocery = diffGrocery(newPlan.grocery || {}, existingPlan.grocery || {});
  }

  return result;
}

function diffWorkouts(newWorkouts, existingWorkouts) {
  const changed = [];
  const unchanged = [];

  const existingByDay = {};
  existingWorkouts.forEach(w => { existingByDay[w.day] = w; });
  const newByDay = {};
  newWorkouts.forEach(w => { newByDay[w.day] = w; });

  const allDays = new Set([
    ...Object.keys(existingByDay).map(Number),
    ...Object.keys(newByDay).map(Number),
  ]);

  for (const day of [...allDays].sort()) {
    const name = DAY_NAMES[day] || `Day ${day}`;
    const ex = existingByDay[day];
    const nw = newByDay[day];

    if (nw && !ex) {
      changed.push(`${name}: added \u2014 ${nw.title || 'Workout'}`);
    } else if (ex && !nw) {
      changed.push(`${name}: removed`);
    } else if (ex && nw) {
      if (JSON.stringify(ex) === JSON.stringify(nw)) {
        unchanged.push(`${name}: ${nw.title || 'Workout'}`);
      } else {
        changed.push(`${name}: modified \u2014 ${nw.title || 'Workout'}`);
      }
    }
  }

  return { changed, unchanged };
}

function diffMeals(newMeals, existingMeals) {
  const changed = [];
  const unchanged = [];

  const allKeys = new Set([...Object.keys(existingMeals), ...Object.keys(newMeals)]);

  for (const key of allKeys) {
    const ex = existingMeals[key];
    const nw = newMeals[key];

    if (nw && !ex) {
      changed.push(`${key}: added \u2014 ${nw.name || key}`);
    } else if (ex && !nw) {
      changed.push(`${key}: removed`);
    } else if (ex && nw) {
      if (JSON.stringify(ex) === JSON.stringify(nw)) {
        unchanged.push(`${key}: ${nw.name || key}`);
      } else {
        changed.push(`${key}: modified \u2014 ${nw.name || key}`);
      }
    }
  }

  return { changed, unchanged };
}

function diffGrocery(newGrocery, existingGrocery) {
  const changed = [];
  const unchanged = [];

  const allCats = new Set([...Object.keys(existingGrocery), ...Object.keys(newGrocery)]);

  for (const cat of allCats) {
    const ex = existingGrocery[cat];
    const nw = newGrocery[cat];

    if (nw && !ex) {
      changed.push(`${cat}: added (${nw.length} items)`);
    } else if (ex && !nw) {
      changed.push(`${cat}: removed`);
    } else if (ex && nw) {
      if (JSON.stringify(ex) === JSON.stringify(nw)) {
        unchanged.push(`${cat}: ${nw.length} items`);
      } else {
        changed.push(`${cat}: modified (${nw.length} items)`);
      }
    }
  }

  return { changed, unchanged };
}
