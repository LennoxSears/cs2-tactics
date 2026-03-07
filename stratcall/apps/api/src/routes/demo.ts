import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { parseHeader, parseEvent, parseTicks, parseGrenades } from '@laihoe/demoparser2';

const demo = new Hono();

demo.use('/parse', bodyLimit({ maxSize: 200 * 1024 * 1024 }));

// POST /api/demo/parse — accepts raw .dem file body, returns parsed data
demo.post('/parse', async (c) => {
  const body = await c.req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return c.json({ error: 'No demo file provided' }, 400);
  }
  if (body.byteLength > 200 * 1024 * 1024) {
    return c.json({ error: 'File too large (max 200MB)' }, 413);
  }

  const buf = Buffer.from(body);

  try {
    const header = parseHeader(buf);
    const roundStarts = parseEvent(buf, 'round_start') || [];
    const roundEnds = parseEvent(buf, 'round_end') || [];

    const rounds = [];
    for (let i = 0; i < roundStarts.length; i++) {
      rounds.push({
        roundNum: i + 1,
        startTick: roundStarts[i]?.tick ?? 0,
        endTick: roundEnds[i]?.tick ?? (roundStarts[i + 1]?.tick ?? 0),
      });
    }

    const tickData = parseTicks(buf, [
      'X', 'Y', 'Z', 'health', 'team_num', 'is_alive', 'player_name', 'player_steamid',
    ]);

    let grenadeData: any[] = [];
    try {
      grenadeData = parseGrenades(buf) || [];
    } catch {
      // Some demos fail on grenade parsing — non-fatal
    }

    const tickRate = header?.tickrate || header?.playback_ticks
      ? Math.round((header.playback_ticks || 0) / (header.playback_time || 1))
      : 64;

    return c.json({
      mapName: header?.map_name || '',
      tickRate,
      rounds,
      tickData: Array.isArray(tickData) ? tickData : [],
      grenadeData: Array.isArray(grenadeData) ? grenadeData : [],
    });
  } catch (err: any) {
    console.error('Demo parse error:', err);
    return c.json({ error: err.message || 'Failed to parse demo' }, 500);
  }
});

export default demo;
