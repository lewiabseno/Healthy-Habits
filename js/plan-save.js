import { state } from './state.js';
import { IS_PRODUCTION } from './config.js';
import { showToast } from './toast.js';

// Save the current plan after any in-app edit.
// Updates D1 in production or localStorage in demo mode.
export async function savePlan() {
  if (!state.currentPlan || !state.currentPlanId) return;

  if (IS_PRODUCTION) {
    try {
      const { updateWeek } = await import('./api.js');
      await updateWeek(state.currentPlanId, state.currentPlan);
    } catch (e) {
      showToast('Failed to save changes', 'error');
      return false;
    }
  } else {
    try {
      const weeks = JSON.parse(localStorage.getItem('hh-weeks') || '[]');
      const week = weeks.find(w => (w.id || w.weekStart) === state.currentPlanId);
      if (week) {
        week.planData = state.currentPlan;
        localStorage.setItem('hh-weeks', JSON.stringify(weeks));
      }
    } catch (e) {
      showToast('Failed to save changes', 'error');
      return false;
    }
  }
  return true;
}
