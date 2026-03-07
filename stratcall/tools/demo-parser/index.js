#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseHeader, parseEvent, parseTicks, parseGrenades } = require('@laihoe/demoparser2');

// Usage: stratcall-demo-parser <path-to-demo.dem>
// Writes parsed data to a temp file, outputs the file path to stdout.
// Format: line 1 = JSON metadata, then G\t lines (grenades), then T\t lines (ticks).

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  console.error('Usage: stratcall-demo-parser <path-to-demo.dem>');
  process.exit(args[0] === '--help' ? 0 : 1);
}

const demoPath = path.resolve(args[0]);

if (!fs.existsSync(demoPath)) {
  console.error(JSON.stringify({ error: `File not found: ${demoPath}` }));
  process.exit(1);
}

const SAMPLE_INTERVAL = 16; // ~4 samples/sec at 64 tick — smooth enough for replay

try {
  const buf = fs.readFileSync(demoPath);

  // Header
  const header = parseHeader(buf);

  // Round events
  const roundStarts = parseEvent(buf, 'round_start') || [];
  const roundEnds = parseEvent(buf, 'round_end') || [];
  const freezeEnds = parseEvent(buf, 'round_freeze_end') || [];

  const rounds = [];
  for (let i = 0; i < roundStarts.length; i++) {
    const rs = roundStarts[i];
    rounds.push({
      roundNum: i + 1,
      startTick: rs?.tick ?? 0,
      freezeEndTick: freezeEnds[i]?.tick ?? (rs?.tick ?? 0),
      endTick: roundEnds[i]?.tick ?? (roundStarts[i + 1]?.tick ?? 0),
      timelimit: rs?.timelimit ?? 115,
    });
  }

  // Player positions
  const tickData = parseTicks(buf, [
    'X', 'Y', 'health', 'team_num', 'is_alive', 'player_name', 'player_steamid',
  ]);

  // Grenades
  let grenadeData = [];
  try {
    grenadeData = parseGrenades(buf) || [];
  } catch (_) {}

  const tickRate = header?.tickrate || header?.playback_ticks
    ? Math.round((header.playback_ticks || 0) / (header.playback_time || 1))
    : 64;

  // Normalize grenade type names (parser may return *_projectile suffix)
  function normalizeGrenadeType(t) {
    if (!t) return '';
    t = t.replace(/_projectile$/, '');
    return t;
  }

  // Write to temp file
  const outPath = path.join(os.tmpdir(), `stratcall-demo-${Date.now()}.tsv`);
  const fd = fs.openSync(outPath, 'w');

  // Line 1: JSON metadata
  const meta = {
    mapName: header?.map_name || '',
    tickRate,
    rounds,
  };
  fs.writeSync(fd, JSON.stringify(meta) + '\n');

  // Grenade lines: G\ttype\tx\ty\ttick\tthrower
  if (Array.isArray(grenadeData)) {
    for (const g of grenadeData) {
      const gtype = normalizeGrenadeType(g.grenade_type);
      if (!gtype) continue;
      fs.writeSync(fd, 'G\t' +
        gtype + '\t' +
        (Math.round((g.entity_x ?? g.X ?? 0) * 10) / 10) + '\t' +
        (Math.round((g.entity_y ?? g.Y ?? 0) * 10) / 10) + '\t' +
        (g.destroy_tick ?? g.tick ?? 0) + '\t' +
        ((g.thrower_name || g.player_name || '').replace(/\t/g, ' ')) + '\n'
      );
    }
  }

  // Tick data lines: T\ttick\tsteamid\tname\tteam\thealth\talive\tx\ty
  if (Array.isArray(tickData)) {
    for (const row of tickData) {
      const tick = row.tick;
      if (tick == null) continue;
      if (tick % SAMPLE_INTERVAL !== 0) continue;

      fs.writeSync(fd, 'T\t' +
        tick + '\t' +
        (row.player_steamid || '') + '\t' +
        (row.player_name || '').replace(/\t/g, ' ') + '\t' +
        (row.team_num ?? 0) + '\t' +
        (row.health ?? 0) + '\t' +
        (row.is_alive ? 1 : 0) + '\t' +
        (Math.round((row.X ?? 0) * 10) / 10) + '\t' +
        (Math.round((row.Y ?? 0) * 10) / 10) + '\n'
      );
    }
  }

  fs.closeSync(fd);

  process.stdout.write(outPath);
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ error: err.message || 'Parse failed' }));
  process.exit(1);
}
