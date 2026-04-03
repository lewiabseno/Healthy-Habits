import { state, formatWeekRange, getCurrentMonday } from './state.js';
import { showToast } from './toast.js';
import { SUPABASE_URL } from './config.js';

const isConfigured = SUPABASE_URL && !SUPABASE_URL.startsWith('YOUR_');

function getNextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() + (day === 0 ? 1 : 8 - day);
  const mon = new Date(d);
  mon.setDate(diff);
  return mon.toISOString().split('T')[0];
}

export async function renderHome(container) {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayMap = [6, 0, 1, 2, 3, 4, 5];
  const todayIdx = dayMap[new Date().getDay()];
  const todayName = dayNames[todayIdx];

  // Today's snapshot from current week
  let workoutSummary = 'No week loaded';
  let mealsSummary = '';
  let weightSummary = '';

  if (state.currentPlan) {
    // Today's workout
    const workout = (state.currentPlan.workouts || []).find(w => w.day === todayIdx);
    workoutSummary = workout
      ? `${workout.type || workout.title} \u00B7 ${workout.duration || ''}`
      : 'Rest day';

    // Meals eaten today
    const meals = state.currentPlan.meals || {};
    const mealKeys = Object.keys(meals);
    let checked = 0;
    if (!isConfigured) {
      const allChecks = JSON.parse(localStorage.getItem('hh-meal-checks') || '{}');
      const dayChecks = allChecks[`${state.currentPlanId}_${todayIdx}`] || {};
      checked = mealKeys.filter(k => dayChecks[k]).length;
    }
    mealsSummary = `${checked} of ${mealKeys.length} meals`;
  }

  // Weight
  let bwData;
  try { bwData = JSON.parse(localStorage.getItem('hh-bodyweight') || '[]'); } catch { bwData = []; }
  const lastBw = bwData.length > 0 ? bwData[bwData.length - 1] : null;
  weightSummary = lastBw ? `${lastBw.weight} lbs` : 'Not logged';

  // Body fat
  let bfData;
  try { bfData = JSON.parse(localStorage.getItem('hh-bodyfat') || '[]'); } catch { bfData = []; }
  const lastBf = bfData.length > 0 ? bfData[bfData.length - 1] : null;

  // Categorize weeks: next, current, past
  const weeks = state.weeks || [];
  const currentMonday = getCurrentMonday();
  const nextMonday = getNextMonday();

  let nextWeek = null, thisWeek = null;
  const pastWeeks = [];

  weeks.forEach(w => {
    const ws = w.weekStart || w.id;
    if (ws === nextMonday) nextWeek = w;
    else if (ws === currentMonday) thisWeek = w;
    else if (ws < currentMonday) pastWeeks.push(w);
    else if (ws > nextMonday) pastWeeks.push(w); // future beyond next
  });
  // Sort past newest first
  pastWeeks.sort((a, b) => (b.weekStart || b.id).localeCompare(a.weekStart || a.id));

  function weekRow(w, badge) {
    const id = w.id || w.weekStart;
    const label = w.label || formatWeekRange(w.weekStart || id);
    const isCurrent = id === state.currentPlanId;
    return `<div class="home-week-row${isCurrent ? ' current' : ''}" data-id="${id}">
      <div class="home-week-info">
        <div class="home-week-label">${label}</div>
        ${badge ? `<div class="home-week-badge ${badge.cls || ''}">${badge.text}</div>` : ''}
      </div>
      <div class="home-week-actions">
        <button class="home-week-btn export" data-id="${id}">Export</button>
      </div>
    </div>`;
  }

  let weekSectionsHtml = '';

  if (weeks.length === 0) {
    weekSectionsHtml = '<div class="empty-state">No weeks imported yet.<br>Tap <b>+ Import Week</b> to get started.</div>';
  } else {
    // Next week
    if (nextWeek) {
      weekSectionsHtml += `<div class="home-week-group-label">Next Week</div>`;
      weekSectionsHtml += weekRow(nextWeek, { text: 'Upcoming', cls: 'upcoming' });
    }

    // This week
    if (thisWeek) {
      weekSectionsHtml += `<div class="home-week-group-label">This Week</div>`;
      weekSectionsHtml += weekRow(thisWeek, { text: 'Active', cls: '' });
    }

    // Past weeks
    if (pastWeeks.length > 0) {
      weekSectionsHtml += `
        <div class="home-week-group-label home-past-toggle" id="pastToggle">
          Past Weeks <span class="home-past-count">${pastWeeks.length}</span>
          <span class="home-past-arrow" id="pastArrow">\u25BC</span>
        </div>
        <div class="home-past-list" id="pastList" style="display:none">
          ${pastWeeks.map(w => weekRow(w, null)).join('')}
        </div>`;
    }
  }

  container.innerHTML = `
    <div class="section-header"><div class="section-title">Home</div><div class="section-subtitle">${todayName}</div></div>

    <div class="home-snapshot">
      <div class="home-snap-card" data-goto="workout">
        <div class="home-snap-icon">&#x1F3CB;</div>
        <div class="home-snap-body">
          <div class="home-snap-label">Today's Workout</div>
          <div class="home-snap-value">${workoutSummary}</div>
        </div>
      </div>
      <div class="home-snap-card" data-goto="meals">
        <div class="home-snap-icon">&#x1F372;</div>
        <div class="home-snap-body">
          <div class="home-snap-label">Meals</div>
          <div class="home-snap-value">${mealsSummary || 'No plan'}</div>
        </div>
      </div>
      <div class="home-snap-card">
        <div class="home-snap-icon">&#x2696;</div>
        <div class="home-snap-body">
          <div class="home-snap-label">Weight</div>
          <div class="home-snap-value">${weightSummary}${lastBf ? ` \u00B7 ${lastBf.value}% BF` : ''}</div>
        </div>
      </div>
    </div>

    <div class="home-section-header">
      <span class="home-section-title">Weekly Plans</span>
      <button class="home-import-btn" id="homeImportBtn">+ Import Week</button>
    </div>
    <div class="home-week-list">${weekSectionsHtml}</div>
    <div style="height:20px"></div>`;

  // Snapshot card navigation
  container.querySelectorAll('.home-snap-card[data-goto]').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = card.dataset.goto;
    });
  });

  // Past weeks toggle
  document.getElementById('pastToggle')?.addEventListener('click', () => {
    const list = document.getElementById('pastList');
    const arrow = document.getElementById('pastArrow');
    if (list && arrow) {
      const isHidden = list.style.display === 'none';
      list.style.display = isHidden ? 'block' : 'none';
      arrow.textContent = isHidden ? '\u25B2' : '\u25BC';
    }
  });

  // Import button
  document.getElementById('homeImportBtn')?.addEventListener('click', () => {
    const overlay = document.getElementById('importModal');
    const textarea = document.getElementById('importJson');
    if (overlay && textarea) {
      textarea.value = '';
      const errorEl = document.getElementById('importError');
      if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('show'); }
      overlay.classList.add('open');
      setTimeout(() => textarea.focus(), 300);
    }
  });

  // Per-week export buttons
  container.querySelectorAll('.home-week-btn.export').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const weekId = btn.dataset.id;
      await exportWeek(weekId);
    });
  });

  // Week row click → switch to that week
  container.querySelectorAll('.home-week-row').forEach(row => {
    row.addEventListener('click', async () => {
      const weekId = row.dataset.id;
      if (weekId === state.currentPlanId) return;

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
      // Update week picker
      const sel = document.getElementById('weekSelect');
      if (sel) sel.value = weekId;
      showToast('Switched to ' + (row.querySelector('.home-week-label')?.textContent || weekId), 'success');
      renderHome(container);
    });
  });
}

async function exportWeek(weekId) {
  let plan, allLogs;

  if (isConfigured) {
    const { fetchPlan } = await import('./api.js');
    const p = await fetchPlan(weekId);
    plan = p.plan_data;
    // Load remote logs
    const { sb } = await import('./supabase.js');
    const { data } = await sb.from('workout_logs')
      .select('day_index, exercise_index, set_index, weight, reps')
      .eq('plan_id', weekId).order('day_index').order('exercise_index').order('set_index');
    allLogs = {};
    (data || []).forEach(row => {
      if (!allLogs[row.day_index]) allLogs[row.day_index] = {};
      if (!allLogs[row.day_index][row.exercise_index]) allLogs[row.day_index][row.exercise_index] = {};
      allLogs[row.day_index][row.exercise_index][row.set_index] = { weight: row.weight != null ? String(row.weight) : '', reps: row.reps != null ? String(row.reps) : '' };
    });
  } else {
    const week = state.weeks.find(w => (w.id || w.weekStart) === weekId);
    if (!week) { showToast('Week not found', 'error'); return; }
    plan = week.planData;
    // Load local logs
    allLogs = {};
    const raw = JSON.parse(localStorage.getItem('hh-workout-logs') || '{}');
    for (const [key, exSets] of Object.entries(raw)) {
      const parts = key.split('_');
      if (parts[0] !== weekId) continue;
      const dayIdx = parseInt(parts[1]);
      allLogs[dayIdx] = {};
      for (const [exIdx, sets] of Object.entries(exSets)) {
        allLogs[dayIdx][parseInt(exIdx)] = {};
        for (const [setIdx, data] of Object.entries(sets)) {
          allLogs[dayIdx][parseInt(exIdx)][parseInt(setIdx)] = data;
        }
      }
    }
  }

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const exportData = {
    weekLabel: plan.weekLabel || formatWeekRange(plan.weekStart),
    weekStart: plan.weekStart,
    exportedAt: new Date().toISOString(),
    workoutSummary: (plan.workouts || []).map(w => ({
      day: w.day,
      dayName: w.dayName || dayNames[w.day],
      title: w.type || w.title,
      exercises: (w.exercises || []).map((ex, exIdx) => {
        const sets = allLogs[w.day]?.[exIdx] || {};
        const logged = Object.entries(sets)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([, s]) => ({ weight: s.weight ? parseFloat(s.weight) : null, reps: s.reps ? parseInt(s.reps) : null }))
          .filter(s => s.weight !== null || s.reps !== null);
        return { name: ex.name, equipment: ex.equipment || '', targetSets: ex.sets, targetReps: ex.reps, logged };
      }),
    })),
  };

  const json = JSON.stringify(exportData, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    showToast('Week data copied!', 'success');
  } catch {
    // Fallback
    const container = document.getElementById('confirmContainer');
    container.innerHTML = `
      <div class="confirm-overlay" style="align-items:flex-end">
        <div class="modal-panel" style="max-width:500px;border-radius:16px 16px 0 0">
          <div class="modal-handle"></div>
          <div class="modal-title">Export Data</div>
          <textarea class="modal-textarea" id="exportTextarea" readonly style="min-height:250px;font-size:12px">${json.replace(/</g, '&lt;')}</textarea>
          <div class="modal-actions">
            <button class="modal-btn secondary" id="exportClose">Close</button>
            <button class="modal-btn primary" id="exportCopyBtn">Select All</button>
          </div>
        </div>
      </div>`;
    document.getElementById('exportClose').addEventListener('click', () => { container.innerHTML = ''; });
    document.getElementById('exportCopyBtn').addEventListener('click', () => {
      const ta = document.getElementById('exportTextarea');
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      showToast('Text selected \u2014 press Ctrl+C to copy', 'success');
    });
  }
}
