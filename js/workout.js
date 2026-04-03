import { state, formatWeekRange, getWeekPickerHtml, initWeekNav, normalizeExName } from './state.js';
import { showToast } from './toast.js';
import { IS_PRODUCTION } from './config.js';
import { esc, escAttr } from './sanitize.js';

let logs = {}; // { exerciseIndex: { setIndex: { weight, reps } } }
let prevLogs = {}; // previous week's logs for placeholders
let debounceTimers = {};
let pillScrollPos = null;
let isInitialRender = true;
let activeSubtab = 'workout'; // 'warmup' | 'workout' | 'cooldown'
let stretchChecks = {};
let rpeData = {}; // { exIdx: rpeValue }
let activeTimer = null; // { exIdx, seconds, interval }

function getLocalStretchChecks() {
  try { return JSON.parse(localStorage.getItem('hh-stretch-checks') || '{}'); } catch { return {}; }
}
function saveLocalStretchChecks(all) {
  localStorage.setItem('hh-stretch-checks', JSON.stringify(all));
}

function getLocalLogs() {
  try {
    return JSON.parse(localStorage.getItem('hh-workout-logs') || '{}');
  } catch { return {}; }
}

function saveLocalLogs(all) {
  localStorage.setItem('hh-workout-logs', JSON.stringify(all));
}

export async function renderWorkout(container) {
  const plan = state.currentPlan;
  if (!plan) {
    container.innerHTML = `<div class="section-header"><div class="section-title">Workout</div>${getWeekPickerHtml()}</div>
      <div class="empty-state">No week imported yet.<br>Tap <b>+ Import</b> to add a weekly plan.</div>`;
    return;
  }

  const workouts = plan.workouts || [];
  const dayMap = {};
  workouts.forEach(w => { dayMap[w.day] = w; });

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const workout = dayMap[state.currentDay];

  // Load logs + previous week's logs for placeholders
  if (workout) {
    if (IS_PRODUCTION && state.currentPlanId) {
      const { loadWorkoutLogs } = await import('./api.js');
      await loadRemoteLogs(loadWorkoutLogs, state.currentDay);
    } else {
      loadLocalDayLogs(state.currentDay);
    }
    loadPreviousLogs(state.currentDay);
    // Pre-load RPE data for this day
    rpeData = {};
    if (IS_PRODUCTION) {
      try {
        const { loadRpe } = await import('./api.js');
        const data = await loadRpe(state.currentPlanId, state.currentDay);
        data.forEach(r => { rpeData[r.exercise_index] = r.rpe; });
      } catch (e) { /* silent */ }
    } else {
      const allRpe = JSON.parse(localStorage.getItem('hh-rpe') || '{}');
      Object.keys(allRpe).forEach(key => {
        const prefix = `${state.currentPlanId}_${state.currentDay}_rpe_`;
        if (key.startsWith(prefix)) {
          const exIdx = parseInt(key.slice(prefix.length));
          rpeData[exIdx] = allRpe[key];
        }
      });
    }
  }

  // Check which days have logged data
  const allLogData = getLocalLogs();
  const daysWithData = new Set();
  for (let d = 0; d < 7; d++) {
    const key = `${state.currentPlanId}_${d}`;
    if (allLogData[key] && Object.keys(allLogData[key]).length > 0) daysWithData.add(d);
  }

  const pillsHtml = dayNames.map((name, i) => {
    const active = i === state.currentDay;
    const hasData = daysWithData.has(i);
    return `<button class="day-pill${active ? ' active' : ''}${hasData ? ' has-data' : ''}" data-day="${i}">${name}</button>`;
  }).join('');

  const dateLabel = `${dayNames[state.currentDay]}, ${formatDayDate(state.currentDay)}`;

  let bodyHtml = '';
  if (!workout) {
    bodyHtml = `<div class="day-header"><div class="day-title">${dateLabel}</div></div>
      <div class="empty-state">Rest day. Enjoy your recovery!<br><br><button class="replace-day-btn" id="replaceWorkoutBtn" type="button">Add Workout</button></div>`;
  } else {
    const badgeClass = workout.type?.toLowerCase().includes('cardio') ? 'badge-yellow'
      : workout.type?.toLowerCase().includes('rest') ? 'badge-gray'
      : workout.type?.toLowerCase().includes('lower') ? 'badge-green'
      : 'badge-blue';

    const hasWarmup = workout.warmup?.length > 0;
    const hasCooldown = workout.cooldown?.length > 0;
    const hasStretches = hasWarmup || hasCooldown;

    // Sub-tabs (only if stretches exist)
    let subtabsHtml = '';
    if (hasStretches) {
      subtabsHtml = `<div class="workout-subtabs">
        ${hasWarmup ? `<button class="workout-subtab${activeSubtab === 'warmup' ? ' active' : ''}" data-subtab="warmup">Warm-Up</button>` : ''}
        <button class="workout-subtab${activeSubtab === 'workout' ? ' active' : ''}" data-subtab="workout">Workout</button>
        ${hasCooldown ? `<button class="workout-subtab${activeSubtab === 'cooldown' ? ' active' : ''}" data-subtab="cooldown">Cool-Down</button>` : ''}
      </div>`;
    }

    // Load stretch checks
    await loadStretchChecks();

    let contentHtml = '';
    if (activeSubtab === 'warmup' && hasWarmup) {
      contentHtml = renderStretches(workout.warmup, 'warmup');
    } else if (activeSubtab === 'cooldown' && hasCooldown) {
      contentHtml = renderStretches(workout.cooldown, 'cooldown');
    } else {
      // Default to workout content
      const tipText = workout.tip || workout.note || '';
      contentHtml = `
        ${tipText ? `<div class="note-card">${esc(tipText)}</div>` : ''}
        <div class="card-group">${renderExercises(workout, state.currentDay)}</div>`;
    }

    let dayNotes = '';
    if (IS_PRODUCTION) {
      try {
        const { loadDayNotes } = await import('./api.js');
        dayNotes = await loadDayNotes(state.currentPlanId, state.currentDay);
      } catch (e) { /* silent */ }
    } else {
      const notesKey = `${state.currentPlanId}_${state.currentDay}_notes`;
      const allNotes = JSON.parse(localStorage.getItem('hh-day-notes') || '{}');
      dayNotes = allNotes[notesKey] || '';
    }

    bodyHtml = `
      <div class="day-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="day-title">${dateLabel}</div>
            <div class="day-badges">
              <span class="badge ${badgeClass}">${esc(workout.type || workout.title)}</span>
              ${workout.duration ? `<span class="day-duration">${esc(workout.duration)}</span>` : ''}
            </div>
          </div>
          <button class="replace-day-btn" id="replaceWorkoutBtn" type="button">Replace</button>
        </div>
      </div>
      ${subtabsHtml}
      <textarea class="day-notes" id="dayNotesInput" placeholder="How are you feeling? Energy, soreness, sleep...">${esc(dayNotes)}</textarea>
      ${contentHtml}`;
  }

  container.innerHTML = `
    <div class="section-header"><div class="section-title">Workout</div>${getWeekPickerHtml()}</div>
    <div class="day-pills-wrap"><div class="day-pills">${pillsHtml}</div></div>
    ${bodyHtml}`;

  // Center active pill
  const pillsEl = container.querySelector('.day-pills');
  if (pillsEl) {
    const activePill = container.querySelector('.day-pill.active');
    if (activePill) {
      const offset = activePill.offsetLeft - pillsEl.offsetLeft - (pillsEl.clientWidth / 2) + (activePill.clientWidth / 2);
      pillsEl.scrollLeft = Math.max(0, offset);
    }
  }

  // Week navigation
  initWeekNav(renderWorkout, container);

  // Event handlers
  container.querySelectorAll('.day-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentDay = parseInt(btn.dataset.day);
      state.expandedExercise = null;
      activeSubtab = 'workout';
      renderWorkout(container);
    });
  });

  container.querySelectorAll('.ex-header').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      state.expandedExercise = state.expandedExercise === key ? null : key;
      renderWorkout(container);
    });
  });

  container.querySelectorAll('.set-input').forEach(input => {
    input.addEventListener('input', () => handleSetInput(input, container));
  });

  // Replace day button
  const replaceBtn = document.getElementById('replaceWorkoutBtn');
  if (replaceBtn) {
    replaceBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { openOverrideModal } = await import('./override.js');
      openOverrideModal('workout', state.currentDay);
    });
  }

  // Day notes handler
  const notesInput = document.getElementById('dayNotesInput');
  if (notesInput) {
    let notesTimer;
    notesInput.addEventListener('input', () => {
      clearTimeout(notesTimer);
      notesTimer = setTimeout(async () => {
        if (IS_PRODUCTION) {
          try {
            const { upsertDayNotes } = await import('./api.js');
            await upsertDayNotes(state.currentPlanId, state.currentDay, notesInput.value);
          } catch (e) { /* silent */ }
        } else {
          const allNotes = JSON.parse(localStorage.getItem('hh-day-notes') || '{}');
          allNotes[`${state.currentPlanId}_${state.currentDay}_notes`] = notesInput.value;
          localStorage.setItem('hh-day-notes', JSON.stringify(allNotes));
        }
      }, 500);
    });
  }

  // RPE select handler
  container.querySelectorAll('.rpe-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const exIdx = parseInt(sel.dataset.ex);
      if (IS_PRODUCTION) {
        try {
          const { upsertRpe } = await import('./api.js');
          await upsertRpe(state.currentPlanId, state.currentDay, exIdx, sel.value);
        } catch (e) { /* silent */ }
      } else {
        const rpeKey = `${state.currentPlanId}_${state.currentDay}_rpe_${exIdx}`;
        const allRpe = JSON.parse(localStorage.getItem('hh-rpe') || '{}');
        allRpe[rpeKey] = sel.value;
        localStorage.setItem('hh-rpe', JSON.stringify(allRpe));
      }
    });
  });

  // Timer skip button
  const skipBtn = document.getElementById('timerSkipBtn');
  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopRestTimer();
      renderWorkout(container);
    });
  }

  // Sub-tab handlers
  container.querySelectorAll('.workout-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSubtab = btn.dataset.subtab;
      renderWorkout(container);
    });
  });

  // Stretch check handlers
  container.querySelectorAll('.stretch-item').forEach(el => {
    el.addEventListener('click', async () => {
      const type = el.dataset.type;
      const idx = parseInt(el.dataset.idx);
      const key = `${state.currentPlanId}_${state.currentDay}_${type}_${idx}`;
      stretchChecks[key] = !stretchChecks[key];
      if (IS_PRODUCTION) {
        try {
          const { upsertStretchCheck } = await import('./api.js');
          await upsertStretchCheck(state.currentPlanId, state.currentDay, type, idx, stretchChecks[key]);
        } catch (e) { /* silent */ }
      } else {
        const all = getLocalStretchChecks();
        Object.assign(all, stretchChecks);
        saveLocalStretchChecks(all);
      }
      renderWorkout(container);
    });
  });
}

async function loadStretchChecks() {
  stretchChecks = {};
  if (IS_PRODUCTION) {
    try {
      const { loadStretchChecks: loadFromApi } = await import('./api.js');
      const data = await loadFromApi(state.currentPlanId, state.currentDay);
      data.forEach(r => {
        const key = `${state.currentPlanId}_${state.currentDay}_${r.stretch_type}_${r.stretch_index}`;
        stretchChecks[key] = r.checked;
      });
    } catch (e) { /* silent */ }
  } else {
    const all = getLocalStretchChecks();
    stretchChecks = all;
  }
}

function renderStretches(stretches, type) {
  if (!stretches || stretches.length === 0) return '<div class="empty-state">No stretches listed.</div>';

  const done = stretches.filter((_, i) => {
    const key = `${state.currentPlanId}_${state.currentDay}_${type}_${i}`;
    return stretchChecks[key];
  }).length;

  const itemsHtml = stretches.map((s, i) => {
    const key = `${state.currentPlanId}_${state.currentDay}_${type}_${i}`;
    const ch = !!stretchChecks[key];
    const name = typeof s === 'string' ? s : s.name;
    const duration = typeof s === 'object' ? s.duration : '';
    const note = typeof s === 'object' ? s.notes : '';
    return `<div class="stretch-item" data-type="${escAttr(type)}" data-idx="${i}">
      <div class="stretch-check${ch ? ' checked' : ''}"><span class="stretch-checkmark">\u2713</span></div>
      <div style="flex:1">
        <div class="stretch-name${ch ? ' done' : ''}">${esc(name)}</div>
        ${note ? `<div class="stretch-note">${esc(note)}</div>` : ''}
      </div>
      ${duration ? `<span class="stretch-detail">${esc(duration)}</span>` : ''}
    </div>`;
  }).join('');

  return `
    <div class="progress-wrap"><div class="progress-bar" style="width:${stretches.length > 0 ? Math.round((done / stretches.length) * 100) : 0}%"></div></div>
    <div class="progress-label">${done} of ${stretches.length} stretches done</div>
    <div class="card-group"><div class="stretch-card">${itemsHtml}</div></div>`;
}

function formatDayDate(dayIndex) {
  // Compute actual date from current week's Monday
  if (state.currentPlan?.weekStart) {
    const mon = new Date(state.currentPlan.weekStart + 'T12:00:00');
    const d = new Date(mon);
    d.setDate(mon.getDate() + dayIndex);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return '';
}

async function loadRemoteLogs(loadWorkoutLogs, dayIndex) {
  logs = {};
  try {
    const data = await loadWorkoutLogs(state.currentPlanId, dayIndex);
    data.forEach(row => {
      if (!logs[row.exercise_index]) logs[row.exercise_index] = {};
      logs[row.exercise_index][row.set_index] = {
        weight: row.weight != null ? String(row.weight) : '',
        reps: row.reps != null ? String(row.reps) : '',
      };
    });
  } catch (e) {
    showToast('Failed to load workout data', 'error');
  }
}

function loadPreviousLogs(dayIndex) {
  prevLogs = {};
  const allLogData = getLocalLogs();
  const currentWorkout = (state.currentPlan?.workouts || []).find(w => w.day === dayIndex);
  if (!currentWorkout) return;

  // Get all weeks sorted by date descending, skip current week
  const sortedWeeks = [...state.weeks]
    .filter(w => (w.id || w.weekStart) !== state.currentPlanId)
    .sort((a, b) => (b.weekStart || b.id).localeCompare(a.weekStart || a.id));

  // For each exercise in current workout, find most recent logged data by name
  (currentWorkout.exercises || []).forEach((ex, exIdx) => {
    for (const week of sortedWeeks) {
      const weekId = week.id || week.weekStart;
      const weekPlan = week.planData;
      if (!weekPlan?.workouts) continue;

      // Find matching exercise by name in any day of that week
      for (const wd of weekPlan.workouts) {
        const matchExIdx = (wd.exercises || []).findIndex(e => normalizeExName(e.name) === normalizeExName(ex.name));
        if (matchExIdx >= 0) {
          const logKey = `${weekId}_${wd.day}`;
          const dayLogs = allLogData[logKey];
          if (dayLogs && dayLogs[matchExIdx]) {
            prevLogs[exIdx] = {};
            Object.entries(dayLogs[matchExIdx]).forEach(([si, data]) => {
              prevLogs[exIdx][parseInt(si)] = data;
            });
            return; // found for this exercise, stop searching older weeks
          }
        }
      }
    }
  });
}

function loadLocalDayLogs(dayIndex) {
  logs = {};
  const all = getLocalLogs();
  const key = `${state.currentPlanId}_${dayIndex}`;
  const dayLogs = all[key] || {};
  Object.entries(dayLogs).forEach(([exIdx, sets]) => {
    logs[parseInt(exIdx)] = {};
    Object.entries(sets).forEach(([setIdx, data]) => {
      logs[parseInt(exIdx)][parseInt(setIdx)] = data;
    });
  });
}

function renderExercises(workout, dayIndex) {
  const clockIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

  return (workout.exercises || []).map((ex, exIdx) => {
    const key = `${dayIndex}_${exIdx}`;
    const isExpanded = state.expandedExercise === key;
    const exLogs = logs[exIdx] || {};

    // Equipment-aware labels
    const equip = (ex.equipment || '').toLowerCase();
    const isBodyweight = equip === 'bodyweight';

    // Check if all target sets are complete
    const targetSets = ex.sets || 3;
    let completedSets = 0;
    for (let si = 0; si < targetSets; si++) {
      const sl = exLogs[si];
      if (sl && ((isBodyweight || sl.weight) && sl.reps)) completedSets++;
    }
    const isComplete = completedSets >= targetSets;
    const equipMap = {
      'barbell':        { label: 'Weight (bar total)',  placeholder: 'bar lbs', badge: 'barbell' },
      'dumbbell':       { label: 'Weight (per DB)',     placeholder: 'lbs/ea',  badge: 'dumbbell' },
      'cable':          { label: 'Weight (stack)',      placeholder: 'stack',   badge: 'cable' },
      'cable-single':   { label: 'Weight (per arm)',    placeholder: 'lbs/arm', badge: 'cable' },
      'machine':        { label: 'Weight (lbs)',        placeholder: 'lbs',     badge: 'machine' },
      'machine-single': { label: 'Weight (per arm)',    placeholder: 'lbs/arm', badge: 'iso machine' },
      'bodyweight':     { label: '',                    placeholder: '',        badge: 'BW' },
    };
    const em = equipMap[equip] || { label: 'Weight (lbs)', placeholder: 'lbs', badge: '' };
    const weightLabel = em.label;
    const weightPlaceholder = em.placeholder;
    const equipBadge = em.badge
      ? `<span class="equip-badge">${em.badge}</span>`
      : '';

    // Rest info
    const restSets = ex.restBetweenSets || '';
    const restExercise = ex.restBetweenExercises || '';

    // Failure / AMRAP detection
    const repsLower = (ex.reps || '').toLowerCase();
    const isFailure = repsLower.includes('failure') || repsLower.includes('amrap');
    const repsPlaceholder = isFailure ? 'to failure' : 'reps';

    let setArea = '';
    if (isExpanded) {
      const numSets = Math.max(Object.keys(exLogs).length, ex.sets || 3);
      const prevEx = prevLogs[exIdx] || {};
      const setRows = Array.from({ length: numSets }, (_, si) => {
        const sl = exLogs[si] || { weight: '', reps: '' };
        const prev = prevEx[si];
        const wPh = prev?.weight ? `${prev.weight}` : weightPlaceholder;
        const rPh = prev?.reps ? `${prev.reps}` : repsPlaceholder;
        return `<div class="set-row${isBodyweight ? ' bw-row' : ''}">
          <span class="set-num">S${si + 1}</span>
          ${isBodyweight ? '<span class="set-bw-label">BW</span>' : `<input class="set-input${prev?.weight && !sl.weight ? ' has-prev' : ''}" type="number" inputmode="decimal" placeholder="${wPh}"
            value="${sl.weight}" data-ex="${exIdx}" data-set="${si}" data-field="weight"/>`}
          <input class="set-input${prev?.reps && !sl.reps ? ' has-prev' : ''}" type="number" inputmode="decimal" placeholder="${rPh}"
            value="${sl.reps}" data-ex="${exIdx}" data-set="${si}" data-field="reps"/>
        </div>`;
      }).join('');

      // Rest info lines
      const restSetHtml = restSets ? `<div class="rest-info">${clockIcon} Rest <b>${esc(restSets)}</b> between sets</div>` : '';
      const restExHtml = restExercise ? `<div class="rest-between-exercises">${clockIcon} Rest <b>${esc(restExercise)}</b> before next exercise</div>` : '';

      // Timer display
      const timerHtml = activeTimer && activeTimer.exIdx === exIdx
        ? `<div class="rest-timer">
            <span class="rest-timer-label">Rest</span>
            <span class="rest-timer-time" id="timerDisplay">${formatTimer(activeTimer.seconds)}</span>
            <button class="rest-timer-btn" id="timerSkipBtn">Skip</button>
          </div>`
        : '';

      // RPE selector
      const currentRpe = rpeData[exIdx] || '';
      const rpeOpts = ['', '6', '7', '7.5', '8', '8.5', '9', '9.5', '10'].map(v =>
        `<option value="${v}"${v === currentRpe ? ' selected' : ''}>${v || 'RPE'}</option>`
      ).join('');
      const rpeHtml = `<div class="rpe-row">
        <span class="rpe-label">Difficulty</span>
        <select class="rpe-select" data-ex="${exIdx}">${rpeOpts}</select>
      </div>`;

      setArea = `<div class="set-area">
        ${restSetHtml}
        <div class="set-header"><span></span><span>${isBodyweight ? '' : weightLabel}</span><span>${isFailure ? 'Reps (failure)' : 'Reps'}</span></div>
        ${setRows}
        ${rpeHtml}
        ${timerHtml}
        ${restExHtml}
      </div>`;
    }

    return `<div class="ex-card${isComplete ? ' complete' : ''}">
      <div class="ex-header" data-key="${escAttr(key)}">
        <div>
          <div class="ex-name">${esc(ex.name)} ${equipBadge}</div>
          ${ex.notes ? `<div class="ex-note">${esc(ex.notes)}</div>` : ''}
        </div>
        <div class="ex-right">
          <span class="ex-reps-label">${esc(ex.sets)} \u00D7 ${esc(ex.reps)}</span>
          <span class="ex-arrow">${isExpanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>
      ${setArea}
    </div>`;
  }).join('');
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseRestToSeconds(rest) {
  if (!rest) return 0;
  const str = rest.toLowerCase().trim();
  const match = str.match(/^(\d+)\s*(sec|s|min|m|minutes|seconds)?/);
  if (!match) return 0;
  const val = parseInt(match[1]);
  const unit = match[2] || 'sec';
  if (unit.startsWith('m')) return val * 60;
  return val;
}

function startRestTimer(exIdx, restString, container) {
  stopRestTimer();
  const seconds = parseRestToSeconds(restString);
  if (seconds <= 0) return;
  activeTimer = { exIdx, seconds, interval: null };
  activeTimer.interval = setInterval(() => {
    activeTimer.seconds--;
    const display = document.getElementById('timerDisplay');
    if (display) {
      display.textContent = formatTimer(activeTimer.seconds);
    }
    if (activeTimer.seconds <= 0) {
      stopRestTimer();
      renderWorkout(container);
    }
  }, 1000);
  renderWorkout(container);
}

export function stopRestTimer() {
  if (activeTimer?.interval) {
    clearInterval(activeTimer.interval);
  }
  activeTimer = null;
}

function handleSetInput(input, container) {
  const exIdx = parseInt(input.dataset.ex);
  const setIdx = parseInt(input.dataset.set);
  const field = input.dataset.field;
  const value = input.value;

  if (!logs[exIdx]) logs[exIdx] = {};
  if (!logs[exIdx][setIdx]) logs[exIdx][setIdx] = { weight: '', reps: '' };
  logs[exIdx][setIdx][field] = value;

  const timerKey = `${exIdx}_${setIdx}`;
  if (debounceTimers[timerKey]) clearTimeout(debounceTimers[timerKey]);
  debounceTimers[timerKey] = setTimeout(async () => {
    if (IS_PRODUCTION) {
      try {
        const { upsertSet } = await import('./api.js');
        const workout = (state.currentPlan.workouts || []).find(w => w.day === state.currentDay);
        const exName = workout?.exercises[exIdx]?.name || '';
        const sl = logs[exIdx][setIdx];
        await upsertSet(state.currentPlanId, state.currentDay, exIdx, setIdx, exName, sl.weight, sl.reps);
      } catch (e) {
        showToast('Failed to save set', 'error');
      }
    } else {
      // Demo: save to localStorage
      const all = getLocalLogs();
      const key = `${state.currentPlanId}_${state.currentDay}`;
      if (!all[key]) all[key] = {};
      if (!all[key][exIdx]) all[key][exIdx] = {};
      all[key][exIdx][setIdx] = logs[exIdx][setIdx];
      saveLocalLogs(all);
    }

    // Start rest timer if both weight and reps are filled
    const sl = logs[exIdx][setIdx];
    if (sl.weight && sl.reps) {
      const workout = (state.currentPlan.workouts || []).find(w => w.day === state.currentDay);
      const ex = workout?.exercises[exIdx];
      if (ex) {
        const totalSets = ex.sets || 3;
        const isLastSet = setIdx >= totalSets - 1;
        const restStr = isLastSet ? (ex.restBetweenExercises || ex.restBetweenSets) : ex.restBetweenSets;
        if (restStr) {
          startRestTimer(exIdx, restStr, container);
        }
      }
    }
  }, 500);
}
