// Auth middleware for all /api/* routes
// Extracts user identity from Cloudflare Access JWT header
// In local dev (no Access), falls back to a default dev user

export async function onRequest(context) {
  const { request, env, next } = context;

  // Try Cloudflare Access JWT
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (jwt) {
    try {
      // Decode JWT payload (base64url)
      const parts = jwt.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        context.data.userId = payload.email || payload.sub;
        context.data.userEmail = payload.email;
      }
    } catch (e) {
      // Invalid JWT
    }
  }

  // Fallback for local dev
  if (!context.data.userId) {
    if (env.DEV_USER) {
      context.data.userId = env.DEV_USER;
    } else {
      // In production without Access token, reject
      const url = new URL(request.url);
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Local dev fallback
      context.data.userId = 'dev@localhost';
    }
  }

  return next();
}
