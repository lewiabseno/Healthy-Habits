import { state, formatWeekRange, getCurrentMonday } from './state.js';
import { showToast } from './toast.js';
import { IS_PRODUCTION } from './config.js';

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
    if (!IS_PRODUCTION) {
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
    <div class="section-header"><div class="section-title">Home</div><div class="section-subtitle">Today \u2014 ${todayName}, ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div>

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
        <div class="home-snap-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2" stroke-linecap="round"><path d="M4 18a10 10 0 0120 0"/><path d="M12 18l3-6"/><circle cx="12" cy="18" r="1.5" fill="#8e8e93" stroke="none"/><circle cx="7" cy="14" r="0.5" fill="#8e8e93" stroke="none"/><circle cx="5" cy="17" r="0.5" fill="#8e8e93" stroke="none"/><circle cx="17" cy="14" r="0.5" fill="#8e8e93" stroke="none"/><circle cx="19" cy="17" r="0.5" fill="#8e8e93" stroke="none"/><circle cx="12" cy="10" r="0.5" fill="#8e8e93" stroke="none"/></svg></div>
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
    ${IS_PRODUCTION ? '<div style="padding:20px 12px"><button class="reset-btn" id="homeLogoutBtn">Log Out</button></div>' : ''}
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

  // Logout button
  document.getElementById('homeLogoutBtn')?.addEventListener('click', async () => {
    const { signOut } = await import('./auth.js');
    await signOut();
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

}

async function exportWeek(weekId) {
  let plan, allLogs;

  if (IS_PRODUCTION) {
    const { fetchPlan, loadWorkoutLogs } = await import('./api.js');
    const p = await fetchPlan(weekId);
    plan = p.plan_data;
    // Load all workout logs for this week (all days)
    allLogs = {};
    for (const w of (plan.workouts || [])) {
      const data = await loadWorkoutLogs(weekId, w.day);
      if (data && data.length > 0) {
        allLogs[w.day] = {};
        data.forEach(row => {
          if (!allLogs[w.day][row.exercise_index]) allLogs[w.day][row.exercise_index] = {};
          allLogs[w.day][row.exercise_index][row.set_index] = { weight: row.weight != null ? String(row.weight) : '', reps: row.reps != null ? String(row.reps) : '' };
        });
      }
    }
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

  // Stretch checks, RPE, day notes
  let stretchChecks, rpeData, dayNotes;
  try { stretchChecks = JSON.parse(localStorage.getItem('hh-stretch-checks') || '{}'); } catch { stretchChecks = {}; }
  try { rpeData = JSON.parse(localStorage.getItem('hh-rpe') || '{}'); } catch { rpeData = {}; }
  try { dayNotes = JSON.parse(localStorage.getItem('hh-day-notes') || '{}'); } catch { dayNotes = {}; }

  // Meal checks
  let mealChecks;
  try { mealChecks = JSON.parse(localStorage.getItem('hh-meal-checks') || '{}'); } catch { mealChecks = {}; }

  // Bodyweight + body fat
  let bwData, bfData;
  try { bwData = JSON.parse(localStorage.getItem('hh-bodyweight') || '[]'); } catch { bwData = []; }
  try { bfData = JSON.parse(localStorage.getItem('hh-bodyfat') || '[]'); } catch { bfData = []; }

  // Compute week date range for filtering body metrics
  const weekEnd = new Date(plan.weekStart + 'T12:00:00');
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const weekBw = bwData.filter(d => d.date >= plan.weekStart && d.date <= weekEndStr);
  const weekBf = bfData.filter(d => d.date >= plan.weekStart && d.date <= weekEndStr);
  const latestBw = bwData.length > 0 ? bwData[bwData.length - 1] : null;
  const latestBf = bfData.length > 0 ? bfData[bfData.length - 1] : null;

  // Weekly change: compare this week's avg to previous week's avg
  const prevStart = new Date(plan.weekStart + 'T12:00:00');
  prevStart.setDate(prevStart.getDate() - 7);
  const prevStartStr = prevStart.toISOString().split('T')[0];
  const prevEndStr = new Date(prevStart.getTime() + 6 * 86400000).toISOString().split('T')[0];
  const prevBw = bwData.filter(d => d.date >= prevStartStr && d.date <= prevEndStr);
  const prevBf = bfData.filter(d => d.date >= prevStartStr && d.date <= prevEndStr);
  const avgBw = weekBw.length > 0 ? Math.round(weekBw.reduce((s, d) => s + d.weight, 0) / weekBw.length * 10) / 10 : null;
  const avgPrevBw = prevBw.length > 0 ? Math.round(prevBw.reduce((s, d) => s + d.weight, 0) / prevBw.length * 10) / 10 : null;
  const avgBf = weekBf.length > 0 ? Math.round(weekBf.reduce((s, d) => s + d.value, 0) / weekBf.length * 10) / 10 : null;
  const avgPrevBf = prevBf.length > 0 ? Math.round(prevBf.reduce((s, d) => s + d.value, 0) / prevBf.length * 10) / 10 : null;

  const exportData = {
    weekLabel: plan.weekLabel || formatWeekRange(plan.weekStart),
    weekStart: plan.weekStart,
    exportedAt: new Date().toISOString(),

    bodyMetrics: {
      currentWeight: latestBw?.weight || null,
      currentBodyFat: latestBf?.value || null,
      weeklyWeightChange: avgBw != null && avgPrevBw != null ? Math.round((avgBw - avgPrevBw) * 10) / 10 : null,
      weeklyBodyFatChange: avgBf != null && avgPrevBf != null ? Math.round((avgBf - avgPrevBf) * 10) / 10 : null,
      weekWeights: weekBw.map(d => ({ date: d.date, weight: d.weight })),
      weekBodyFat: weekBf.map(d => ({ date: d.date, value: d.value })),
    },

    workoutSummary: (plan.workouts || []).map(w => {
      // Warmup/cooldown completion
      const warmupDone = (w.warmup || []).map((s, i) => {
        const key = `${weekId}_${w.day}_warmup_${i}`;
        return { name: typeof s === 'string' ? s : s.name, completed: !!stretchChecks[key] };
      });
      const cooldownDone = (w.cooldown || []).map((s, i) => {
        const key = `${weekId}_${w.day}_cooldown_${i}`;
        return { name: typeof s === 'string' ? s : s.name, completed: !!stretchChecks[key] };
      });

      // Day notes
      const notesKey = `${weekId}_${w.day}_notes`;
      const userNotes = dayNotes[notesKey] || '';

      return {
        day: w.day,
        dayName: w.dayName || dayNames[w.day],
        title: w.type || w.title,
        notes: userNotes || undefined,
        exercises: (w.exercises || []).map((ex, exIdx) => {
          const sets = allLogs[w.day]?.[exIdx] || {};
          const logged = Object.entries(sets)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([, s]) => ({ weight: s.weight ? parseFloat(s.weight) : null, reps: s.reps ? parseInt(s.reps) : null }))
            .filter(s => s.weight !== null || s.reps !== null);
          const rpeKey = `${weekId}_${w.day}_rpe_${exIdx}`;
          const rpe = rpeData[rpeKey] || undefined;
          return { name: ex.name, equipment: ex.equipment || '', targetSets: ex.sets, targetReps: ex.reps, logged, rpe };
        }),
        warmup: warmupDone.length > 0 ? warmupDone : undefined,
        cooldown: cooldownDone.length > 0 ? cooldownDone : undefined,
      };
    }),

    mealsSummary: (() => {
      const meals = plan.meals || {};
      const mealKeys = Object.keys(meals);
      const days = {};
      for (let d = 0; d < 7; d++) {
        const dayChecks = mealChecks[`${weekId}_${d}`] || {};
        const eaten = mealKeys.filter(k => dayChecks[k]);
        const skipped = mealKeys.filter(k => !dayChecks[k]);
        if (eaten.length > 0 || skipped.length > 0) {
          days[dayNames[d]] = {
            eaten: eaten.map(k => meals[k].name),
            skipped: skipped.map(k => meals[k].name),
            caloriesEaten: eaten.reduce((s, k) => s + (meals[k].calories || 0), 0),
            proteinEaten: eaten.reduce((s, k) => s + (meals[k].protein || 0), 0),
          };
        }
      }
      return days;
    })(),
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
