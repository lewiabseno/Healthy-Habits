import { state } from './state.js';
import { renderWorkout } from './workout.js';
import { renderMeals } from './meals.js';
import { renderDashboard } from './dashboard.js';

const renderers = {
  workout: renderWorkout,
  meals: renderMeals,
  dashboard: renderDashboard,
};

const tabBtns = document.querySelectorAll('.tab-btn');
const content = document.getElementById('content');

export function initRouter() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = btn.dataset.tab;
    });
  });

  window.addEventListener('hashchange', () => navigate());
  navigate();
}

export function navigate() {
  let hash = window.location.hash.slice(1) || 'workout';
  // Redirect old grocery hash to meals
  if (hash === 'grocery') hash = 'meals';
  const tab = renderers[hash] ? hash : 'workout';
  state.currentTab = tab;
  state.expandedExercise = null;

  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  renderCurrentTab();
}

export function renderCurrentTab() {
  const renderer = renderers[state.currentTab];
  if (renderer) {
    renderer(content);
  }
  content.scrollTop = 0;
}
