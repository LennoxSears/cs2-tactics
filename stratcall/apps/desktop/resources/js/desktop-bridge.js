// Desktop bridge: exposes local demo parsing to the web app
// Sets window.__STRATCALL_DESKTOP__ = true and provides window.__parseDemoFile__

(function() {
  window.__STRATCALL_DESKTOP__ = true;

  // Parse a demo file using the bundled demo parser.
  // On Windows: uses bundled node.exe + parser script (cross-compiled from Linux).
  // On Linux/macOS: uses Node.js SEA binary if available, otherwise node + script.
  window.__parseDemoFile__ = async function(filePath) {
    var appDir = typeof NL_PATH !== 'undefined' ? NL_PATH : '.';
    var isWin = typeof NL_OS !== 'undefined' ? NL_OS === 'Windows' : navigator.platform.includes('Win');

    // Build the command to invoke the parser
    var cmd;
    if (isWin) {
      // Windows: bundled node.exe + parser script + native addon in parser/ subdirectory
      var nodeExe = appDir + '/parser/node.exe';
      var script = appDir + '/parser/index.js';
      cmd = '"' + nodeExe + '" "' + script + '" "' + filePath + '"';
    } else {
      // Linux/macOS: try SEA binary first, fall back to node + script
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

      return JSON.parse(result.stdOut);
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
