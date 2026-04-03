import { state } from './state.js';
import { initRouter } from './router.js';
import { initImport, loadDemoWeeks } from './import.js';
import { runMigrations } from './migrate.js';
import { detectMode, IS_PRODUCTION, PRODUCTION_API_MESSAGE, PRODUCTION_API_STATUS } from './config.js';

async function init() {
  // Run data migrations before anything else
  runMigrations();

  // Detect if we're on Cloudflare (production) or local (demo)
  const mode = await detectMode();

  if (mode.isProduction && PRODUCTION_API_STATUS === 'error') {
    document.getElementById('content').innerHTML = `
      <div class="empty-state">${PRODUCTION_API_MESSAGE}</div>`;
    return;
  }

  if (IS_PRODUCTION) {
    const user = mode.user?.userId ? { id: mode.user.userId, email: mode.user.email } : null;
    if (!user) {
      document.getElementById('content').innerHTML = `
        <div class="empty-state">${PRODUCTION_API_MESSAGE || 'Not authenticated.<br>Please log in via Cloudflare Access.'}</div>`;
      return;
    }
    state.userId = user.id;

    // Load weeks from D1
    try {
      const { fetchWeeks, fetchPlan } = await import('./api.js');
      const weeks = await fetchWeeks();
      state.weeks = weeks.map(w => ({
        id: w.id,
        weekStart: w.week_start,
        label: w.label,
      }));

      // Auto-select current week
      const { getCurrentMonday } = await import('./state.js');
      const monday = getCurrentMonday();
      const match = state.weeks.find(w => w.weekStart === monday);
      const selected = match || state.weeks[0];
      if (selected) {
        const plan = await fetchPlan(selected.id);
        state.currentPlanId = selected.id;
        state.currentPlan = plan.plan_data;
      }
    } catch (e) {
      console.error('Failed to load weeks:', e);
      document.getElementById('content').innerHTML = `
        <div class="empty-state">Failed to connect to database.<br>Check your D1 configuration.</div>`;
      return;
    }
  } else {
    // Demo mode
    state.userId = 'demo';
    loadDemoWeeks();
  }

  initImport();
  const { initOverride } = await import('./override.js');
  initOverride();
  initRouter();
}

init();
