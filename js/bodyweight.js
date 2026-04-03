import { state } from './state.js';
import { upsertBodyweight, loadBodyweightHistory } from './api.js';
import { showToast } from './toast.js';

export function renderBodyweightWidget(parentEl) {
  const section = document.createElement('div');
  section.className = 'dash-section';
  section.innerHTML = `
    <div class="dash-section-title">Bodyweight</div>
    <div class="bw-widget">
      <input class="bw-input" type="number" inputmode="decimal" placeholder="Enter weight" id="bwInput"/>
      <span class="bw-unit">lbs</span>
      <button class="bw-log-btn" id="bwLogBtn">Log</button>
    </div>
    <div class="bw-last" id="bwLast"></div>`;
  parentEl.appendChild(section);

  const input = document.getElementById('bwInput');
  const btn = document.getElementById('bwLogBtn');
  const lastEl = document.getElementById('bwLast');

  // Show last logged weight
  loadBodyweightHistory(state.userId).then(data => {
    if (data.length > 0) {
      const last = data[data.length - 1];
      lastEl.textContent = `Last: ${last.weight} ${last.unit} on ${new Date(last.recorded_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  });

  btn.addEventListener('click', async () => {
    const val = input.value.trim();
    if (!val || isNaN(parseFloat(val))) {
      showToast('Enter a valid weight', 'error');
      return;
    }
    btn.disabled = true;
    try {
      const today = new Date().toISOString().split('T')[0];
      await upsertBodyweight(state.userId, today, val, 'lbs');
      showToast('Weight logged!', 'success');
      input.value = '';
      lastEl.textContent = `Last: ${val} lbs on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } catch (e) {
      showToast('Failed to log weight', 'error');
    }
    btn.disabled = false;
  });
}

export async function renderBodyweightChart(parentEl) {
  const data = await loadBodyweightHistory(state.userId);
  if (data.length < 2) return null;

  const section = document.createElement('div');
  section.className = 'dash-section';
  section.innerHTML = `
    <div class="dash-section-title">Bodyweight Trend</div>
    <div class="chart-card"><div class="chart-wrap"><canvas id="bwChart"></canvas></div></div>`;
  parentEl.appendChild(section);

  const ctx = document.getElementById('bwChart');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.recorded_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [{
        data: data.map(d => d.weight),
        borderColor: '#007aff',
        backgroundColor: 'rgba(0,122,255,0.1)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: '#007aff',
        fill: true,
        tension: 0.3,
      }]
    },
    options: chartOptions('lbs'),
  });
}

function chartOptions(unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} ${unit}` } },
    },
    scales: {
      x: { ticks: { color: '#8e8e93', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
      y: { ticks: { color: '#8e8e93', font: { size: 11 }, callback: v => v + unit }, grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: false },
    },
  };
}
