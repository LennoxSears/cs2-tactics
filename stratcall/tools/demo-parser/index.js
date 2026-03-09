#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseHeader, parseEvent, parseTicks } = require('@laihoe/demoparser2');

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

  // Utility events — parse detonation/activation events for each grenade type
  const utilityEvents = [];

  const UTIL_EVENT_MAP = [
    ['smokegrenade_detonate', 'smoke', 18000],   // smoke lasts ~18s (18000ms)
    ['flashbang_detonate', 'flash', 2500],        // flash effect ~2.5s
    ['hegrenade_detonate', 'he', 1000],           // HE instant, show 1s
    ['inferno_startburn', 'molotov', 7000],       // molotov lasts ~7s
    ['decoy_started', 'decoy', 5000],             // decoy ~5s
  ];

  for (const [eventName, utilType, durationMs] of UTIL_EVENT_MAP) {
    try {
      const events = parseEvent(buf, eventName) || [];
      for (const e of events) {
        utilityEvents.push({
          type: utilType,
          x: e.x ?? e.X ?? 0,
          y: e.y ?? e.Y ?? 0,
          tick: e.tick ?? 0,
          durationTicks: Math.round((durationMs / 1000) * (header?.tickrate || 64)),
          thrower: (e.player_name || e.userid_name || '').replace(/\t/g, ' '),
          steamid: (e.player_steamid || e.userid_steamid || e.steamid || '').replace(/\t/g, ''),
        });
      }
    } catch (_) {}
  }

  // Also parse inferno_expire to get accurate molotov end times
  try {
    const infernoExpires = parseEvent(buf, 'inferno_expire') || [];
    // Match expires to starts by proximity
    const molotovStarts = utilityEvents.filter(u => u.type === 'molotov');
    for (const expire of infernoExpires) {
      const expTick = expire.tick ?? 0;
      // Find the closest molotov start before this expire
      let best = null;
      for (const m of molotovStarts) {
        if (m.tick < expTick && (!best || m.tick > best.tick)) {
          best = m;
        }
      }
      if (best) {
        best.durationTicks = expTick - best.tick;
      }
    }
  } catch (_) {}

  const tickRate = header?.tickrate || header?.playback_ticks
    ? Math.round((header.playback_ticks || 0) / (header.playback_time || 1))
    : 64;

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

  // Utility event lines: U\ttype\tx\ty\ttick\tdurationTicks\tthrower\tsteamid
  for (const u of utilityEvents) {
    fs.writeSync(fd, 'U\t' +
      u.type + '\t' +
      (Math.round(u.x * 10) / 10) + '\t' +
      (Math.round(u.y * 10) / 10) + '\t' +
      u.tick + '\t' +
      u.durationTicks + '\t' +
      u.thrower + '\t' +
      u.steamid + '\n'
    );
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
