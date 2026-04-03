// App configuration
// In production (Cloudflare Pages), the API is at the same origin (/api/*)
// In demo mode (local file or no backend), everything uses localStorage

// Set to true when deployed to Cloudflare Pages with D1
// This is auto-detected by checking if /api/me responds
export let IS_PRODUCTION = false;

export async function detectMode() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      IS_PRODUCTION = true;
      return true;
    }
  } catch (e) {
    // No API available — demo mode
  }
  IS_PRODUCTION = false;
  return false;
}
