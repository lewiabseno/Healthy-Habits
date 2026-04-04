// GET /api/me — returns current user info from DB
export async function onRequestGet(context) {
  const { env, data: { userId, userEmail } } = context;

  // Try to get full user record
  try {
    const user = await env.DB.prepare(
      'SELECT id, email, display_name, created_at, last_seen_at FROM users WHERE id = ?'
    ).bind(userId).first();

    if (user) {
      return Response.json(user);
    }
  } catch (e) {
    // Table might not exist yet
  }

  // Fallback if no DB record
  return Response.json({
    id: userId,
    email: userEmail || userId,
    display_name: null,
    created_at: null,
    last_seen_at: null,
  });
}
