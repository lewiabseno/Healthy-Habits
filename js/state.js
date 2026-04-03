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

export function normalizeExName(name) {
  return (name || '').trim().toLowerCase();
}

export function getWeekPickerHtml() {
  if (!state.currentPlan?.weekStart) return '';
  const weeks = state.weeks || [];
  const sorted = [...weeks].sort((a, b) => (a.weekStart || a.id).localeCompare(b.weekStart || b.id));
  const curIdx = sorted.findIndex(w => (w.id || w.weekStart) === state.currentPlanId);
  const hasPrev = curIdx > 0;
  const hasNext = curIdx < sorted.length - 1;
  const label = formatWeekRange(state.currentPlan.weekStart);

  return `<div class="week-nav">
    <button class="week-nav-arrow${hasPrev ? '' : ' disabled'}" id="weekPrev" ${hasPrev ? '' : 'disabled'}>&lsaquo;</button>
    <span class="week-nav-label" id="weekNavLabel">${label}</span>
    <button class="week-nav-arrow${hasNext ? '' : ' disabled'}" id="weekNext" ${hasNext ? '' : 'disabled'}>&rsaquo;</button>
  </div>`;
}

export function getSortedWeeks() {
  return [...(state.weeks || [])].sort((a, b) => (a.weekStart || a.id).localeCompare(b.weekStart || b.id));
}

export function getAdjacentWeekId(direction) {
  const sorted = getSortedWeeks();
  const curIdx = sorted.findIndex(w => (w.id || w.weekStart) === state.currentPlanId);
  const newIdx = curIdx + direction;
  if (newIdx < 0 || newIdx >= sorted.length) return null;
  return sorted[newIdx].id || sorted[newIdx].weekStart;
}

export function buildWeekModal(renderFn, container) {
  const sorted = getSortedWeeks();
  // Group by month
  const byMonth = {};
  sorted.forEach(w => {
    const ws = w.weekStart || w.id;
    const d = new Date(ws + 'T12:00:00');
    const monthKey = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(w);
  });

  const months = Object.keys(byMonth).reverse(); // newest first
  let html = '';
  months.forEach(month => {
    html += `<div class="wm-month">${month}</div>`;
    byMonth[month].forEach(w => {
      const id = w.id || w.weekStart;
      const label = w.label || formatWeekRange(w.weekStart || id);
      const isCurrent = id === state.currentPlanId;
      html += `<div class="wm-week${isCurrent ? ' active' : ''}" data-id="${id}">${label}</div>`;
    });
  });

  const modalContainer = document.getElementById('confirmContainer');
  modalContainer.innerHTML = `
    <div class="confirm-overlay" style="align-items:flex-end">
      <div class="modal-panel" style="max-width:500px;border-radius:16px 16px 0 0;max-height:70vh">
        <div class="modal-handle"></div>
        <div class="modal-title">Select Week</div>
        <div class="wm-list">${html}</div>
      </div>
    </div>`;

  // Close on overlay click
  modalContainer.querySelector('.confirm-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('confirm-overlay')) modalContainer.innerHTML = '';
  });

  // Week click
  modalContainer.querySelectorAll('.wm-week').forEach(el => {
    el.addEventListener('click', async () => {
      modalContainer.innerHTML = '';
      await handleWeekSwitch(el.dataset.id, renderFn, container);
    });
  });
}

export function initWeekNav(renderFn, container) {
  document.getElementById('weekPrev')?.addEventListener('click', async () => {
    const id = getAdjacentWeekId(-1);
    if (id) await handleWeekSwitch(id, renderFn, container);
  });
  document.getElementById('weekNext')?.addEventListener('click', async () => {
    const id = getAdjacentWeekId(1);
    if (id) await handleWeekSwitch(id, renderFn, container);
  });
  document.getElementById('weekNavLabel')?.addEventListener('click', () => {
    buildWeekModal(renderFn, container);
  });
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
