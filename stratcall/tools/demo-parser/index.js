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
          thrower: (e.user_name || e.player_name || '').replace(/\t/g, ' '),
          steamid: (e.user_steamid || e.player_steamid || '').replace(/\t/g, ''),
        });
      }
    } catch (_) {}
  }

  // Parse weapon_fire events to get exact throw origins
  const WEAPON_TO_UTIL = {
    'weapon_smokegrenade': 'smoke',
    'weapon_flashbang': 'flash',
    'weapon_hegrenade': 'he',
    'weapon_molotov': 'molotov',
    'weapon_incgrenade': 'molotov',
    'weapon_decoy': 'decoy',
  };

  try {
    // Request player X,Y position at the time of weapon_fire
    const fires = parseEvent(buf, 'weapon_fire', ['X', 'Y']) || [];
    // Collect grenade throws: { type, tick, steamid, x, y }
    const throws = [];
    for (const f of fires) {
      const weapon = f.weapon || '';
      const utilType = WEAPON_TO_UTIL[weapon];
      if (!utilType) continue;
      throws.push({
        type: utilType,
        tick: f.tick ?? 0,
        steamid: (f.user_steamid || '').replace(/\t/g, ''),
        x: f.user_X ?? 0,
        y: f.user_Y ?? 0,
      });
    }

    // Match each detonation to the closest prior weapon_fire by same player + type
    for (const u of utilityEvents) {
      let best = null;
      let bestDist = Infinity;
      for (const t of throws) {
        if (t.type !== u.type) continue;
        if (t.steamid !== u.steamid) continue;
        const d = u.tick - t.tick;
        if (d < 0 || d > 1024) continue; // throw must be before detonation, within ~16s
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }
      if (best) {
        u.throwTick = best.tick;
        u.throwX = best.x;
        u.throwY = best.y;
      }
    }
  } catch (_) {}

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

  // Bomb events
  const bombEvents = [];
  try {
    const beginPlants = parseEvent(buf, 'bomb_beginplant', ['X', 'Y']) || [];
    const planted = parseEvent(buf, 'bomb_planted', ['X', 'Y']) || [];
    const beginDefuses = parseEvent(buf, 'bomb_begindefuse', ['X', 'Y']) || [];
    const defused = parseEvent(buf, 'bomb_defused') || [];
    const exploded = parseEvent(buf, 'bomb_exploded') || [];
    const dropped = parseEvent(buf, 'bomb_dropped', ['X', 'Y']) || [];
    const pickup = parseEvent(buf, 'bomb_pickup', ['X', 'Y']) || [];

    // Detect fake plants: beginplant with no matching planted
    for (const bp of beginPlants) {
      const completed = planted.find(p =>
        p.user_steamid === bp.user_steamid && p.tick > bp.tick && p.tick - bp.tick < 300
      );
      bombEvents.push({
        type: completed ? 'plant_begin' : 'plant_fake',
        tick: bp.tick,
        player: (bp.user_name || '').replace(/\t/g, ' '),
        steamid: (bp.user_steamid || '').replace(/\t/g, ''),
        site: bp.site ?? 0,
        x: bp.user_X ?? 0,
        y: bp.user_Y ?? 0,
      });
    }

    for (const p of planted) {
      bombEvents.push({
        type: 'planted',
        tick: p.tick ?? 0,
        player: (p.user_name || '').replace(/\t/g, ' '),
        steamid: (p.user_steamid || '').replace(/\t/g, ''),
        site: p.site ?? 0,
        x: p.user_X ?? 0,
        y: p.user_Y ?? 0,
      });
    }

    // Detect fake defuses: begindefuse interrupted by another begindefuse or no completion
    for (const bd of beginDefuses) {
      const defuseTime = bd.haskit ? 320 : 640;
      const completed = defused.find(d =>
        d.user_steamid === bd.user_steamid && d.tick > bd.tick && d.tick - bd.tick <= defuseTime + 64
      );
      const interrupted = beginDefuses.find(bd2 =>
        bd2 !== bd && bd2.user_steamid === bd.user_steamid &&
        bd2.tick > bd.tick && bd2.tick < bd.tick + defuseTime
      );
      bombEvents.push({
        type: completed ? 'defuse_begin' : (interrupted ? 'defuse_fake' : 'defuse_fake'),
        tick: bd.tick,
        player: (bd.user_name || '').replace(/\t/g, ' '),
        steamid: (bd.user_steamid || '').replace(/\t/g, ''),
        site: bd.site ?? 0,
        x: bd.user_X ?? 0,
        y: bd.user_Y ?? 0,
        hasKit: bd.haskit ?? false,
      });
    }

    for (const d of defused) {
      bombEvents.push({
        type: 'defused', tick: d.tick ?? 0,
        player: (d.user_name || '').replace(/\t/g, ' '),
        steamid: (d.user_steamid || '').replace(/\t/g, ''),
        site: d.site ?? 0, x: 0, y: 0,
      });
    }

    for (const e of exploded) {
      bombEvents.push({
        type: 'exploded', tick: e.tick ?? 0,
        player: (e.user_name || '').replace(/\t/g, ' '),
        steamid: (e.user_steamid || '').replace(/\t/g, ''),
        site: e.site ?? 0, x: 0, y: 0,
      });
    }

    for (const d of dropped) {
      bombEvents.push({
        type: 'dropped', tick: d.tick ?? 0,
        player: (d.user_name || '').replace(/\t/g, ' '),
        steamid: (d.user_steamid || '').replace(/\t/g, ''),
        site: 0, x: d.user_X ?? 0, y: d.user_Y ?? 0,
      });
    }

    for (const p of pickup) {
      bombEvents.push({
        type: 'pickup', tick: p.tick ?? 0,
        player: (p.user_name || '').replace(/\t/g, ' '),
        steamid: (p.user_steamid || '').replace(/\t/g, ''),
        site: 0, x: p.user_X ?? 0, y: p.user_Y ?? 0,
      });
    }

    bombEvents.sort((a, b) => a.tick - b.tick);
  } catch (_) {}

  // Kill events
  const killEvents = [];
  try {
    const deaths = parseEvent(buf, 'player_death', ['X', 'Y']) || [];
    for (const d of deaths) {
      // Skip world/fall damage kills with no attacker
      if (!d.attacker_name && !d.attacker_steamid) continue;
      const kill = {
        tick: d.tick ?? 0,
        victimName: (d.user_name || '').replace(/\t/g, ' '),
        victimSteamid: (d.user_steamid || '').replace(/\t/g, ''),
        victimX: d.user_X ?? 0,
        victimY: d.user_Y ?? 0,
        attackerName: (d.attacker_name || '').replace(/\t/g, ' '),
        attackerSteamid: (d.attacker_steamid || '').replace(/\t/g, ''),
        attackerX: d.attacker_X ?? 0,
        attackerY: d.attacker_Y ?? 0,
        weapon: (d.weapon || '').replace(/\t/g, ''),
        headshot: d.headshot ?? false,
        assisterName: '',
        assisterSteamid: '',
        assisterX: 0,
        assisterY: 0,
      };
      if (d.assister_name) {
        kill.assisterName = (d.assister_name || '').replace(/\t/g, ' ');
        kill.assisterSteamid = (d.assister_steamid || '').replace(/\t/g, '');
        kill.assisterX = d.assister_X ?? 0;
        kill.assisterY = d.assister_Y ?? 0;
      }
      killEvents.push(kill);
    }
  } catch (_) {}

  // Gun fire events (for muzzle flash direction animation)
  const gunFireEvents = [];
  try {
    // Reuse the weapon_fire data already parsed (fires variable from above)
    for (const f of fires) {
      const w = f.weapon || '';
      // Skip grenades, knives, C4, taser
      if (w.includes('smoke') || w.includes('flash') || w.includes('hegrenade') ||
          w.includes('molotov') || w.includes('incgrenade') || w.includes('decoy') ||
          w.includes('knife') || w === 'weapon_c4' || w === 'weapon_taser') continue;
      gunFireEvents.push({
        tick: f.tick ?? 0,
        steamid: (f.user_steamid || '').replace(/\t/g, ''),
        x: f.user_X ?? 0,
        y: f.user_Y ?? 0,
        yaw: f.user_yaw ?? 0,
      });
    }
  } catch (_) {}

  const tickRate = header?.tickrate
    || (header?.playback_ticks && header?.playback_time
      ? Math.round(header.playback_ticks / header.playback_time)
      : 64);

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

  // Utility event lines: U\ttype\tx\ty\ttick\tdurationTicks\tthrower\tsteamid\tthrowTick\tthrowX\tthrowY
  for (const u of utilityEvents) {
    fs.writeSync(fd, 'U\t' +
      u.type + '\t' +
      (Math.round(u.x * 10) / 10) + '\t' +
      (Math.round(u.y * 10) / 10) + '\t' +
      u.tick + '\t' +
      u.durationTicks + '\t' +
      u.thrower + '\t' +
      u.steamid + '\t' +
      (u.throwTick ?? '') + '\t' +
      (u.throwX != null ? Math.round(u.throwX * 10) / 10 : '') + '\t' +
      (u.throwY != null ? Math.round(u.throwY * 10) / 10 : '') + '\n'
    );
  }

  // Bomb event lines: B\ttype\ttick\tplayer\tsteamid\tsite\tx\ty\thasKit
  for (const b of bombEvents) {
    fs.writeSync(fd, 'B\t' +
      b.type + '\t' +
      b.tick + '\t' +
      b.player + '\t' +
      b.steamid + '\t' +
      b.site + '\t' +
      (Math.round((b.x ?? 0) * 10) / 10) + '\t' +
      (Math.round((b.y ?? 0) * 10) / 10) + '\t' +
      (b.hasKit ? '1' : '0') + '\n'
    );
  }

  // Kill event lines: K\ttick\tvictimName\tvictimSteamid\tvictimX\tvictimY\tattackerName\tattackerSteamid\tattackerX\tattackerY\tweapon\theadshot\tassisterName\tassisterSteamid\tassisterX\tassisterY
  for (const k of killEvents) {
    fs.writeSync(fd, 'K\t' +
      k.tick + '\t' +
      k.victimName + '\t' +
      k.victimSteamid + '\t' +
      (Math.round(k.victimX * 10) / 10) + '\t' +
      (Math.round(k.victimY * 10) / 10) + '\t' +
      k.attackerName + '\t' +
      k.attackerSteamid + '\t' +
      (Math.round(k.attackerX * 10) / 10) + '\t' +
      (Math.round(k.attackerY * 10) / 10) + '\t' +
      k.weapon + '\t' +
      (k.headshot ? '1' : '0') + '\t' +
      k.assisterName + '\t' +
      k.assisterSteamid + '\t' +
      (k.assisterX ? Math.round(k.assisterX * 10) / 10 : '') + '\t' +
      (k.assisterY ? Math.round(k.assisterY * 10) / 10 : '') + '\n'
    );
  }

  // Gun fire lines: F\ttick\tsteamid\tx\ty\tyaw
  for (const f of gunFireEvents) {
    fs.writeSync(fd, 'F\t' +
      f.tick + '\t' +
      f.steamid + '\t' +
      (Math.round(f.x * 10) / 10) + '\t' +
      (Math.round(f.y * 10) / 10) + '\t' +
      (Math.round(f.yaw * 100) / 100) + '\n'
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
