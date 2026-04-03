import { state } from './state.js';
import { showToast } from './toast.js';
import { IS_PRODUCTION } from './config.js';
import { renderCurrentTab } from './router.js';
import { validateMealCollection } from './plan-validation.js';

const overlay = document.getElementById('overrideModal');
const titleEl = document.getElementById('overrideTitle');
const textarea = document.getElementById('overrideJson');
const errorEl = document.getElementById('overrideError');
const submitBtn = document.getElementById('overrideSubmit');
const cancelBtn = document.getElementById('overrideCancel');

let overrideType = null; // 'workout' | 'meals'
let overrideDay = null;

export function initOverride() {
  cancelBtn.addEventListener('click', closeModal);
  submitBtn.addEventListener('click', handleOverride);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });
}

export function openOverrideModal(type, dayIndex) {
  overrideType = type;
  overrideDay = dayIndex;
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  titleEl.textContent = `Replace ${dayNames[dayIndex]} ${type === 'workout' ? 'Workout' : 'Meals'}`;
  textarea.value = '';
  errorEl.textContent = '';
  errorEl.classList.remove('show');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Replace';
  overlay.classList.add('open');
  setTimeout(() => textarea.focus(), 300);
}

function closeModal() {
  overlay.classList.remove('open');
  overrideType = null;
  overrideDay = null;
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('show');
}

function validateWorkout(json) {
  if (!json || typeof json !== 'object') return 'Invalid JSON object';
  if (!json.title || typeof json.title !== 'string') return 'title is required';
  if (!Array.isArray(json.exercises)) return 'exercises must be an array';
  for (let j = 0; j < json.exercises.length; j++) {
    const ex = json.exercises[j];
    if (!ex.name || typeof ex.name !== 'string') return `exercises[${j}].name is required`;
    if (typeof ex.sets !== 'number' || ex.sets < 1) return `exercises[${j}].sets must be >= 1`;
    if (!ex.reps || typeof ex.reps !== 'string') return `exercises[${j}].reps is required (string)`;
  }
  return null;
}

function validateMeals(json) {
  if (!json || typeof json !== 'object') return 'Invalid JSON object';
  return validateMealCollection(json, 'meals');
}

async function handleOverride() {
  errorEl.classList.remove('show');
  const raw = textarea.value.trim();
  if (!raw) { showError('Please paste your JSON'); return; }

  let json;
  try { json = JSON.parse(raw); } catch (e) { showError('Invalid JSON: ' + e.message); return; }

  const err = overrideType === 'workout' ? validateWorkout(json) : validateMeals(json);
  if (err) { showError(err); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Replacing...';

  try {
    if (IS_PRODUCTION) {
      const { updateWeek } = await import('./api.js');
      // Fetch current plan, modify, save back
      const plan = { ...state.currentPlan };
      if (overrideType === 'workout') {
        applyWorkoutOverride(plan, json);
      } else {
        applyMealsOverride(plan, json);
      }
      await updateWeek(state.currentPlanId, plan);
      state.currentPlan = plan;
    } else {
      // Demo mode
      const weeks = JSON.parse(localStorage.getItem('hh-weeks') || '[]');
      const week = weeks.find(w => (w.id || w.weekStart) === state.currentPlanId);
      if (week) {
        if (overrideType === 'workout') {
          applyWorkoutOverride(week.planData, json);
        } else {
          applyMealsOverride(week.planData, json);
        }
        state.currentPlan = week.planData;
        localStorage.setItem('hh-weeks', JSON.stringify(weeks));
      }

      // Clear old logs/checks for this day
      if (overrideType === 'workout') {
        const logs = JSON.parse(localStorage.getItem('hh-workout-logs') || '{}');
        delete logs[`${state.currentPlanId}_${overrideDay}`];
        localStorage.setItem('hh-workout-logs', JSON.stringify(logs));
      } else {
        const checks = JSON.parse(localStorage.getItem('hh-meal-checks') || '{}');
        delete checks[`${state.currentPlanId}_${overrideDay}`];
        localStorage.setItem('hh-meal-checks', JSON.stringify(checks));
      }
    }

    showToast(`${overrideType === 'workout' ? 'Workout' : 'Meals'} replaced!`, 'success');
    closeModal();
    renderCurrentTab();
  } catch (e) {
    showError('Failed: ' + e.message);
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Replace';
}

function applyWorkoutOverride(plan, json) {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const workouts = plan.workouts || [];
  const idx = workouts.findIndex(w => w.day === overrideDay);
  const newWorkout = {
    day: overrideDay,
    dayName: json.dayName || dayNames[overrideDay],
    title: json.title,
    type: json.type || json.title,
    duration: json.duration || '',
    note: json.note || '',
    exercises: json.exercises,
    warmup: json.warmup || [],
    cooldown: json.cooldown || [],
  };
  if (idx >= 0) {
    workouts[idx] = newWorkout;
  } else {
    workouts.push(newWorkout);
    workouts.sort((a, b) => a.day - b.day);
  }
  plan.workouts = workouts;
}

function applyMealsOverride(plan, json) {
  // Replace meals for the day but don't touch grocery
  // We store day-specific meal overrides in plan.mealOverrides
  if (!plan.mealOverrides) plan.mealOverrides = {};
  plan.mealOverrides[overrideDay] = json;
}
