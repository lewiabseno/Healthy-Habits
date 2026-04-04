import { state } from './state.js';
import { savePlan } from './plan-save.js';
import { showToast } from './toast.js';
import { esc } from './sanitize.js';

export function openEditMeal(mealKey, onSave) {
  const meals = state.currentPlan.meals || {};
  const isNew = !mealKey;
  const meal = isNew ? { name: '', time: '', items: '', calories: '', protein: '', carbs: '', fat: '' } : { ...meals[mealKey] };
  const editKey = isNew ? '' : mealKey;

  const container = document.getElementById('confirmContainer');
  container.innerHTML = `
    <div class="confirm-overlay" style="align-items:flex-end">
      <div class="modal-panel" style="max-width:500px;border-radius:16px 16px 0 0;max-height:85vh">
        <div class="modal-handle"></div>
        <div class="modal-title">${isNew ? 'Add Meal' : 'Edit Meal'}</div>
        <div class="edit-form">
          ${isNew ? `<label class="edit-label">Meal Slot (e.g. breakfast, snack1, lunch)</label>
          <input class="edit-input" id="editMealKey" placeholder="Meal slot name">` : ''}

          <label class="edit-label">Name</label>
          <input class="edit-input" id="editMealName" value="${esc(meal.name || '')}" placeholder="Meal name">

          <label class="edit-label">Time</label>
          <input class="edit-input" id="editMealTime" value="${esc(meal.time || '')}" placeholder="e.g. 7-8 AM">

          <label class="edit-label">Description</label>
          <input class="edit-input" id="editMealItems" value="${esc(meal.items || '')}" placeholder="Ingredients list">

          <div class="edit-row">
            <div class="edit-col">
              <label class="edit-label">Calories</label>
              <input class="edit-input" id="editMealCal" type="number" inputmode="numeric" value="${meal.calories || ''}">
            </div>
            <div class="edit-col">
              <label class="edit-label">Protein (g)</label>
              <input class="edit-input" id="editMealP" type="number" inputmode="numeric" value="${meal.protein || ''}">
            </div>
          </div>
          <div class="edit-row">
            <div class="edit-col">
              <label class="edit-label">Carbs (g)</label>
              <input class="edit-input" id="editMealC" type="number" inputmode="numeric" value="${meal.carbs || ''}">
            </div>
            <div class="edit-col">
              <label class="edit-label">Fat (g)</label>
              <input class="edit-input" id="editMealF" type="number" inputmode="numeric" value="${meal.fat || ''}">
            </div>
          </div>
        </div>

        <div class="modal-actions">
          ${!isNew ? '<button class="modal-btn" id="editMealDelete" style="color:var(--red);flex:0.5">Delete</button>' : ''}
          <button class="modal-btn secondary" id="editMealCancel">Cancel</button>
          <button class="modal-btn primary" id="editMealSave">Save</button>
        </div>
      </div>
    </div>`;

  document.getElementById('editMealCancel').addEventListener('click', () => { container.innerHTML = ''; });
  container.querySelector('.confirm-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('confirm-overlay')) container.innerHTML = '';
  });

  document.getElementById('editMealSave').addEventListener('click', async () => {
    const name = document.getElementById('editMealName').value.trim();
    if (!name) { showToast('Meal name required', 'error'); return; }

    const key = isNew ? (document.getElementById('editMealKey')?.value.trim() || '') : editKey;
    if (!key) { showToast('Meal slot name required', 'error'); return; }

    const updated = {
      name,
      time: document.getElementById('editMealTime').value.trim() || undefined,
      items: document.getElementById('editMealItems').value.trim() || undefined,
      calories: parseInt(document.getElementById('editMealCal').value) || undefined,
      protein: parseInt(document.getElementById('editMealP').value) || undefined,
      carbs: parseInt(document.getElementById('editMealC').value) || undefined,
      fat: parseInt(document.getElementById('editMealF').value) || undefined,
    };

    // Preserve existing recipe if not editing it
    if (!isNew && meals[editKey]?.recipe) {
      updated.recipe = meals[editKey].recipe;
    }

    state.currentPlan.meals[key] = updated;

    const ok = await savePlan();
    container.innerHTML = '';
    if (ok) {
      showToast(isNew ? 'Meal added' : 'Meal updated', 'success');
      if (onSave) onSave();
    }
  });

  document.getElementById('editMealDelete')?.addEventListener('click', async () => {
    delete state.currentPlan.meals[editKey];
    const ok = await savePlan();
    container.innerHTML = '';
    if (ok) {
      showToast('Meal removed', 'success');
      if (onSave) onSave();
    }
  });
}
