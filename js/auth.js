import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const isConfigured = SUPABASE_URL && !SUPABASE_URL.startsWith('YOUR_');

let sb = null;
if (isConfigured && window.supabase) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Login page logic (only runs on index.html)
if (document.getElementById('googleBtn') && sb) {
  sb.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = './app.html';
  });

  document.getElementById('googleBtn').addEventListener('click', async () => {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/app.html' }
    });
    if (error) showLoginMsg(error.message, true);
  });

  document.getElementById('magicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('emailInput').value.trim();
    if (!email) return;
    const btn = document.getElementById('magicBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/app.html' }
    });
    if (error) {
      showLoginMsg(error.message, true);
      btn.disabled = false;
      btn.textContent = 'Send Magic Link';
    } else {
      showLoginMsg('Check your email for the login link!', false);
    }
  });
}

function showLoginMsg(msg, isError) {
  const el = document.getElementById('loginMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--red)' : 'var(--green)';
  el.style.display = 'block';
}

export async function guardSession() {
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = './index.html';
    return null;
  }
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = './index.html';
    }
  });
  return session;
}

export async function signOut() {
  if (sb) await sb.auth.signOut();
}

export function getUserId() {
  if (!sb) return Promise.resolve(null);
  return sb.auth.getSession().then(({ data: { session } }) => session?.user?.id ?? null);
}
