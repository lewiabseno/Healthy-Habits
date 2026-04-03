import { state } from './state.js';
import { showToast } from './toast.js';
import { SUPABASE_URL } from './config.js';

const isConfigured = SUPABASE_URL && !SUPABASE_URL.startsWith('YOUR_');

export function initExport() {
  document.getElementById('exportBtn').addEventListener('click', handleExport);
}

async function handleExport() {
  if (!state.currentPlan || !state.currentPlanId) {
    showToast('No week to export', 'error');
    return;
  }

  try {
    const plan = state.currentPlan;
    const workouts = plan.workouts || [];
    const weekLabel = plan.weekLabel || `Week of ${plan.weekStart}`;
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Gather all workout logs
    let allLogs;
    if (isConfigured) {
      allLogs = await loadRemoteAllLogs();
    } else {
      allLogs = loadLocalAllLogs();
    }

    // Build export structure
    const exportData = {
      weekLabel,
      weekStart: plan.weekStart,
      exportedAt: new Date().toISOString(),
      workoutSummary: workouts.map(w => {
        const dayLogs = allLogs[w.day] || {};
        return {
          day: w.day,
          dayName: w.dayName || dayNames[w.day],
          title: w.type || w.title,
          exercises: (w.exercises || []).map((ex, exIdx) => {
            const sets = dayLogs[exIdx] || {};
            const loggedSets = Object.entries(sets)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([, s]) => ({
                weight: s.weight ? parseFloat(s.weight) : null,
                reps: s.reps ? parseInt(s.reps) : null,
              }))
              .filter(s => s.weight !== null || s.reps !== null);
            return {
              name: ex.name,
              equipment: ex.equipment || '',
              targetSets: ex.sets,
              targetReps: ex.reps,
              logged: loggedSets,
            };
          }),
        };
      }),
    };

    const json = JSON.stringify(exportData, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      showToast('Week data copied to clipboard!', 'success');
    } catch (clipErr) {
      // Fallback: show in a modal for manual copy
      showExportFallback(json);
    }
  } catch (e) {
    showToast('Export failed: ' + e.message, 'error');
  }
}

function showExportFallback(json) {
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
    showToast('Text selected — press Ctrl+C to copy', 'success');
  });
}

function loadLocalAllLogs() {
  let allRaw;
  try { allRaw = JSON.parse(localStorage.getItem('hh-workout-logs') || '{}'); } catch { return {}; }

  const result = {}; // { dayIndex: { exIndex: { setIndex: {weight, reps} } } }
  for (const [key, exSets] of Object.entries(allRaw)) {
    // key format: planId_dayIndex
    const parts = key.split('_');
    const planId = parts[0];
    const dayIdx = parseInt(parts[1]);
    if (planId !== state.currentPlanId) continue;
    result[dayIdx] = {};
    for (const [exIdx, sets] of Object.entries(exSets)) {
      result[dayIdx][parseInt(exIdx)] = {};
      for (const [setIdx, data] of Object.entries(sets)) {
        result[dayIdx][parseInt(exIdx)][parseInt(setIdx)] = data;
      }
    }
  }
  return result;
}

async function loadRemoteAllLogs() {
  const { sb } = await import('./supabase.js');
  const { data, error } = await sb
    .from('workout_logs')
    .select('day_index, exercise_index, set_index, exercise_name, weight, reps')
    .eq('plan_id', state.currentPlanId)
    .order('day_index')
    .order('exercise_index')
    .order('set_index');
  if (error) throw error;

  const result = {};
  (data || []).forEach(row => {
    if (!result[row.day_index]) result[row.day_index] = {};
    if (!result[row.day_index][row.exercise_index]) result[row.day_index][row.exercise_index] = {};
    result[row.day_index][row.exercise_index][row.set_index] = {
      weight: row.weight != null ? String(row.weight) : '',
      reps: row.reps != null ? String(row.reps) : '',
    };
  });
  return result;
}
