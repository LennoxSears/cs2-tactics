#!/usr/bin/env node
'use strict';

// Build standalone executable using Node.js SEA (Single Executable Application)
// Requires Node.js >= 20
// The native addon (.node file) must be shipped alongside the executable.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const SEA_CONFIG = path.join(__dirname, 'sea-config.json');
const SEA_BLOB = path.join(DIST, 'sea-prep.blob');

// Platform-specific output name
const isWin = process.platform === 'win32';
const outName = isWin ? 'stratcall-demo-parser.exe' : 'stratcall-demo-parser';
const outPath = path.join(DIST, outName);

// Clean
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. Create SEA config
const seaConfig = {
  main: path.join(__dirname, 'index.js'),
  output: SEA_BLOB,
  disableExperimentalSEAWarning: true,
};
fs.writeFileSync(SEA_CONFIG, JSON.stringify(seaConfig, null, 2));

// 2. Generate the blob
console.log('Generating SEA blob...');
execSync(`node --experimental-sea-config ${SEA_CONFIG}`, { stdio: 'inherit' });

// 3. Copy the node binary
console.log('Copying node binary...');
fs.copyFileSync(process.execPath, outPath);
if (!isWin) fs.chmodSync(outPath, 0o755);

// 4. Inject the blob
console.log('Injecting SEA blob...');
if (process.platform === 'darwin') {
  execSync(`codesign --remove-signature "${outPath}"`, { stdio: 'inherit' });
  execSync(`npx postject "${outPath}" NODE_SEA_BLOB "${SEA_BLOB}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`, { stdio: 'inherit' });
  execSync(`codesign --sign - "${outPath}"`, { stdio: 'inherit' });
} else if (isWin) {
  // On Windows, remove signature first if signed
  try { execSync(`signtool remove /s "${outPath}"`, { stdio: 'ignore' }); } catch (_) {}
  execSync(`npx postject "${outPath}" NODE_SEA_BLOB "${SEA_BLOB}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { stdio: 'inherit' });
} else {
  execSync(`npx postject "${outPath}" NODE_SEA_BLOB "${SEA_BLOB}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { stdio: 'inherit' });
}

// 5. Copy native addon alongside
console.log('Copying native addon...');
const nativeDir = path.dirname(require.resolve('@laihoe/demoparser2'));
const nodeFiles = fs.readdirSync(nativeDir).filter(f => f.endsWith('.node'));
// Also check platform-specific optional dep
const platformPkg = `@laihoe/demoparser2-${process.platform}-${process.arch}${process.platform === 'linux' ? '-gnu' : ''}`;
try {
  const platDir = path.dirname(require.resolve(platformPkg));
  const platFiles = fs.readdirSync(platDir).filter(f => f.endsWith('.node'));
  for (const f of platFiles) {
    fs.copyFileSync(path.join(platDir, f), path.join(DIST, f));
    console.log(`  Copied ${f}`);
  }
} catch (_) {
  // Fallback: copy from main package
  for (const f of nodeFiles) {
    fs.copyFileSync(path.join(nativeDir, f), path.join(DIST, f));
    console.log(`  Copied ${f}`);
  }
}

// Cleanup
fs.rmSync(SEA_CONFIG);
fs.rmSync(SEA_BLOB);

console.log(`\nBuild complete: ${outPath}`);
console.log('Ship the entire dist/ directory together.');
