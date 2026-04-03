// App configuration
// In production (Cloudflare Pages), the API is at the same origin (/api/*)
// In demo mode (local file or localhost), everything uses localStorage

export let IS_PRODUCTION = false;
export let PRODUCTION_API_STATUS = 'not-applicable';
export let PRODUCTION_API_MESSAGE = '';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export async function detectMode() {
  PRODUCTION_API_STATUS = 'not-applicable';
  PRODUCTION_API_MESSAGE = '';

  const isLocalFile = window.location.protocol === 'file:';
  const isLocalHost = LOCAL_HOSTS.has(window.location.hostname);

  if (isLocalFile || isLocalHost) {
    IS_PRODUCTION = false;
    return { isProduction: false, status: PRODUCTION_API_STATUS, user: null };
  }

  IS_PRODUCTION = true;

  try {
    const res = await fetch('/api/me', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (res.ok) {
      PRODUCTION_API_STATUS = 'ok';
      const user = await res.json();
      return { isProduction: true, status: PRODUCTION_API_STATUS, user };
    }

    PRODUCTION_API_STATUS = res.status === 401 || res.status === 403 ? 'unauthenticated' : 'error';
    PRODUCTION_API_MESSAGE = PRODUCTION_API_STATUS === 'unauthenticated'
      ? 'Authentication required. Please log in via Cloudflare Access.'
      : `Production API unavailable (${res.status}). Check your Cloudflare Pages Functions deployment.`;
  } catch (e) {
    PRODUCTION_API_STATUS = 'error';
    PRODUCTION_API_MESSAGE = 'Production API unavailable. Check your Cloudflare Pages Functions deployment.';
  }

  return { isProduction: true, status: PRODUCTION_API_STATUS, user: null };
}
