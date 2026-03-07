// Desktop bridge: exposes local demo parsing to the web app
// Sets window.__STRATCALL_DESKTOP__ = true and provides window.__parseDemoFile__

(function() {
  window.__STRATCALL_DESKTOP__ = true;

  // Parse a demo file using the bundled stratcall-demo-parser binary
  // The binary is shipped alongside the Neutralino app in the same directory
  window.__parseDemoFile__ = async function(filePath) {
    // NL_PATH is the app directory (set by Neutralino runtime)
    const appDir = typeof NL_PATH !== 'undefined' ? NL_PATH : '.';
    const isWin = typeof NL_OS !== 'undefined' ? NL_OS === 'Windows' : navigator.platform.includes('Win');
    const parserName = isWin ? 'stratcall-demo-parser.exe' : 'stratcall-demo-parser';
    const parserPath = `${appDir}/${parserName}`;

    try {
      const result = await Neutralino.os.execCommand(`"${parserPath}" "${filePath}"`, {
        background: false,
      });

      if (result.exitCode !== 0) {
        let errMsg = 'Parse failed';
        try {
          const errData = JSON.parse(result.stdErr || result.stdOut);
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
