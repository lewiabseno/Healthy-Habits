import { state, getCurrentMonday, formatWeekRange } from './state.js';
import { fetchWeeks, fetchPlan } from './api.js';
import { renderCurrentTab } from './router.js';

const pickerEl = document.getElementById('weekPicker');

export async function loadWeeks() {
  const weeks = await fetchWeeks(state.userId);
  state.weeks = weeks;

  renderPicker();

  // Auto-select: current week if it exists, otherwise most recent
  const monday = getCurrentMonday();
  const match = weeks.find(w => w.week_start === monday);
  const selected = match || weeks[0] || null;

  if (selected) {
    await selectWeek(selected.id);
  } else {
    state.currentPlanId = null;
    state.currentPlan = null;
    renderCurrentTab();
  }
}

function renderPicker() {
  if (state.weeks.length === 0) {
    pickerEl.innerHTML = '<span style="font-size:13px;color:var(--text-tertiary)">No weeks yet</span>';
    return;
  }

  const opts = state.weeks.map(w => {
    const label = w.label || formatWeekRange(w.week_start);
    return `<option value="${w.id}"${w.id === state.currentPlanId ? ' selected' : ''}>${label}</option>`;
  }).join('');

  pickerEl.innerHTML = `<select id="weekSelect">${opts}</select>`;
  document.getElementById('weekSelect').addEventListener('change', async (e) => {
    await selectWeek(e.target.value);
  });
}

async function selectWeek(planId) {
  if (state.currentPlanId === planId && state.currentPlan) {
    return;
  }
  state.currentPlanId = planId;
  const plan = await fetchPlan(planId);
  state.currentPlan = plan.plan_data;
  state.expandedExercise = null;

  // Update picker selection
  const sel = document.getElementById('weekSelect');
  if (sel) sel.value = planId;

  renderCurrentTab();
}
