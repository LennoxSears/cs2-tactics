import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { users } from '@stratcall/db';
import { db } from '../db';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

const auth = new Hono();

// Redirect to Steam login
auth.get('/steam', (c) => {
  const origin = c.req.query('origin') || process.env.APP_URL || 'http://localhost:5173';
  const returnUrl = `${origin}/auth/callback`;
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnUrl,
    'openid.realm': origin,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return c.redirect(`${STEAM_OPENID_URL}?${params}`);
});

// Steam callback — validate and create/update user
// The frontend calls this with the OpenID params from the URL
auth.get('/steam/callback', async (c) => {
  const query = c.req.query();

  // Verify with Steam
  const verifyParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    verifyParams.set(key, value);
  }
  verifyParams.set('openid.mode', 'check_authentication');

  const verifyRes = await fetch(STEAM_OPENID_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: verifyParams.toString(),
  });
  const verifyText = await verifyRes.text();

  if (!verifyText.includes('is_valid:true')) {
    return c.json({ error: 'Steam verification failed' }, 401);
  }

  // Extract Steam ID from claimed_id
  const claimedId = query['openid.claimed_id'] || '';
  const steamId = claimedId.split('/').pop() || '';
  if (!steamId) {
    return c.json({ error: 'Could not extract Steam ID' }, 400);
  }

  // Fetch Steam profile
  const steamApiKey = process.env.STEAM_API_KEY;
  let displayName = `Player ${steamId.slice(-4)}`;
  let avatarUrl: string | null = null;

  if (steamApiKey) {
    try {
      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamId}`
      );
      const profileData = await profileRes.json() as {
        response: { players: Array<{ personaname: string; avatarfull: string }> };
      };
      const player = profileData.response.players[0];
      if (player) {
        displayName = player.personaname;
        avatarUrl = player.avatarfull;
      }
    } catch {
      // Use defaults
    }
  }

  // Upsert user
  const [existing] = await db.select().from(users).where(eq(users.steamId, steamId)).limit(1);
  let userId: string;

  if (existing) {
    userId = existing.id;
    await db.update(users).set({ displayName, avatarUrl }).where(eq(users.id, userId));
  } else {
    userId = nanoid();
    await db.insert(users).values({
      id: userId,
      steamId,
      displayName,
      avatarUrl,
      bio: '',
      createdAt: new Date(),
    });
  }

  return c.json({ userId, steamId, displayName, avatarUrl });
});

// Get current user
auth.get('/me', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);

  return c.json(user);
});

export default auth;
