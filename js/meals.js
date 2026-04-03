import { state, formatWeekRange } from './state.js';
import { showToast } from './toast.js';
import { SUPABASE_URL } from './config.js';

const isConfigured = SUPABASE_URL && !SUPABASE_URL.startsWith('YOUR_');

let mealChecks = {};
let groceryChecks = {};
let showingPrep = false;
let expandedMeal = null;
let pillScrollPos = null;
let isInitialRender = true;

// --- localStorage helpers ---
function getLocalMealChecks() {
  try { return JSON.parse(localStorage.getItem('hh-meal-checks') || '{}'); } catch { return {}; }
}
function saveLocalMealChecks(all) { localStorage.setItem('hh-meal-checks', JSON.stringify(all)); }
function getLocalBW() {
  try { return JSON.parse(localStorage.getItem('hh-bodyweight') || '[]'); } catch { return []; }
}
function saveLocalBW(arr) { localStorage.setItem('hh-bodyweight', JSON.stringify(arr)); }
function getLocalGroceryChecks() {
  try { return JSON.parse(localStorage.getItem('hh-grocery-checks') || '{}'); } catch { return {}; }
}
function saveLocalGroceryChecks(all) { localStorage.setItem('hh-grocery-checks', JSON.stringify(all)); }

export async function renderMeals(container) {
  const plan = state.currentPlan;
  if (!plan) {
    container.innerHTML = `<div class="section-header"><div class="section-title">Meals</div><div class="section-subtitle">Tap to mark as eaten</div></div>
      <div class="empty-state">No week imported yet.<br>Tap <b>+ Import</b> to add a weekly plan.</div>`;
    return;
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Build pills
  const prepPill = `<button class="day-pill prep${showingPrep ? ' active' : ''}" data-day="-1">Prep</button>`;
  const dayPillsHtml = dayNames.map((name, i) => {
    const active = !showingPrep && i === state.currentDay;
    return `<button class="day-pill${active ? ' active' : ''}" data-day="${i}">${name}</button>`;
  }).join('');
  const pillsHtml = prepPill + dayPillsHtml;

  let bodyHtml;
  if (showingPrep) {
    bodyHtml = await renderGroceryInline();
  } else {
    bodyHtml = await renderMealDay();
  }

  container.innerHTML = `
    <div class="section-header"><div class="section-title">Meals</div><div class="section-subtitle">${showingPrep ? 'Grocery list for the week' : 'Tap to mark as eaten'}</div></div>
    <div class="day-pills">${pillsHtml}</div>
    ${bodyHtml}`;

  // Restore or init pill scroll position
  const pillsEl = container.querySelector('.day-pills');
  if (pillsEl) {
    if (pillScrollPos != null) {
      pillsEl.scrollLeft = pillScrollPos;
    } else if (isInitialRender) {
      const activePill = container.querySelector('.day-pill.active');
      if (activePill) {
        const offset = activePill.offsetLeft - pillsEl.offsetLeft - (pillsEl.clientWidth / 2) + (activePill.clientWidth / 2);
        pillsEl.scrollLeft = Math.max(0, offset);
      }
    }
    isInitialRender = false;
  }

  // Day pill handlers
  container.querySelectorAll('.day-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      // Save scroll position before re-render
      const pills = container.querySelector('.day-pills');
      if (pills) pillScrollPos = pills.scrollLeft;

      const day = parseInt(btn.dataset.day);
      if (day === -1) {
        showingPrep = true;
      } else {
        showingPrep = false;
        state.currentDay = day;
      }
      renderMeals(container);
    });
  });

  // Replace day button (meals)
  const replaceMealsBtn = document.getElementById('replaceMealsBtn');
  if (replaceMealsBtn) {
    replaceMealsBtn.addEventListener('click', async () => {
      const { openOverrideModal } = await import('./override.js');
      openOverrideModal('meals', state.currentDay);
    });
  }

  // Bodyweight log button
  const bwBtn = document.getElementById('bwInlineBtn');
  if (bwBtn) {
    bwBtn.addEventListener('click', async () => {
      const input = document.getElementById('bwInlineInput');
      const val = input?.value?.trim();
      if (!val || isNaN(parseFloat(val))) {
        showToast('Enter a valid weight', 'error');
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      if (isConfigured) {
        try {
          const { upsertBodyweight } = await import('./api.js');
          await upsertBodyweight(state.userId, today, val, 'lbs');
        } catch (e) { showToast('Failed to log weight', 'error'); return; }
      } else {
        const bwData = getLocalBW();
        const idx = bwData.findIndex(e => e.date === today);
        if (idx >= 0) bwData[idx].weight = parseFloat(val);
        else bwData.push({ date: today, weight: parseFloat(val) });
        saveLocalBW(bwData);
      }
      showToast('Weight logged!', 'success');
      // Update widget in-place instead of full re-render
      const lastLabel = document.querySelector('.bw-inline-last');
      if (lastLabel) lastLabel.textContent = `${val} lbs (today)`;
      if (input) input.value = '';
    });
  }

  // Meal handlers (only when showing meals)
  if (!showingPrep) {
    // Checkbox: toggle eaten
    container.querySelectorAll('.meal-check').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const key = el.closest('.meal-row').dataset.key;
        mealChecks[key] = !mealChecks[key];
        if (isConfigured) {
          try {
            const { upsertMealCheck } = await import('./api.js');
            await upsertMealCheck(state.userId, state.currentPlanId, key, state.currentDay, mealChecks[key]);
          } catch (e2) { showToast('Failed to save', 'error'); mealChecks[key] = !mealChecks[key]; }
        } else {
          const all = getLocalMealChecks();
          all[`${state.currentPlanId}_${state.currentDay}`] = mealChecks;
          saveLocalMealChecks(all);
        }
        renderMeals(container);
      });
    });
    // Row click: expand/collapse recipe
    container.querySelectorAll('.meal-row').forEach(row => {
      row.addEventListener('click', () => {
        const key = row.dataset.key;
        expandedMeal = expandedMeal === key ? null : key;
        renderMeals(container);
      });
    });
  }

  // Grocery item handlers (only when showing prep)
  if (showingPrep) {
    container.querySelectorAll('.grocery-item').forEach(el => {
      el.addEventListener('click', async () => {
        const cat = el.dataset.cat;
        const idx = parseInt(el.dataset.idx);
        const key = `${cat}_${idx}`;
        groceryChecks[key] = !groceryChecks[key];
        if (isConfigured) {
          try {
            const { upsertGroceryCheck } = await import('./api.js');
            await upsertGroceryCheck(state.userId, state.currentPlanId, cat, idx, groceryChecks[key]);
          } catch (e) { showToast('Failed to save', 'error'); groceryChecks[key] = !groceryChecks[key]; }
        } else {
          const all = getLocalGroceryChecks();
          all[state.currentPlanId] = groceryChecks;
          saveLocalGroceryChecks(all);
        }
        renderMeals(container);
      });
    });

    document.getElementById('resetGrocery')?.addEventListener('click', async () => {
      if (!confirm('Reset all grocery checkboxes?')) return;
      groceryChecks = {};
      if (isConfigured) {
        try {
          const { upsertGroceryCheck } = await import('./api.js');
          const grocery = state.currentPlan.grocery || {};
          for (const cat of Object.keys(grocery)) {
            for (let i = 0; i < grocery[cat].length; i++) {
              await upsertGroceryCheck(state.userId, state.currentPlanId, cat, i, false);
            }
          }
        } catch (e) { showToast('Failed to reset', 'error'); }
      } else {
        const all = getLocalGroceryChecks();
        all[state.currentPlanId] = {};
        saveLocalGroceryChecks(all);
      }
      renderMeals(container);
    });
  }
}

// --- Render meal day content ---
async function renderMealDay() {
  // Check for day-specific meal override
  const overrides = state.currentPlan.mealOverrides || {};
  const meals = overrides[state.currentDay] || state.currentPlan.meals || {};
  const isOverridden = !!overrides[state.currentDay];
  const mealKeys = Object.keys(meals);
  if (mealKeys.length === 0) return `<div class="empty-state">No meals in this week's plan.</div>`;

  // Load checks
  if (isConfigured && state.currentPlanId) {
    const { loadMealChecks } = await import('./api.js');
    mealChecks = {};
    try {
      const data = await loadMealChecks(state.currentPlanId, state.currentDay);
      data.forEach(row => { mealChecks[row.meal_key] = row.checked; });
    } catch (e) { showToast('Failed to load meal data', 'error'); }
  } else {
    const all = getLocalMealChecks();
    mealChecks = all[`${state.currentPlanId}_${state.currentDay}`] || {};
  }

  // Compute totals
  let plannedCal = 0, plannedP = 0, plannedC = 0, plannedF = 0;
  let eatenCal = 0, eatenP = 0, eatenC = 0, eatenF = 0;
  const done = mealKeys.filter(k => mealChecks[k]).length;

  mealKeys.forEach(k => {
    const m = meals[k];
    plannedCal += m.calories || 0;
    plannedP += m.protein || 0;
    plannedC += m.carbs || 0;
    plannedF += m.fat || 0;
    if (mealChecks[k]) {
      eatenCal += m.calories || 0;
      eatenP += m.protein || 0;
      eatenC += m.carbs || 0;
      eatenF += m.fat || 0;
    }
  });

  const pct = Math.round((done / mealKeys.length) * 100);

  // Daily totals card
  const totalsHtml = `<div class="daily-totals">
    <div class="daily-totals-row">
      <div class="daily-totals-label">Planned</div>
      <div class="daily-totals-values">
        <span><b>${plannedCal}</b> cal</span>
        <span><b>${plannedP}g</b> P</span>
        <span><b>${plannedC}g</b> C</span>
        <span><b>${plannedF}g</b> F</span>
      </div>
    </div>
    <div class="daily-totals-row eaten">
      <div class="daily-totals-label">Eaten</div>
      <div class="daily-totals-values">
        <span><b>${eatenCal}</b> cal</span>
        <span><b>${eatenP}g</b> P</span>
        <span><b>${eatenC}g</b> C</span>
        <span><b>${eatenF}g</b> F</span>
      </div>
    </div>
  </div>`;

  const mealsHtml = mealKeys.map(key => {
    const m = meals[key];
    const ch = !!mealChecks[key];
    const isExpanded = expandedMeal === key;
    const hasRecipe = m.recipe && (m.recipe.ingredients?.length > 0 || m.recipe.instructions);

    let recipeHtml = '';
    if (isExpanded && hasRecipe) {
      const r = m.recipe;
      recipeHtml = `<div class="meal-recipe">
        ${r.ingredients?.length > 0 ? `<div class="recipe-section"><div class="recipe-heading">Ingredients</div><ul class="recipe-list">${r.ingredients.map(ing => `<li>${ing}</li>`).join('')}</ul></div>` : ''}
        ${r.instructions ? `<div class="recipe-section"><div class="recipe-heading">Instructions</div><div class="recipe-text">${r.instructions}</div></div>` : ''}
        ${r.prepTime ? `<div class="recipe-meta"><span>Prep: ${r.prepTime}</span></div>` : ''}
        ${r.cookTime ? `<div class="recipe-meta"><span>Cook: ${r.cookTime}</span></div>` : ''}
      </div>`;
    }

    return `<div class="meal-entry" data-key="${key}">
      <div class="meal-row" data-key="${key}" data-action="check">
        <div class="meal-check${ch ? ' checked' : ''}"><span class="meal-checkmark">\u2713</span></div>
        <div style="flex:1">
          <div class="meal-name${ch ? ' done' : ''}">${m.name}</div>
          ${m.time ? `<div class="meal-time">${m.time}</div>` : ''}
          ${m.items ? `<div class="meal-items">${m.items}</div>` : ''}
          <div class="meal-macros">
            ${m.calories != null ? `<span><b>${m.calories}</b> cal</span>` : ''}
            ${m.protein != null ? `<span><b>${m.protein}g</b> protein</span>` : ''}
            ${m.carbs != null ? `<span><b>${m.carbs}g</b> carbs</span>` : ''}
            ${m.fat != null ? `<span><b>${m.fat}g</b> fat</span>` : ''}
          </div>
        </div>
        ${hasRecipe ? `<span class="meal-expand-arrow">${isExpanded ? '\u25B2' : '\u25BC'}</span>` : ''}
      </div>
      ${recipeHtml}
    </div>`;
  }).join('');

  const dateLabel = formatDayDate(state.currentDay);

  return `
    <div class="day-header">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="day-title">${dateLabel}</div>
          ${isOverridden ? '<div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">Modified for this day</div>' : ''}
        </div>
        <button class="replace-day-btn" id="replaceMealsBtn" type="button">Replace</button>
      </div>
    </div>
    ${getBodyweightWidget()}
    <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    <div class="progress-label">${done} of ${mealKeys.length} meals eaten</div>
    ${totalsHtml}
    <div class="meal-card">${mealsHtml}</div>`;
}

function getBodyweightWidget() {
  const bwData = getLocalBW();
  const last = bwData.length > 0 ? bwData[bwData.length - 1] : null;
  const today = new Date().toISOString().split('T')[0];
  const loggedToday = last && last.date === today;
  return `<div class="bw-inline-widget">
    <div class="bw-inline-left">
      <span class="bw-inline-label">Weight</span>
      ${last ? `<span class="bw-inline-last">${last.weight} lbs${loggedToday ? ' (today)' : ''}</span>` : '<span class="bw-inline-last">Not logged</span>'}
    </div>
    <div class="bw-inline-right">
      <input class="bw-inline-input" type="number" inputmode="decimal" placeholder="${last ? last.weight : 'lbs'}" id="bwInlineInput"/>
      <button class="bw-inline-btn" id="bwInlineBtn">Log</button>
    </div>
  </div>`;
}

function formatDayDate(dayIndex) {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (state.currentPlan?.weekStart) {
    const mon = new Date(state.currentPlan.weekStart + 'T12:00:00');
    const d = new Date(mon);
    d.setDate(mon.getDate() + dayIndex);
    return `${dayNames[dayIndex]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return dayNames[dayIndex];
}

// --- Render grocery list inline ---
async function renderGroceryInline() {
  const grocery = state.currentPlan.grocery || {};
  const categories = Object.keys(grocery);
  if (categories.length === 0) return `<div class="empty-state">No grocery items in this week's plan.</div>`;

  // Load checks
  if (isConfigured && state.currentPlanId) {
    const { loadGroceryChecks } = await import('./api.js');
    groceryChecks = {};
    try {
      const data = await loadGroceryChecks(state.currentPlanId);
      data.forEach(row => { if (row.checked) groceryChecks[`${row.category}_${row.item_index}`] = true; });
    } catch (e) { showToast('Failed to load grocery data', 'error'); }
  } else {
    const all = getLocalGroceryChecks();
    groceryChecks = all[state.currentPlanId] || {};
  }

  let total = 0, done = 0;
  categories.forEach(cat => {
    grocery[cat].forEach((_, i) => { total++; if (groceryChecks[`${cat}_${i}`]) done++; });
  });

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  let html = `
    <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    <div class="progress-label">${done} of ${total} items checked off</div>`;

  categories.forEach(cat => {
    const items = grocery[cat];
    html += `<div class="grocery-label">${cat}</div><div class="grocery-card">`;
    items.forEach((item, i) => {
      const key = `${cat}_${i}`;
      const ch = !!groceryChecks[key];
      const name = typeof item === 'string' ? item : item.name;
      const qty = typeof item === 'object' ? item.qty : '';
      html += `<div class="grocery-item" data-cat="${cat}" data-idx="${i}">
        <div class="grocery-check${ch ? ' checked' : ''}"><span class="grocery-checkmark">\u2713</span></div>
        <span class="grocery-name${ch ? ' done' : ''}">${name}</span>
        ${qty ? `<span class="grocery-qty">${qty}</span>` : ''}
      </div>`;
    });
    html += '</div>';
  });

  html += `<button class="reset-btn" id="resetGrocery">Reset all checkboxes</button>`;
  return html;
}
