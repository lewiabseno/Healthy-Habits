import { state } from './state.js';
import { renderWorkout } from './workout.js';
import { renderMeals } from './meals.js';
import { renderDashboard } from './dashboard.js';
import { renderHome } from './home.js';

const renderers = {
  home: renderHome,
  workout: renderWorkout,
  meals: renderMeals,
  dashboard: renderDashboard,
};

const tabBtns = document.querySelectorAll('.tab-btn');
const content = document.getElementById('content');

export async function initRouter() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = btn.dataset.tab;
    });
  });

  window.addEventListener('hashchange', () => navigate());
  await navigate();
}

export async function navigate() {
  let hash = window.location.hash.slice(1) || 'home';
  if (hash === 'grocery') hash = 'meals';
  const tab = renderers[hash] ? hash : 'home';
  state.currentTab = tab;
  state.expandedExercise = null;

  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  renderCurrentTab();
}

export async function renderCurrentTab() {
  const renderer = renderers[state.currentTab];
  if (renderer) {
    await renderer(content);
  }
  content.scrollTop = 0;
}
