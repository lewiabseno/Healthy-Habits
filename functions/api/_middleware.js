// Auth middleware for all /api/* routes.
// In production, requests must include a valid Cloudflare Access JWT
// signed by the team's Access keys. In local dev, DEV_USER can be used.

const CLOCK_SKEW_MS = 60 * 1000;
const CERT_CACHE_TTL_MS = 5 * 60 * 1000;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let cachedJwks = {
  certsUrl: '',
  expiresAt: 0,
  keys: new Map(),
};

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const isLocalhost = LOCAL_HOSTS.has(url.hostname);

  if (!isLocalhost) {
    const requestSafetyError = validateRequestSafety(request, url);
    if (requestSafetyError) return requestSafetyError;
  }

  if (isLocalhost) {
    if (!env.DEV_USER) {
      return unauthorized('Set DEV_USER environment variable for local development');
    }
    context.data.userId = env.DEV_USER;
    context.data.userEmail = env.DEV_USER;
  } else {
    const accessConfig = getAccessConfig(env);
    if (!accessConfig) {
      return serverError('Cloudflare Access JWT validation is not configured');
    }

    const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!jwt) {
      return unauthorized('Authentication required');
    }

    let payload;
    try {
      payload = await verifyAccessJwt(jwt, accessConfig);
    } catch (error) {
      return unauthorized(`Invalid token: ${error.message}`);
    }

    const userId = payload.email || payload.sub;
    if (!userId) {
      return unauthorized('Token missing user identity');
    }

    context.data.userId = userId;
    context.data.userEmail = payload.email || null;

    // Auto-register/update user in DB
    try {
      await env.DB.prepare(
        `INSERT INTO users (id, email) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET last_seen_at = datetime('now')`
      ).bind(userId, payload.email || userId).run();
    } catch (e) {
      // Non-fatal — table might not exist yet
    }
  }

  const response = await next();
  return withSecurityHeaders(response);
}

function validateRequestSafety(request, url) {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return null;

  const origin = request.headers.get('Origin');
  if (origin) {
    if (origin !== url.origin) {
      return forbidden('Cross-site request blocked');
    }
  } else {
    const referer = request.headers.get('Referer');
    if (!referer) return forbidden('Missing request origin');

    let refererOrigin;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      return forbidden('Invalid referer');
    }
    if (refererOrigin !== url.origin) {
      return forbidden('Cross-site request blocked');
    }
  }

  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return unsupportedMediaType('Content-Type must be application/json');
  }

  return null;
}

function getAccessConfig(env) {
  const teamDomain = normalizeTeamDomain(env.TEAM_DOMAIN || env.CF_ACCESS_TEAM_DOMAIN);
  const audience = cleanString(env.POLICY_AUD || env.CF_ACCESS_AUD || env.ACCESS_AUD);
  if (!teamDomain || !audience) return null;
  return {
    audience,
    certsUrl: `${teamDomain}/cdn-cgi/access/certs`,
    issuer: teamDomain,
  };
}

function normalizeTeamDomain(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return '';

  let normalized = cleaned.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = normalized.includes('.')
      ? `https://${normalized}`
      : `https://${normalized}.cloudflareaccess.com`;
  }
  return normalized;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function verifyAccessJwt(token, config) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJwtPart(encodedHeader);
  const payload = decodeJwtPart(encodedPayload);

  if (header.alg !== 'RS256') throw new Error('Unsupported JWT algorithm');
  if (!header.kid || typeof header.kid !== 'string') throw new Error('Missing JWT key id');
  if (payload.type && payload.type !== 'app') throw new Error('Unexpected JWT type');

  validateJwtClaims(payload, config);

  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = base64UrlToBytes(encodedSignature);

  let key = await getAccessKey(config.certsUrl, header.kid);
  if (key && await verifySignature(key, signingInput, signature)) {
    return payload;
  }

  key = await getAccessKey(config.certsUrl, header.kid, true);
  if (key && await verifySignature(key, signingInput, signature)) {
    return payload;
  }

  throw new Error('JWT signature verification failed');
}

function validateJwtClaims(payload, config) {
  const now = Date.now();
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

  if (payload.iss !== config.issuer) throw new Error('Unexpected issuer');
  if (!audiences.includes(config.audience)) throw new Error('Unexpected audience');
  if (payload.exp && payload.exp * 1000 <= now - CLOCK_SKEW_MS) throw new Error('Token expired');
  if (payload.nbf && payload.nbf * 1000 > now + CLOCK_SKEW_MS) throw new Error('Token not yet valid');
}

async function getAccessKey(certsUrl, kid, forceRefresh = false) {
  const jwks = await getAccessJwks(certsUrl, forceRefresh);
  const jwk = jwks.get(kid);
  if (!jwk) return null;

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify'],
  );
}

async function getAccessJwks(certsUrl, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedJwks.certsUrl === certsUrl && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }

  const res = await fetch(certsUrl, {
    headers: { 'Accept': 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 300 },
  });
  if (!res.ok) throw new Error('Unable to fetch Access signing keys');

  const data = await res.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  if (keys.length === 0) throw new Error('Access signing keys are unavailable');

  cachedJwks = {
    certsUrl,
    expiresAt: now + CERT_CACHE_TTL_MS,
    keys: new Map(keys.filter(key => key?.kid).map(key => [key.kid, key])),
  };

  return cachedJwks.keys;
}

async function verifySignature(key, signingInput, signature) {
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    signingInput,
  );
}

function decodeJwtPart(part) {
  return JSON.parse(bytesToText(base64UrlToBytes(part)));
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

function withSecurityHeaders(response) {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('Cache-Control', 'no-store, must-revalidate');
  return newResponse;
}

function jsonError(message, status) {
  return withSecurityHeaders(new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  }));
}

function unauthorized(message) {
  return jsonError(message, 401);
}

function forbidden(message) {
  return jsonError(message, 403);
}

function unsupportedMediaType(message) {
  return jsonError(message, 415);
}

function serverError(message) {
  return jsonError(message, 500);
}
