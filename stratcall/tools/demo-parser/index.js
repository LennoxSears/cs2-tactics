#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseHeader, parseEvent, parseTicks, parseGrenades } = require('@laihoe/demoparser2');

// Usage: stratcall-demo-parser <path-to-demo.dem>
// Outputs JSON to stdout

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  console.error('Usage: stratcall-demo-parser <path-to-demo.dem>');
  console.error('Parses a CS2 demo file and outputs JSON to stdout.');
  process.exit(args[0] === '--help' ? 0 : 1);
}

const demoPath = path.resolve(args[0]);

if (!fs.existsSync(demoPath)) {
  console.error(JSON.stringify({ error: `File not found: ${demoPath}` }));
  process.exit(1);
}

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

  // Player positions
  const tickData = parseTicks(buf, [
    'X', 'Y', 'Z', 'health', 'team_num', 'is_alive', 'player_name', 'player_steamid',
  ]);

  // Grenades (non-fatal if fails)
  let grenadeData = [];
  try {
    grenadeData = parseGrenades(buf) || [];
  } catch (_) {}

  const tickRate = header?.tickrate || header?.playback_ticks
    ? Math.round((header.playback_ticks || 0) / (header.playback_time || 1))
    : 64;

  const result = {
    mapName: header?.map_name || '',
    tickRate,
    rounds,
    tickData: Array.isArray(tickData) ? tickData : [],
    grenadeData: Array.isArray(grenadeData) ? grenadeData : [],
  };

  // Write JSON to stdout
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ error: err.message || 'Parse failed' }));
  process.exit(1);
}
