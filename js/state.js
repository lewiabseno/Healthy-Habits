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
