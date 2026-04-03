import { state } from './state.js';
import { initRouter } from './router.js';
import { initImport, loadDemoWeeks } from './import.js';
import { SUPABASE_URL } from './config.js';

const isConfigured = SUPABASE_URL && !SUPABASE_URL.startsWith('YOUR_');

async function init() {
  if (isConfigured) {
    const { guardSession, signOut } = await import('./auth.js');
    const session = await guardSession();
    if (!session) return;

    state.userId = session.user.id;

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await signOut();
    });

    const { loadWeeks } = await import('./weeks.js');
    try {
      await loadWeeks();
    } catch (e) {
      console.error('Failed to load weeks:', e);
      document.getElementById('content').innerHTML = `
        <div class="empty-state">Failed to connect to database.<br>Check your Supabase configuration.</div>`;
      return;
    }
  } else {
    // Demo mode
    state.userId = 'demo';
    document.getElementById('logoutBtn').style.display = 'none';
    loadDemoWeeks();
  }

  initImport();
  const { initOverride } = await import('./override.js');
  initOverride();
  initRouter();
}

init();
