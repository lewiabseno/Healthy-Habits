import { state } from './state.js';
import { savePlan } from './plan-save.js';
import { showToast } from './toast.js';
import { esc } from './sanitize.js';

const equipmentTypes = [
  { value: '', label: 'None' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'cable', label: 'Cable' },
  { value: 'cable-single', label: 'Cable (per arm)' },
  { value: 'machine', label: 'Machine' },
  { value: 'machine-single', label: 'Machine (per arm)' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

export function openEditExercise(dayIndex, exerciseIndex, onSave) {
  const workout = (state.currentPlan.workouts || []).find(w => w.day === dayIndex);
  if (!workout) return;

  const isNew = exerciseIndex === -1;
  const ex = isNew ? { name: '', sets: 3, reps: '10', equipment: '', notes: '', restBetweenSets: '', restBetweenExercises: '' } : { ...workout.exercises[exerciseIndex] };

  const container = document.getElementById('confirmContainer');
  const equipOpts = equipmentTypes.map(t =>
    `<option value="${t.value}"${t.value === (ex.equipment || '') ? ' selected' : ''}>${t.label}</option>`
  ).join('');

  container.innerHTML = `
    <div class="confirm-overlay" style="align-items:flex-end">
      <div class="modal-panel" style="max-width:500px;border-radius:16px 16px 0 0;max-height:85vh">
        <div class="modal-handle"></div>
        <div class="modal-title">${isNew ? 'Add Exercise' : 'Edit Exercise'}</div>
        <div class="edit-form">
          <label class="edit-label">Name</label>
          <input class="edit-input" id="editExName" value="${esc(ex.name)}" placeholder="Exercise name">

          <div class="edit-row">
            <div class="edit-col">
              <label class="edit-label">Sets</label>
              <input class="edit-input" id="editExSets" type="number" inputmode="numeric" value="${ex.sets || 3}">
            </div>
            <div class="edit-col">
              <label class="edit-label">Reps</label>
              <input class="edit-input" id="editExReps" value="${esc(ex.reps || '')}">
            </div>
          </div>

          <label class="edit-label">Equipment</label>
          <select class="edit-input" id="editExEquip">${equipOpts}</select>

          <label class="edit-label">Notes</label>
          <input class="edit-input" id="editExNotes" value="${esc(ex.notes || '')}" placeholder="Coaching cues">

          <div class="edit-row">
            <div class="edit-col">
              <label class="edit-label">Rest (sets)</label>
              <input class="edit-input" id="editExRestSets" value="${esc(ex.restBetweenSets || '')}" placeholder="e.g. 90 sec">
            </div>
            <div class="edit-col">
              <label class="edit-label">Rest (next)</label>
              <input class="edit-input" id="editExRestEx" value="${esc(ex.restBetweenExercises || '')}" placeholder="e.g. 2 min">
            </div>
          </div>
        </div>

        <div class="modal-actions">
          ${!isNew ? '<button class="modal-btn" id="editExDelete" style="color:var(--red);flex:0.5">Delete</button>' : ''}
          <button class="modal-btn secondary" id="editExCancel">Cancel</button>
          <button class="modal-btn primary" id="editExSave">Save</button>
        </div>
      </div>
    </div>`;

  document.getElementById('editExCancel').addEventListener('click', () => { container.innerHTML = ''; });
  container.querySelector('.confirm-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('confirm-overlay')) container.innerHTML = '';
  });

  document.getElementById('editExSave').addEventListener('click', async () => {
    const name = document.getElementById('editExName').value.trim();
    const sets = parseInt(document.getElementById('editExSets').value) || 3;
    const reps = document.getElementById('editExReps').value.trim() || '10';
    const equipment = document.getElementById('editExEquip').value;
    const notes = document.getElementById('editExNotes').value.trim();
    const restBetweenSets = document.getElementById('editExRestSets').value.trim();
    const restBetweenExercises = document.getElementById('editExRestEx').value.trim();

    if (!name) { showToast('Exercise name required', 'error'); return; }
    if (sets < 1) { showToast('Sets must be at least 1', 'error'); return; }

    const updated = { name, sets, reps, equipment: equipment || undefined, notes: notes || undefined, restBetweenSets: restBetweenSets || undefined, restBetweenExercises: restBetweenExercises || undefined };

    if (isNew) {
      workout.exercises.push(updated);
    } else {
      workout.exercises[exerciseIndex] = updated;
    }

    const ok = await savePlan();
    container.innerHTML = '';
    if (ok) {
      showToast(isNew ? 'Exercise added' : 'Exercise updated', 'success');
      if (onSave) onSave();
    }
  });

  document.getElementById('editExDelete')?.addEventListener('click', async () => {
    workout.exercises.splice(exerciseIndex, 1);
    const ok = await savePlan();
    container.innerHTML = '';
    if (ok) {
      showToast('Exercise removed', 'success');
      if (onSave) onSave();
    }
  });
}
