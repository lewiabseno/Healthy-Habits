// GET /api/me — returns current user info
export async function onRequestGet(context) {
  return Response.json({
    userId: context.data.userId,
    email: context.data.userEmail || context.data.userId,
  });
}
