import { state, formatDate } from './state.js';
import { showToast } from './toast.js';
import { SUPABASE_URL } from './config.js';

const isConfigured = SUPABASE_URL && !SUPABASE_URL.startsWith('YOUR_');

let charts = [];

export async function renderDashboard(container) {
  charts.forEach(c => c.destroy());
  charts = [];

  container.innerHTML = `<div class="section-header"><div class="section-title">Dashboard</div><div class="section-subtitle">Your progress over time</div></div>`;

  if (!state.userId) {
    container.innerHTML += `<div class="empty-state">Loading...</div>`;
    return;
  }

  if (isConfigured) {
    // Full Supabase dashboard
    const { renderBodyweightWidget, renderBodyweightChart } = await import('./bodyweight.js');
    renderBodyweightWidget(container);
    try {
      const bwChart = await renderBodyweightChart(container);
      if (bwChart) charts.push(bwChart);
    } catch (e) { /* silent */ }

    try { await renderExerciseProgression(container); } catch (e) { /* silent */ }
    try { await renderPersonalBests(container); } catch (e) { /* silent */ }
    try { await renderWorkoutCompletion(container); } catch (e) { /* silent */ }
    try { await renderMealAdherence(container); } catch (e) { /* silent */ }
  } else {
    // Demo mode dashboard
    renderDemoDashboard(container);
  }
}

function renderDemoDashboard(container) {
  // Parse local workout logs for exercise progression
  let allLogs;
  try { allLogs = JSON.parse(localStorage.getItem('hh-workout-logs') || '{}'); } catch { allLogs = {}; }

  const exerciseData = {};
  for (const [key, exSets] of Object.entries(allLogs)) {
    // key format: planId_dayIndex
    for (const [exIdx, sets] of Object.entries(exSets)) {
      for (const [setIdx, data] of Object.entries(sets)) {
        if (data.weight) {
          // Find exercise name from plan
          const parts = key.split('_');
          const planId = parts[0];
          const dayIdx = parseInt(parts[1]);
          const week = state.weeks.find(w => (w.id || w.weekStart) === planId);
          if (week) {
            const workout = (week.planData.workouts || []).find(w => w.day === dayIdx);
            const ex = workout?.exercises?.[parseInt(exIdx)];
            if (ex) {
              if (!exerciseData[ex.name]) exerciseData[ex.name] = [];
              exerciseData[ex.name].push({
                weight: parseFloat(data.weight),
                reps: parseInt(data.reps) || 0,
                weekStart: week.weekStart,
              });
            }
          }
        }
      }
    }
  }

  const exerciseNames = Object.keys(exerciseData).sort();

  if (exerciseNames.length === 0) {
    container.innerHTML += `<div class="empty-state">No data yet.<br>Log sets in the Workout tab<br>to see your progress here.</div>`;
    return;
  }

  // Personal bests
  const bests = exerciseNames.map(name => {
    const maxEntry = exerciseData[name].reduce((best, e) => e.weight > best.weight ? e : best, exerciseData[name][0]);
    return { exercise_name: name, best_weight: maxEntry.weight, best_reps: maxEntry.reps };
  });

  const section = document.createElement('div');
  section.className = 'dash-section';
  section.innerHTML = `
    <div class="dash-section-title">Personal Bests</div>
    <div class="pb-grid">${bests.map(b => `
      <div class="pb-card">
        <div class="pb-exercise">${b.exercise_name}</div>
        <div class="pb-weight">${b.best_weight} lbs</div>
        ${b.best_reps ? `<div class="pb-reps">${b.best_reps} reps</div>` : ''}
      </div>`).join('')}
    </div>`;
  container.appendChild(section);

  // Exercise progression chart
  if (exerciseNames.length > 0) {
    const chartSection = document.createElement('div');
    chartSection.className = 'dash-section';
    const opts = exerciseNames.map((n, i) => `<option value="${i}">${n}</option>`).join('');
    chartSection.innerHTML = `
      <div class="dash-section-title">Exercise Progression</div>
      <div class="exercise-picker"><select id="exProgSelect">${opts}</select></div>
      <div class="chart-card"><div class="chart-wrap"><canvas id="exProgChart"></canvas></div></div>`;
    container.appendChild(chartSection);

    let currentChart = null;

    function renderChart(idx) {
      const name = exerciseNames[idx];
      const entries = exerciseData[name];
      // Group by week, find max
      const byWeek = {};
      entries.forEach(e => {
        if (!byWeek[e.weekStart] || e.weight > byWeek[e.weekStart]) {
          byWeek[e.weekStart] = e.weight;
        }
      });
      const weeks = Object.keys(byWeek).sort();

      if (currentChart) { currentChart.destroy(); charts = charts.filter(c => c !== currentChart); }
      if (weeks.length >= 1) {
        currentChart = new Chart(document.getElementById('exProgChart'), {
          type: 'line',
          data: {
            labels: weeks.map(w => formatDate(w)),
            datasets: [{
              data: weeks.map(w => byWeek[w]),
              borderColor: '#007aff',
              backgroundColor: 'rgba(0,122,255,0.1)',
              borderWidth: 2.5,
              pointRadius: 5,
              pointBackgroundColor: '#007aff',
              fill: true,
              tension: 0.3,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} lbs` } } },
            scales: {
              x: { ticks: { color: '#8e8e93', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
              y: { ticks: { color: '#8e8e93', font: { size: 11 }, callback: v => v + 'lb' }, grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: false },
            },
          },
        });
        charts.push(currentChart);
      }
    }

    document.getElementById('exProgSelect').addEventListener('change', e => renderChart(parseInt(e.target.value)));
    renderChart(0);
  }
}

async function renderExerciseProgression(parentEl) {
  const { loadAllExerciseNames, loadExerciseProgression } = await import('./api.js');
  const names = await loadAllExerciseNames(state.userId);
  if (names.length === 0) return;

  const section = document.createElement('div');
  section.className = 'dash-section';
  const opts = names.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  section.innerHTML = `
    <div class="dash-section-title">Exercise Progression</div>
    <div class="exercise-picker"><select id="exProgSelect">${opts}</select></div>
    <div class="chart-card"><div class="chart-wrap"><canvas id="exProgChart"></canvas></div></div>
    <div id="exProgHistory"></div>`;
  parentEl.appendChild(section);

  let currentChart = null;

  async function loadExercise(idx) {
    const name = names[idx];
    const data = await loadExerciseProgression(state.userId, name);

    if (currentChart) { currentChart.destroy(); charts = charts.filter(c => c !== currentChart); }
    if (data.length >= 1) {
      currentChart = new Chart(document.getElementById('exProgChart'), {
        type: 'line',
        data: {
          labels: data.map(d => formatDate(d.date)),
          datasets: [{
            data: data.map(d => d.maxW),
            borderColor: '#007aff', backgroundColor: 'rgba(0,122,255,0.1)',
            borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#007aff', fill: true, tension: 0.3,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} lbs` } } },
          scales: {
            x: { ticks: { color: '#8e8e93', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
            y: { ticks: { color: '#8e8e93', font: { size: 11 }, callback: v => v + 'lb' }, grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: false },
          },
        },
      });
      charts.push(currentChart);
    }

    const histEl = document.getElementById('exProgHistory');
    if (data.length > 0) {
      histEl.innerHTML = `<div class="history-card">${data.slice().reverse().map(d =>
        `<div class="history-row"><span class="history-date">${formatDate(d.date)}</span><span class="history-sets">${d.maxW} lbs</span></div>`
      ).join('')}</div>`;
    } else {
      histEl.innerHTML = `<div class="empty-state">No data yet for ${name}.</div>`;
    }
  }

  document.getElementById('exProgSelect').addEventListener('change', e => loadExercise(parseInt(e.target.value)));
  await loadExercise(0);
}

async function renderPersonalBests(parentEl) {
  const { loadPersonalBests } = await import('./api.js');
  const bests = await loadPersonalBests(state.userId);
  if (bests.length === 0) return;

  const section = document.createElement('div');
  section.className = 'dash-section';
  section.innerHTML = `
    <div class="dash-section-title">Personal Bests</div>
    <div class="pb-grid">${bests.map(b => `
      <div class="pb-card">
        <div class="pb-exercise">${b.exercise_name}</div>
        <div class="pb-weight">${b.best_weight} lbs</div>
        <div class="pb-reps">${b.best_reps} reps</div>
      </div>`).join('')}
    </div>`;
  parentEl.appendChild(section);
}

async function renderWorkoutCompletion(parentEl) {
  const { loadWorkoutCompletionRates } = await import('./api.js');
  const data = await loadWorkoutCompletionRates(state.userId);
  if (data.length === 0) return;

  const section = document.createElement('div');
  section.className = 'dash-section';
  section.innerHTML = `
    <div class="dash-section-title">Workout Completion</div>
    <div class="chart-card"><div class="bar-chart-wrap"><canvas id="workoutCompChart"></canvas></div></div>`;
  parentEl.appendChild(section);

  const chart = new Chart(document.getElementById('workoutCompChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => formatDate(d.weekStart)),
      datasets: [{
        data: data.map(d => d.rate),
        backgroundColor: data.map(d => d.rate >= 80 ? '#34c759' : d.rate >= 60 ? '#ff9f0a' : '#ff3b30'),
        borderRadius: 6, barPercentage: 0.6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}%` } } },
      scales: {
        x: { ticks: { color: '#8e8e93', font: { size: 11 } }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: '#8e8e93', font: { size: 11 }, callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.05)' } },
      },
    },
  });
  charts.push(chart);
}

async function renderMealAdherence(parentEl) {
  const { loadMealAdherenceRates } = await import('./api.js');
  const data = await loadMealAdherenceRates(state.userId);
  if (data.length === 0) return;

  const section = document.createElement('div');
  section.className = 'dash-section';
  section.innerHTML = `
    <div class="dash-section-title">Meal Adherence</div>
    <div class="chart-card"><div class="bar-chart-wrap"><canvas id="mealAdChart"></canvas></div></div>`;
  parentEl.appendChild(section);

  const chart = new Chart(document.getElementById('mealAdChart'), {
    type: 'bar',
    data: {
      labels: data.map(d => formatDate(d.weekStart)),
      datasets: [{
        data: data.map(d => d.rate),
        backgroundColor: data.map(d => d.rate >= 80 ? '#34c759' : d.rate >= 60 ? '#ff9f0a' : '#ff3b30'),
        borderRadius: 6, barPercentage: 0.6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}%` } } },
      scales: {
        x: { ticks: { color: '#8e8e93', font: { size: 11 } }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: '#8e8e93', font: { size: 11 }, callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.05)' } },
      },
    },
  });
  charts.push(chart);

  const spacer = document.createElement('div');
  spacer.style.height = '20px';
  parentEl.appendChild(spacer);
}
