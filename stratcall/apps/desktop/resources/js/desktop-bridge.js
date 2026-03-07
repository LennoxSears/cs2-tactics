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
      var grenades = [];

      for (var i = 1; i < lines.length; i++) {
        var line = lines[i];
        if (!line) continue;

        if (line.charCodeAt(0) === 71) { // 'G'
          // G\ttype\tx\ty\ttick\tthrower
          var gp = line.split('\t');
          grenades.push({
            grenade_type: gp[1],
            entity_x: parseFloat(gp[2]),
            entity_y: parseFloat(gp[3]),
            destroy_tick: parseInt(gp[4], 10),
            thrower_name: gp[5] || '',
          });
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
        grenadeData: grenades,
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
