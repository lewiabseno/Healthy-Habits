// Auth middleware for all /api/* routes
// Extracts user identity from Cloudflare Access JWT header
// In local dev with DEV_USER env var, uses that as fallback

export async function onRequest(context) {
  const { request, env, next } = context;

  // Try Cloudflare Access JWT
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (jwt) {
    try {
      const parts = jwt.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        // Verify expiry
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          return unauthorized('Token expired');
        }
        // Verify required fields
        if (payload.email || payload.sub) {
          context.data.userId = payload.email || payload.sub;
          context.data.userEmail = payload.email;
        }
      }
    } catch (e) {
      // Invalid JWT — fall through to rejection
    }
  }

  // If no valid user from JWT, check for explicit dev fallback
  if (!context.data.userId) {
    const url = new URL(request.url);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (isLocalhost && env.DEV_USER) {
      context.data.userId = env.DEV_USER;
    } else if (isLocalhost && !env.DEV_USER) {
      // Local dev without DEV_USER — reject, don't silently authenticate
      return unauthorized('Set DEV_USER environment variable for local development');
    } else {
      // Production without valid JWT — reject
      return unauthorized('Authentication required');
    }
  }

  // Add security headers to all responses
  const response = await next();
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('Cache-Control', 'no-store, must-revalidate');
  return newResponse;
}

function unauthorized(message) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
