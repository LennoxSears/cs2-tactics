import { createMiddleware } from 'hono/factory';

export type AuthEnv = {
  Variables: {
    userId: string;
  };
};

// Session-based auth middleware
// For now, reads user ID from X-User-Id header (dev mode)
// Will be replaced with proper Steam session cookies
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '');
  const devUserId = c.req.header('X-User-Id');

  if (devUserId) {
    c.set('userId', devUserId);
    return next();
  }

  if (!sessionToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // TODO: validate session token against sessions table
  c.set('userId', sessionToken);
  return next();
});
