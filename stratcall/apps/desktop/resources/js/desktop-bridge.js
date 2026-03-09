// Desktop bridge: exposes local demo parsing to the web app
// Sets window.__STRATCALL_DESKTOP__ = true and provides window.__parseDemoFile__

(function() {
  window.__STRATCALL_DESKTOP__ = true;

  // Parse a demo file using the bundled demo parser.
  // Parser writes results to a temp TSV file and outputs the path to stdout.
  // Bridge reads the file via Neutralino.filesystem, avoiding V8 string limits.
  window.__parseDemoFile__ = async function(filePath) {
    var appDir = typeof NL_PATH !== 'undefined' ? NL_PATH : '.';
    var isWin = typeof NL_OS !== 'undefined' ? NL_OS === 'Windows' : navigator.platform.includes('Win');

    var cmd;
    if (isWin) {
      var nodeExe = appDir + '/parser/node.exe';
      var script = appDir + '/parser/index.js';
      cmd = '"' + nodeExe + '" "' + script + '" "' + filePath + '"';
    } else {
      var seaBin = appDir + '/stratcall-demo-parser';
      cmd = '"' + seaBin + '" "' + filePath + '"';
    }

    try {
      var result = await Neutralino.os.execCommand(cmd, {
        background: false,
      });

      if (result.exitCode !== 0) {
        var errMsg = 'Parse failed';
        try {
          var errData = JSON.parse(result.stdErr || result.stdOut);
          errMsg = errData.error || errMsg;
        } catch (_) {
          errMsg = result.stdErr || result.stdOut || errMsg;
        }
        throw new Error(errMsg);
      }

      // stdout contains the temp file path
      var tsvPath = result.stdOut.trim();
      var content = await Neutralino.filesystem.readFile(tsvPath);

      // Clean up temp file
      try { await Neutralino.filesystem.removeFile(tsvPath); } catch (_) {}

      // Parse: line 1 = JSON metadata, then G\t... grenades, then T\t... ticks
      var lines = content.split('\n');
      var meta = JSON.parse(lines[0]);

      var tickMap = {};
      var utilities = [];
      var bombEvts = [];
      var killEvts = [];

      for (var i = 1; i < lines.length; i++) {
        var line = lines[i];
        if (!line) continue;

        if (line.charCodeAt(0) === 85) { // 'U'
          // U\ttype\tx\ty\ttick\tdurationTicks\tthrower\tsteamid\tthrowTick\tthrowX\tthrowY
          var up = line.split('\t');
          var ue = {
            type: up[1],
            x: parseFloat(up[2]),
            y: parseFloat(up[3]),
            tick: parseInt(up[4], 10),
            durationTicks: parseInt(up[5], 10),
            thrower: up[6] || '',
            steamid: up[7] || '',
          };
          if (up[8]) ue.throwTick = parseInt(up[8], 10);
          if (up[9]) ue.throwX = parseFloat(up[9]);
          if (up[10]) ue.throwY = parseFloat(up[10]);
          utilities.push(ue);
        } else if (line.charCodeAt(0) === 66) { // 'B'
          // B\ttype\ttick\tplayer\tsteamid\tsite\tx\ty\thasKit
          var bp = line.split('\t');
          bombEvts.push({
            type: bp[1],
            tick: parseInt(bp[2], 10),
            player: bp[3] || '',
            steamid: bp[4] || '',
            site: parseInt(bp[5], 10),
            x: parseFloat(bp[6]),
            y: parseFloat(bp[7]),
            hasKit: bp[8] === '1',
          });
        } else if (line.charCodeAt(0) === 75) { // 'K'
          // K\ttick\tvictimName\tvictimSteamid\tvictimX\tvictimY\tattackerName\tattackerSteamid\tattackerX\tattackerY\tweapon\theadshot
          var kp = line.split('\t');
          var ke = {
            tick: parseInt(kp[1], 10),
            victimName: kp[2] || '',
            victimSteamid: kp[3] || '',
            victimX: parseFloat(kp[4]),
            victimY: parseFloat(kp[5]),
            attackerName: kp[6] || '',
            attackerSteamid: kp[7] || '',
            attackerX: parseFloat(kp[8]),
            attackerY: parseFloat(kp[9]),
            weapon: kp[10] || '',
            headshot: kp[11] === '1',
          };
          if (kp[12]) {
            ke.assisterName = kp[12];
            ke.assisterSteamid = kp[13] || '';
            if (kp[14]) ke.assisterX = parseFloat(kp[14]);
            if (kp[15]) ke.assisterY = parseFloat(kp[15]);
          }
          killEvts.push(ke);
        } else if (line.charCodeAt(0) === 84) { // 'T'
          // T\ttick\tsteamid\tname\tteam\thealth\talive\tx\ty
          var tp = line.split('\t');
          var tick = parseInt(tp[1], 10);
          if (!tickMap[tick]) tickMap[tick] = [];
          tickMap[tick].push({
            player_steamid: tp[2],
            player_name: tp[3],
            team_num: parseInt(tp[4], 10),
            health: parseInt(tp[5], 10),
            is_alive: tp[6] === '1',
            X: parseFloat(tp[7]),
            Y: parseFloat(tp[8]),
          });
        }
      }

      // Convert tickMap to array format expected by client
      var tickData = [];
      var ticks = Object.keys(tickMap).map(Number).sort(function(a, b) { return a - b; });
      for (var t = 0; t < ticks.length; t++) {
        var players = tickMap[ticks[t]];
        for (var p = 0; p < players.length; p++) {
          players[p].tick = ticks[t];
          tickData.push(players[p]);
        }
      }

      return {
        mapName: meta.mapName,
        tickRate: meta.tickRate,
        rounds: meta.rounds,
        tickData: tickData,
        bombEvents: bombEvts,
        killEvents: killEvts,
        utilityEvents: utilities,
      };
    } catch (err) {
      if (err.message) throw err;
      throw new Error('Failed to run demo parser');
    }
  };

  // Open a file picker for .dem files
  window.__pickDemoFile__ = async function() {
    const entries = await Neutralino.os.showOpenDialog('Select CS2 Demo File', {
      filters: [
        { name: 'CS2 Demo Files', extensions: ['dem'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (entries && entries.length > 0) {
      return entries[0];
    }
    return null;
  };

  Neutralino.init();
  Neutralino.events.on('windowClose', () => {
    Neutralino.app.exit();
  });
})();
