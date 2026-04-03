// Authentication via Cloudflare Access
// In production, Cloudflare Access handles login — no auth code needed.
// The /api/me endpoint returns the current user from the Access JWT.
// In demo mode, no auth — userId is 'demo'.

export async function getUser() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      return { id: data.userId, email: data.email };
    }
  } catch (e) {
    // No API — demo mode
  }
  return null;
}

export async function signOut() {
  // Cloudflare Access logout
  window.location.href = '/cdn-cgi/access/logout';
}
