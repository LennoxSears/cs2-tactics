#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseHeader, parseEvent, parseTicks, parseGrenades } = require('@laihoe/demoparser2');

// Usage: stratcall-demo-parser <path-to-demo.dem>
// Writes parsed data to a temp file, outputs the file path to stdout.
// Format: line 1 = JSON metadata, remaining lines = TSV tick data.

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

const SAMPLE_INTERVAL = 32;

try {
  const buf = fs.readFileSync(demoPath);

  // Header
  const header = parseHeader(buf);

  // Rounds
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

  // Player positions — only needed fields
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

  // Compact grenades: type\tx\ty\ttick\tthrower
  const grenadeLines = [];
  if (Array.isArray(grenadeData)) {
    for (const g of grenadeData) {
      grenadeLines.push([
        g.grenade_type || '',
        Math.round((g.entity_x ?? g.X ?? 0) * 10) / 10,
        Math.round((g.entity_y ?? g.Y ?? 0) * 10) / 10,
        g.destroy_tick ?? g.tick ?? 0,
        (g.thrower_name || g.player_name || '').replace(/\t/g, ' '),
      ].join('\t'));
    }
  }

  // Write to temp file: metadata JSON + TSV tick rows
  const outPath = path.join(os.tmpdir(), `stratcall-demo-${Date.now()}.tsv`);
  const fd = fs.openSync(outPath, 'w');

  // Line 1: JSON metadata
  const meta = {
    mapName: header?.map_name || '',
    tickRate,
    rounds,
    grenadeCount: grenadeLines.length,
  };
  fs.writeSync(fd, JSON.stringify(meta) + '\n');

  // Grenade lines (prefixed with G\t)
  for (const line of grenadeLines) {
    fs.writeSync(fd, 'G\t' + line + '\n');
  }

  // Tick data lines: T\ttick\tsteamid\tname\tteam\thealth\talive\tx\ty
  // Downsampled to every SAMPLE_INTERVAL ticks
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

  // Output only the file path to stdout
  process.stdout.write(outPath);
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ error: err.message || 'Parse failed' }));
  process.exit(1);
}
