# Security Overview

This document describes the security measures currently implemented in Healthy Habits.

It is a technical overview of the app's protections, not a vulnerability disclosure policy.

## Security Boundary

Healthy Habits has two modes:

- Production mode: Cloudflare Pages + Pages Functions + D1 + Cloudflare Access
- Demo mode: local file or localhost, using `localStorage`

Production mode is the only security boundary intended for real user data. Demo mode is intentionally simplified for local development and should not be treated as a secure deployment model.

## Authentication and Identity

Production API routes are protected by shared middleware in `functions/api/_middleware.js`.

Implemented controls:

- Requires a `Cf-Access-Jwt-Assertion` header in production
- Verifies JWT signatures against the Cloudflare Access JWKS for the configured team
- Validates JWT `alg`, `kid`, `iss`, `aud`, `exp`, and `nbf`
- Rejects malformed, expired, not-yet-valid, wrong-issuer, wrong-audience, and bad-signature tokens
- Derives `userId` only from a verified token payload
- Fails closed if `TEAM_DOMAIN` or `POLICY_AUD` are missing

Operational requirements:

- `TEAM_DOMAIN` and `POLICY_AUD` must be set in Cloudflare Pages / Wrangler
- The site should remain protected by Cloudflare Access in production

Relevant files:

- `functions/api/_middleware.js`
- `functions/api/me.js`
- `wrangler.toml`

## CSRF and Cross-Site Request Protections

State-changing API requests are blocked unless they appear to come from the app itself.

Implemented controls:

- `GET`, `HEAD`, and `OPTIONS` are treated as safe methods
- All other methods require a same-origin `Origin` header, or a same-origin `Referer` if `Origin` is absent
- Cross-site or malformed origins are rejected with `403`
- Non-safe requests must use `Content-Type: application/json`
- Requests that try to use form-style or other content types are rejected with `415`
- The browser client sends API requests with `credentials: 'same-origin'`

This blocks the cross-site form/plaintext write path that can otherwise affect cookie-authenticated apps.

Relevant files:

- `functions/api/_middleware.js`
- `js/api.js`

## Browser Hardening

The static app shell and API responses include browser-side protections.

Implemented controls:

- Content Security Policy on `app.html`
- Cloudflare Pages `_headers` file for static responses
- API security headers applied in middleware for function responses
- Clickjacking protection via `frame-ancestors 'none'` and `X-Frame-Options: DENY`
- MIME sniffing protection via `X-Content-Type-Options: nosniff`
- Referrer restriction via `Referrer-Policy: strict-origin-when-cross-origin`
- `object-src 'none'` to block plugin/object embedding
- `base-uri 'self'` to prevent hostile base URL changes
- `connect-src 'self'` to restrict network requests to same origin
- Script execution limited to same-origin code plus a single pinned Chart.js CDN URL
- Subresource Integrity on the Chart.js CDN script
- Redirect page uses a meta refresh instead of inline JavaScript

Relevant files:

- `app.html`
- `_headers`
- `index.html`
- `functions/api/_middleware.js`

## Data Isolation and Authorization

Production data is scoped per user and per plan.

Implemented controls:

- Every D1 table stores a `user_id`
- Plan-linked routes verify that the requested plan belongs to the authenticated user before returning or mutating data
- Queries consistently filter by `user_id`
- Weekly plans are unique per user and week
- Child tables reference weekly plans with foreign keys and `ON DELETE CASCADE`
- Upserts use user-scoped unique constraints to prevent duplicate rows and keep writes idempotent

This prevents one authenticated user from reading or writing another user's plan or logs through normal API access.

Relevant files:

- `functions/api/_validate.js`
- `functions/api/week/[id].js`
- `functions/api/weeks.js`
- `functions/api/workout-logs.js`
- `functions/api/meal-checks.js`
- `functions/api/grocery-checks.js`
- `functions/api/rpe.js`
- `functions/api/day-notes.js`
- `functions/api/stretch-checks.js`
- `schema.sql`

## Input Validation

The app validates user-controlled data on both the client and the server, with the server as the final authority.

Implemented controls:

- Type and range validation helpers for strings, ints, numbers, and dates
- Plan payload size cap of 100 KB on create/update endpoints
- Validation of plan JSON before saving in production
- Client-side validation before import and day override for fast feedback
- Validation that meal collections are objects with named meals
- Validation that meal macro fields are finite numbers within expected bounds
- Validation that `mealOverrides` only use day indexes `0-6`
- Validation of API write payloads such as dates, bodyweight, body fat, day indexes, booleans, and IDs

Relevant files:

- `functions/api/_validate.js`
- `functions/api/weeks.js`
- `functions/api/week/[id].js`
- `functions/api/bodyweight.js`
- `functions/api/bodyfat.js`
- `functions/api/workout-logs.js`
- `functions/api/meal-checks.js`
- `functions/api/grocery-checks.js`
- `functions/api/rpe.js`
- `functions/api/day-notes.js`
- `functions/api/stretch-checks.js`
- `js/plan-validation.js`
- `js/import.js`
- `js/override.js`

## XSS Defenses

The UI renders imported plan content and stored data, so output encoding is applied to user-controlled strings.

Implemented controls:

- Shared HTML escaping helper for text inserted into `innerHTML`
- Separate attribute escaping helper for IDs and `data-*` attributes
- Imported plan strings are rendered through `esc()` / `escAttr()` in UI templates
- Meal macro values are rendered only after numeric validation/coercion
- Recipe ingredients and instructions are escaped before rendering

These protections reduce the risk of stored or reflected XSS from imported JSON and persisted data.

Relevant files:

- `js/sanitize.js`
- `js/meals.js`
- `js/import.js`
- `functions/api/_validate.js`
- `js/plan-validation.js`

## Safe Failure Behavior

The production app is designed to fail closed when auth or API configuration is broken.

Implemented controls:

- Production detection checks `/api/me`
- Non-local deployments are treated as production by default
- If the production API is unavailable, the app shows an error instead of silently falling back to demo mode
- If the user is unauthenticated, the app stops and shows an auth message
- Demo mode is only enabled for `file:` and localhost-style environments
- Local function development can use `DEV_USER`, but only on localhost

This avoids accidental downgrade from authenticated D1-backed mode to insecure local storage behavior on real deployments.

Relevant files:

- `js/config.js`
- `js/app.js`
- `functions/api/_middleware.js`

## Caching and Sensitive Data Handling

Implemented controls:

- API client requests use `cache: 'no-store'`
- API middleware sets `Cache-Control: no-store, must-revalidate`
- Authentication checks use same-origin requests

These reduce the chance of stale or sensitive API responses being cached in inappropriate places.

Relevant files:

- `js/api.js`
- `js/auth.js`
- `js/config.js`
- `functions/api/_middleware.js`

## Database Query Safety

D1 queries are written using bound parameters rather than string interpolation of user input.

Implemented controls:

- SQL values are passed through `.bind(...)`
- Plan ownership checks are performed before plan-scoped reads and writes
- User-controlled identifiers are validated before use

This significantly reduces SQL injection risk in the current API surface.

Relevant files:

- `functions/api/_validate.js`
- `functions/api/*.js`
- `functions/api/week/[id].js`

## Deployment Notes

To keep the current security model intact:

- Keep the site behind Cloudflare Access
- Set `TEAM_DOMAIN` and `POLICY_AUD` in each deployed environment
- Apply `_headers` through Cloudflare Pages
- Treat demo mode as development-only
- Keep preview deployments configured with the same auth variables if previews are enabled

## Out of Scope

This document only describes protections implemented in the app and repo configuration.

It does not claim:

- end-to-end encryption
- protection for local demo-mode data
- security of external services outside the current configuration
