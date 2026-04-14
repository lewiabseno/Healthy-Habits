// Preview modal for import: shows summary, errors, warnings, repairs, diff, mode selector.

import { esc } from './sanitize.js';
import { formatWeekRange } from './state.js';
import { validateSmart } from './import-validate.js';
import { buildDiff } from './import-diff.js';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MODES = [
  { value: 'full', label: 'Full week' },
  { value: 'workouts', label: 'Workouts only' },
  { value: 'meals', label: 'Meals only' },
  { value: 'grocery', label: 'Grocery only' },
];

export function showPreview({ normalized, repairs, validation, existingPlan, existingId, onConfirm, onCancel }) {
  const container = document.getElementById('confirmContainer');
  let currentMode = 'full';
  let currentValidation = validation;

  render();

  function render() {
    const hasErrors = currentValidation.errors.length > 0;

    container.innerHTML = `
      <div class="confirm-overlay" style="align-items:flex-end">
        <div class="modal-panel" style="max-width:500px;border-radius:16px 16px 0 0;max-height:85vh;overflow-y:auto">
          <div class="modal-handle"></div>
          <div class="modal-title">Import Preview</div>

          ${renderIssues(currentValidation.errors, 'Errors', 'preview-errors', 'badge-red')}
          ${renderIssues(currentValidation.warnings, 'Warnings', 'preview-warnings', 'badge-yellow')}
          ${renderIssues(repairs, 'Auto-fixed', 'preview-repairs', 'badge-blue')}

          ${renderWeekInfo(normalized)}
          ${renderWorkoutsSummary(normalized)}
          ${renderMealsSummary(normalized)}
          ${renderGrocerySummary(normalized)}

          <div class="preview-mode">
            <label class="edit-label">Import mode</label>
            <select class="edit-input" id="previewModeSelect">
              ${MODES.map(m => `<option value="${m.value}"${m.value === currentMode ? ' selected' : ''}>${m.label}</option>`).join('')}
            </select>
          </div>

          ${existingPlan ? renderDiffSection(normalized, existingPlan, currentMode) : ''}

          <div class="modal-actions">
            <button class="modal-btn secondary" id="previewCancel">Cancel</button>
            <button class="modal-btn primary" id="previewConfirm"${hasErrors ? ' disabled' : ''}>
              ${existingPlan ? 'Update Week' : 'Import Week'}
            </button>
          </div>
        </div>
      </div>`;

    // Event wiring
    document.getElementById('previewCancel').addEventListener('click', () => {
      container.innerHTML = '';
      onCancel();
    });
    container.querySelector('.confirm-overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('confirm-overlay')) {
        container.innerHTML = '';
        onCancel();
      }
    });
    document.getElementById('previewConfirm').addEventListener('click', () => {
      container.innerHTML = '';
      onConfirm(currentMode);
    });
    document.getElementById('previewModeSelect').addEventListener('change', (e) => {
      currentMode = e.target.value;
      currentValidation = validateSmart(normalized, currentMode);
      render();
    });
  }
}

function renderIssues(items, title, sectionClass, badgeClass) {
  if (!items || items.length === 0) return '';
  return `<div class="preview-section ${sectionClass}">
    <div class="preview-section-title">
      <span class="badge ${badgeClass}">${items.length}</span> ${esc(title)}
    </div>
    <ul class="preview-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
  </div>`;
}

function renderWeekInfo(plan) {
  const label = plan.weekStart ? formatWeekRange(plan.weekStart) : 'Unknown';
  return `<div class="preview-section">
    <div class="preview-section-title">Week</div>
    <div class="preview-item"><span>${esc(label)}</span></div>
  </div>`;
}

function renderWorkoutsSummary(plan) {
  if (!Array.isArray(plan.workouts) || plan.workouts.length === 0) {
    return `<div class="preview-section">
      <div class="preview-section-title">Workouts</div>
      <div class="preview-item" style="color:var(--text-tertiary)">None</div>
    </div>`;
  }
  const rows = plan.workouts
    .slice()
    .sort((a, b) => (a.day || 0) - (b.day || 0))
    .map(w => {
      const day = DAY_NAMES[w.day] || '?';
      const exCount = Array.isArray(w.exercises) ? w.exercises.length : 0;
      return `<div class="preview-item">
        <span>${esc(day)} \u2014 ${esc(w.title || 'Untitled')}</span>
        <span style="color:var(--text-tertiary)">${exCount} exercise${exCount !== 1 ? 's' : ''}</span>
      </div>`;
    }).join('');
  return `<div class="preview-section">
    <div class="preview-section-title">Workouts (${plan.workouts.length} days)</div>
    ${rows}
  </div>`;
}

function renderMealsSummary(plan) {
  if (!plan.meals || typeof plan.meals !== 'object' || Object.keys(plan.meals).length === 0) {
    return `<div class="preview-section">
      <div class="preview-section-title">Meals</div>
      <div class="preview-item" style="color:var(--text-tertiary)">None</div>
    </div>`;
  }
  const keys = Object.keys(plan.meals);
  const rows = keys.map(k => {
    const m = plan.meals[k];
    const cal = m.calories ? `${m.calories} cal` : '';
    return `<div class="preview-item">
      <span>${esc(m.name || k)}</span>
      <span style="color:var(--text-tertiary)">${esc(cal)}</span>
    </div>`;
  }).join('');
  return `<div class="preview-section">
    <div class="preview-section-title">Meals (${keys.length})</div>
    ${rows}
  </div>`;
}

function renderGrocerySummary(plan) {
  if (!plan.grocery || typeof plan.grocery !== 'object' || Object.keys(plan.grocery).length === 0) {
    return `<div class="preview-section">
      <div class="preview-section-title">Grocery</div>
      <div class="preview-item" style="color:var(--text-tertiary)">None</div>
    </div>`;
  }
  const cats = Object.entries(plan.grocery);
  const rows = cats.map(([cat, items]) => {
    const count = Array.isArray(items) ? items.length : 0;
    return `<div class="preview-item">
      <span>${esc(cat)}</span>
      <span style="color:var(--text-tertiary)">${count} item${count !== 1 ? 's' : ''}</span>
    </div>`;
  }).join('');
  const totalItems = cats.reduce((s, [, items]) => s + (Array.isArray(items) ? items.length : 0), 0);
  return `<div class="preview-section">
    <div class="preview-section-title">Grocery (${totalItems} items in ${cats.length} categories)</div>
    ${rows}
  </div>`;
}

function renderDiffSection(newPlan, existingPlan, mode) {
  const diff = buildDiff(newPlan, existingPlan, mode);
  const sections = [];

  if (diff.workouts) sections.push(renderDiffPart('Workouts', diff.workouts));
  if (diff.meals) sections.push(renderDiffPart('Meals', diff.meals));
  if (diff.grocery) sections.push(renderDiffPart('Grocery', diff.grocery));

  if (sections.length === 0) return '';

  return `<div class="preview-section">
    <div class="preview-section-title">Changes vs existing week</div>
    ${sections.join('')}
  </div>`;
}

function renderDiffPart(title, diff) {
  if (diff.changed.length === 0 && diff.unchanged.length === 0) return '';
  let html = `<div class="diff-section"><div class="diff-section-title">${esc(title)}</div>`;
  if (diff.changed.length > 0) {
    html += diff.changed.map(c => `<div class="diff-changed">\u25CF ${esc(c)}</div>`).join('');
  }
  if (diff.unchanged.length > 0) {
    html += diff.unchanged.map(u => `<div class="diff-unchanged">\u25CB ${esc(u)}</div>`).join('');
  }
  html += '</div>';
  return html;
}
