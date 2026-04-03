import { state } from './state.js';
import { showToast } from './toast.js';
import { SUPABASE_URL } from './config.js';

const isConfigured = SUPABASE_URL && !SUPABASE_URL.startsWith('YOUR_');

let checks = {};

function getLocalChecks() {
  try { return JSON.parse(localStorage.getItem('hh-grocery-checks') || '{}'); } catch { return {}; }
}
function saveLocalChecks(all) {
  localStorage.setItem('hh-grocery-checks', JSON.stringify(all));
}

export async function renderGrocery(container) {
  const plan = state.currentPlan;
  if (!plan) {
    container.innerHTML = `<div class="section-header"><div class="section-title">Grocery List</div></div>
      <div class="empty-state">No week imported yet.<br>Tap <b>+ Import</b> to add a weekly plan.</div>`;
    return;
  }

  const grocery = plan.grocery || {};
  const categories = Object.keys(grocery);
  if (categories.length === 0) {
    container.innerHTML = `<div class="section-header"><div class="section-title">Grocery List</div></div>
      <div class="empty-state">No grocery items in this week's plan.</div>`;
    return;
  }

  // Load checks
  if (isConfigured && state.currentPlanId) {
    const { loadGroceryChecks } = await import('./api.js');
    checks = {};
    try {
      const data = await loadGroceryChecks(state.currentPlanId);
      data.forEach(row => { if (row.checked) checks[`${row.category}_${row.item_index}`] = true; });
    } catch (e) { showToast('Failed to load grocery data', 'error'); }
  } else {
    const all = getLocalChecks();
    checks = all[state.currentPlanId] || {};
  }

  let total = 0, done = 0;
  categories.forEach(cat => {
    grocery[cat].forEach((_, i) => { total++; if (checks[`${cat}_${i}`]) done++; });
  });

  let html = `<div class="section-header"><div class="section-title">Grocery List</div><div class="section-subtitle">${done} of ${total} items checked off</div></div>`;

  categories.forEach(cat => {
    const items = grocery[cat];
    html += `<div class="grocery-label">${cat}</div><div class="grocery-card">`;
    items.forEach((item, i) => {
      const key = `${cat}_${i}`;
      const ch = !!checks[key];
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
  container.innerHTML = html;

  container.querySelectorAll('.grocery-item').forEach(el => {
    el.addEventListener('click', async () => {
      const cat = el.dataset.cat;
      const idx = parseInt(el.dataset.idx);
      const key = `${cat}_${idx}`;
      checks[key] = !checks[key];
      if (isConfigured) {
        try {
          const { upsertGroceryCheck } = await import('./api.js');
          await upsertGroceryCheck(state.userId, state.currentPlanId, cat, idx, checks[key]);
        } catch (e) { showToast('Failed to save', 'error'); checks[key] = !checks[key]; }
      } else {
        const all = getLocalChecks();
        all[state.currentPlanId] = checks;
        saveLocalChecks(all);
      }
      renderGrocery(container);
    });
  });

  document.getElementById('resetGrocery')?.addEventListener('click', async () => {
    if (!confirm('Reset all grocery checkboxes?')) return;
    checks = {};
    if (isConfigured) {
      try {
        const { upsertGroceryCheck } = await import('./api.js');
        for (const cat of categories) {
          for (let i = 0; i < grocery[cat].length; i++) {
            await upsertGroceryCheck(state.userId, state.currentPlanId, cat, i, false);
          }
        }
      } catch (e) { showToast('Failed to reset', 'error'); }
    } else {
      const all = getLocalChecks();
      all[state.currentPlanId] = {};
      saveLocalChecks(all);
    }
    renderGrocery(container);
  });
}
