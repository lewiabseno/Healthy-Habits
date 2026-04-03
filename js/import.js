import { state, formatWeekRange, getCurrentMonday } from './state.js';
import { showToast } from './toast.js';
import { IS_PRODUCTION } from './config.js';
import { renderCurrentTab } from './router.js';
import { esc, escAttr } from './sanitize.js';

const overlay = document.getElementById('importModal');
const textarea = document.getElementById('importJson');
const errorEl = document.getElementById('importError');
const submitBtn = document.getElementById('importSubmit');
const cancelBtn = document.getElementById('importCancel');

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
}

function openModal() {
  textarea.value = '';
  errorEl.textContent = '';
  errorEl.classList.remove('show');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Import';
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
  for (const [key, meal] of Object.entries(json.meals)) {
    if (!meal.name || typeof meal.name !== 'string') {
      return `meals.${key}.name is required`;
    }
  }

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

const MAX_IMPORT_SIZE = 100 * 1024; // 100KB

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

  const err = validate(json);
  if (err) {
    showError(err);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Importing...';

  try {
    if (IS_PRODUCTION) {
      const { createWeek, updateWeek, findWeekByDate } = await import('./api.js');
      const existing = await findWeekByDate(json.weekStart);
      if (existing) {
        const overwrite = await confirmOverwrite(json.weekStart);
        if (!overwrite) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Import';
          return;
        }
        await updateWeek(existing.id, json, formatWeekRange(json.weekStart));
        showToast('Week updated!', 'success');
      } else {
        await createWeek(json.weekStart, formatWeekRange(json.weekStart), json);
        showToast('Week imported!', 'success');
      }
      closeModal();
      const { loadWeeks } = await import('./weeks.js');
      await loadWeeks();
    } else {
      // Demo mode: store in localStorage
      const weeks = JSON.parse(localStorage.getItem('hh-weeks') || '[]');
      const idx = weeks.findIndex(w => w.weekStart === json.weekStart);
      const entry = {
        id: json.weekStart,
        weekStart: json.weekStart,
        label: formatWeekRange(json.weekStart),
        planData: json,
      };
      if (idx >= 0) {
        const overwrite = await confirmOverwrite(json.weekStart);
        if (!overwrite) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Import';
          return;
        }
        weeks[idx] = entry;
      } else {
        weeks.unshift(entry);
      }
      localStorage.setItem('hh-weeks', JSON.stringify(weeks));

      // Update state — keep current week, just refresh the list
      state.weeks = weeks;
      // If no week was selected, select the new one
      if (!state.currentPlanId) {
        state.currentPlanId = entry.id;
        state.currentPlan = json;
      }
      // If overwriting the current week, update its plan data
      if (state.currentPlanId === entry.id) {
        state.currentPlan = json;
      }
      updateWeekPicker();
      showToast('Week imported!', 'success');
      closeModal();
      renderCurrentTab();
    }
  } catch (e) {
    showError('Import failed: ' + e.message);
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Import';
}

function updateWeekPicker() {
  const pickerEl = document.getElementById('weekPicker');
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

// Also load demo weeks on init if in demo mode
export function loadDemoWeeks() {
  const weeks = JSON.parse(localStorage.getItem('hh-weeks') || '[]');
  state.weeks = weeks;
  if (weeks.length > 0) {
    // Auto-select current week by date, fallback to most recent
    const monday = getCurrentMonday();
    const match = weeks.find(w => (w.weekStart || w.id) === monday);
    const selected = match || weeks[0];
    state.currentPlanId = selected.id || selected.weekStart;
    state.currentPlan = selected.planData;
    updateWeekPicker();
  }
}

function confirmOverwrite(weekStart) {
  return new Promise(resolve => {
    const container = document.getElementById('confirmContainer');
    container.innerHTML = `
      <div class="confirm-overlay">
        <div class="confirm-box">
          <div class="confirm-body">
            <div class="confirm-title">Week Exists</div>
            <div class="confirm-message">A plan for week of ${esc(weekStart)} already exists. Overwrite it?</div>
          </div>
          <div class="confirm-actions">
            <button class="confirm-btn cancel" id="confirmNo">Cancel</button>
            <button class="confirm-btn destructive" id="confirmYes">Overwrite</button>
          </div>
        </div>
      </div>`;
    document.getElementById('confirmNo').addEventListener('click', () => {
      container.innerHTML = '';
      resolve(false);
    });
    document.getElementById('confirmYes').addEventListener('click', () => {
      container.innerHTML = '';
      resolve(true);
    });
  });
}
