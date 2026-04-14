import { state, formatWeekRange, getCurrentMonday } from './state.js';
import { showToast } from './toast.js';
import { IS_PRODUCTION } from './config.js';
import { renderCurrentTab } from './router.js';
import { esc, escAttr } from './sanitize.js';
import { validateMealCollection, validateMealOverrides } from './plan-validation.js';
import { normalize } from './import-normalize.js';
import { validateSmart } from './import-validate.js';
import { showPreview } from './import-preview.js';

const overlay = document.getElementById('importModal');
const textarea = document.getElementById('importJson');
const errorEl = document.getElementById('importError');
const submitBtn = document.getElementById('importSubmit');
const cancelBtn = document.getElementById('importCancel');

const statusEl = document.getElementById('importStatus');
const fileInput = document.getElementById('importFileInput');

export function initImport() {
  document.getElementById('importBtn')?.addEventListener('click', openModal);
  cancelBtn.addEventListener('click', closeModal);
  submitBtn.addEventListener('click', handleImport);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  // File upload
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_SIZE) {
      showError(`File too large (max ${MAX_IMPORT_SIZE / 1024}KB)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      textarea.value = reader.result;
      fileInput.value = '';
      liveValidate();
    };
    reader.readAsText(file);
  });

  // Live validation on input
  textarea?.addEventListener('input', debounce(liveValidate, 400));
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function liveValidate() {
  const raw = textarea.value.trim();
  if (!raw) {
    setStatus('');
    errorEl.classList.remove('show');
    return;
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    setStatus('invalid', 'Invalid JSON');
    return;
  }
  const err = validate(json);
  if (err) {
    setStatus('invalid', err);
  } else {
    setStatus('valid', 'Valid plan \u2014 click Import to preview');
    errorEl.classList.remove('show');
  }
}

function setStatus(type, msg) {
  if (!statusEl) return;
  if (!type) { statusEl.textContent = ''; statusEl.className = 'import-status'; return; }
  statusEl.textContent = msg || '';
  statusEl.className = `import-status ${type}`;
  if (type === 'invalid') {
    errorEl.textContent = msg;
    errorEl.classList.add('show');
  }
}

function openModal() {
  textarea.value = '';
  errorEl.textContent = '';
  errorEl.classList.remove('show');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Import';
  setStatus('');
  overlay.classList.add('open');
  setTimeout(() => textarea.focus(), 300);
}

function closeModal() {
  overlay.classList.remove('open');
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('show');
}

// --- Original validation (kept for live status indicator) ---
function validate(json) {
  if (!json || typeof json !== 'object') return 'Invalid JSON object';

  if (typeof json.weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(json.weekStart)) {
    return 'weekStart must be a date string in YYYY-MM-DD format';
  }
  const testDate = new Date(json.weekStart + 'T12:00:00');
  if (testDate.getDay() !== 1) {
    return 'weekStart must be a Monday';
  }

  if (!Array.isArray(json.workouts) || json.workouts.length === 0) {
    return 'workouts must be a non-empty array';
  }
  for (let i = 0; i < json.workouts.length; i++) {
    const w = json.workouts[i];
    if (typeof w.day !== 'number' || w.day < 0 || w.day > 6) {
      return `workouts[${i}].day must be 0-6`;
    }
    if (!w.title || typeof w.title !== 'string') {
      return `workouts[${i}].title is required`;
    }
    if (!Array.isArray(w.exercises)) {
      return `workouts[${i}].exercises must be an array`;
    }
    for (let j = 0; j < w.exercises.length; j++) {
      const ex = w.exercises[j];
      if (!ex.name || typeof ex.name !== 'string') {
        return `workouts[${i}].exercises[${j}].name is required`;
      }
      if (typeof ex.sets !== 'number' || ex.sets < 1) {
        return `workouts[${i}].exercises[${j}].sets must be >= 1`;
      }
      if (!ex.reps || typeof ex.reps !== 'string') {
        return `workouts[${i}].exercises[${j}].reps is required (string)`;
      }
    }
  }

  if (!json.meals || typeof json.meals !== 'object' || Object.keys(json.meals).length === 0) {
    return 'meals must be an object with at least one key';
  }
  const mealErr = validateMealCollection(json.meals, 'meals');
  if (mealErr) return mealErr;
  const mealOverrideErr = validateMealOverrides(json.mealOverrides, 'mealOverrides');
  if (mealOverrideErr) return mealOverrideErr;

  if (!json.grocery || typeof json.grocery !== 'object' || Object.keys(json.grocery).length === 0) {
    return 'grocery must be an object with at least one category';
  }
  for (const [cat, items] of Object.entries(json.grocery)) {
    if (!Array.isArray(items) || items.length === 0) {
      return `grocery.${cat} must be a non-empty array`;
    }
  }

  return null;
}

// --- New preview-based import flow ---
const MAX_IMPORT_SIZE = 100 * 1024;

async function handleImport() {
  errorEl.classList.remove('show');
  const raw = textarea.value.trim();
  if (!raw) {
    showError('Please paste your JSON plan');
    return;
  }
  if (raw.length > MAX_IMPORT_SIZE) {
    showError(`Import too large (max ${MAX_IMPORT_SIZE / 1024}KB)`);
    return;
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    showError('Invalid JSON: ' + e.message);
    return;
  }

  // Normalize
  const { normalized, repairs } = normalize(json);

  // Smart validate
  const validation = validateSmart(normalized, 'full');

  // Fetch existing plan for this weekStart
  let existingPlan = null;
  let existingId = null;

  if (normalized.weekStart) {
    try {
      if (IS_PRODUCTION) {
        const { findWeekByDate, fetchPlan } = await import('./api.js');
        const existing = await findWeekByDate(normalized.weekStart);
        if (existing) {
          existingId = existing.id;
          const full = await fetchPlan(existing.id);
          existingPlan = full.plan_data;
        }
      } else {
        const weeks = JSON.parse(localStorage.getItem('hh-weeks') || '[]');
        const existing = weeks.find(w => w.weekStart === normalized.weekStart);
        if (existing) {
          existingId = existing.id || existing.weekStart;
          existingPlan = existing.planData;
        }
      }
    } catch (e) {
      // Non-fatal — just skip diff
    }
  }

  // Show preview
  showPreview({
    normalized,
    repairs,
    validation,
    existingPlan,
    existingId,
    onConfirm: (mode) => doImport(normalized, mode, existingPlan, existingId),
    onCancel: () => { /* user cancelled preview, stay on textarea */ },
  });
}

async function doImport(normalized, mode, existingPlan, existingId) {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Importing...';

  try {
    // Build the final plan data
    let planData;
    if (mode === 'full') {
      planData = normalized;
    } else {
      // Partial import: merge selected section into existing (or create minimal)
      planData = existingPlan ? structuredClone(existingPlan) : {
        weekStart: normalized.weekStart,
        workouts: [],
        meals: {},
        grocery: {},
      };
      // Ensure weekStart from the import
      planData.weekStart = normalized.weekStart;

      if (mode === 'workouts') {
        planData.workouts = normalized.workouts || [];
      } else if (mode === 'meals') {
        planData.meals = normalized.meals || {};
        planData.mealOverrides = normalized.mealOverrides;
      } else if (mode === 'grocery') {
        planData.grocery = normalized.grocery || {};
      }
    }

    const label = formatWeekRange(normalized.weekStart);

    if (IS_PRODUCTION) {
      const { createWeek, updateWeek } = await import('./api.js');
      if (existingId) {
        await updateWeek(existingId, planData, label);
        showToast('Week updated!', 'success');
      } else {
        await createWeek(normalized.weekStart, label, planData);
        showToast('Week imported!', 'success');
      }
      closeModal();
      const { loadWeeks } = await import('./weeks.js');
      await loadWeeks();
    } else {
      // Demo mode
      const weeks = JSON.parse(localStorage.getItem('hh-weeks') || '[]');
      const idx = weeks.findIndex(w => w.weekStart === normalized.weekStart);
      const entry = {
        id: normalized.weekStart,
        weekStart: normalized.weekStart,
        label,
        planData,
      };
      if (idx >= 0) {
        weeks[idx] = entry;
      } else {
        weeks.unshift(entry);
      }
      localStorage.setItem('hh-weeks', JSON.stringify(weeks));

      state.weeks = weeks;
      if (!state.currentPlanId) {
        state.currentPlanId = entry.id;
        state.currentPlan = planData;
      }
      if (state.currentPlanId === entry.id) {
        state.currentPlan = planData;
      }
      updateWeekPicker();
      showToast(existingId ? 'Week updated!' : 'Week imported!', 'success');
      closeModal();
      renderCurrentTab();
    }
  } catch (e) {
    showError('Import failed: ' + e.message);
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Import';
}

// --- Week picker (demo mode) ---
function updateWeekPicker() {
  const pickerEl = document.getElementById('weekPicker');
  if (!pickerEl) return;
  if (state.weeks.length === 0) {
    pickerEl.innerHTML = '<span style="font-size:13px;color:var(--text-tertiary)">No weeks yet</span>';
    return;
  }
  const opts = state.weeks.map(w => {
    const label = w.label || `Week of ${w.weekStart}`;
    const id = w.id || w.weekStart;
    return `<option value="${escAttr(id)}"${id === state.currentPlanId ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
  pickerEl.innerHTML = `<select id="weekSelect">${opts}</select>`;
  document.getElementById('weekSelect').addEventListener('change', (e) => {
    const id = e.target.value;
    const week = state.weeks.find(w => (w.id || w.weekStart) === id);
    if (week) {
      state.currentPlanId = id;
      state.currentPlan = week.planData;
      state.expandedExercise = null;
      renderCurrentTab();
    }
  });
}

export function loadDemoWeeks() {
  const weeks = JSON.parse(localStorage.getItem('hh-weeks') || '[]');
  state.weeks = weeks;
  if (weeks.length > 0) {
    const monday = getCurrentMonday();
    const match = weeks.find(w => (w.weekStart || w.id) === monday);
    const selected = match || weeks[0];
    state.currentPlanId = selected.id || selected.weekStart;
    state.currentPlan = selected.planData;
    updateWeekPicker();
  }
}
