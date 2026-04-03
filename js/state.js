// App-wide state
export const state = {
  userId: null,
  weeks: [],
  currentPlanId: null,
  currentPlan: null,
  currentDay: todayDayIndex(),
  currentTab: 'workout',
  expandedExercise: null,
};

function todayDayIndex() {
  const map = [6, 0, 1, 2, 3, 4, 5]; // Sun=6, Mon=0, Tue=1, ...
  return map[new Date().getDay()];
}

export function getCurrentMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().split('T')[0];
}

export function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateLong(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatWeekRange(mondayStr) {
  const mon = new Date(mondayStr + 'T12:00:00');
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const mFmt = mon.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const sFmt = sun.getMonth() === mon.getMonth()
    ? sun.toLocaleDateString('en-US', { day: 'numeric' })
    : sun.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${mFmt} - ${sFmt}`;
}

export function getWeekPickerHtml() {
  if (!state.currentPlan?.weekStart) return '';
  const weeks = state.weeks || [];
  if (weeks.length <= 1) {
    return `<div class="section-subtitle">${formatWeekRange(state.currentPlan.weekStart)}</div>`;
  }
  const opts = weeks.map(w => {
    const id = w.id || w.weekStart;
    const label = w.label || formatWeekRange(w.weekStart || id);
    return `<option value="${id}"${id === state.currentPlanId ? ' selected' : ''}>${label}</option>`;
  }).join('');
  return `<select class="inline-week-select" id="inlineWeekSelect">${opts}</select>`;
}

export async function handleWeekSwitch(weekId, renderFn, container) {
  if (weekId === state.currentPlanId) return;
  const { SUPABASE_URL } = await import('./config.js');
  const isConfigured = SUPABASE_URL && !SUPABASE_URL.startsWith('YOUR_');
  if (isConfigured) {
    const { fetchPlan } = await import('./api.js');
    const plan = await fetchPlan(weekId);
    state.currentPlanId = weekId;
    state.currentPlan = plan.plan_data;
  } else {
    const week = state.weeks.find(w => (w.id || w.weekStart) === weekId);
    if (week) {
      state.currentPlanId = weekId;
      state.currentPlan = week.planData;
    }
  }
  state.expandedExercise = null;
  renderFn(container);
}
