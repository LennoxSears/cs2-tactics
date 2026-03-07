#!/bin/bash
set -e

# Cross-build StratCall desktop app for Windows x64 from Linux.
# Packages: Neutralino Windows binary + web app resources + Node.js portable + demo parser + native addon.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/../.."
WEB_DIR="$SCRIPT_DIR/../web"
PARSER_DIR="$ROOT/tools/demo-parser"
RESOURCES="$SCRIPT_DIR/resources"
DIST="$SCRIPT_DIR/dist/stratcall-win-x64"

NODE_VERSION="20.18.1"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip"

echo "==> Building web app..."
cd "$ROOT"
pnpm build --filter=@stratcall/web

echo "==> Preparing output directory..."
rm -rf "$DIST"
mkdir -p "$DIST"

# ── 1. Neutralino binary + config ──
echo "==> Copying Neutralino Windows binary..."
cp "$SCRIPT_DIR/bin/neutralino-win_x64.exe" "$DIST/stratcall-win_x64.exe"

# Neutralino looks for neutralino.config.json next to the binary
cp "$SCRIPT_DIR/neutralino.config.json" "$DIST/neutralino.config.json"

# ── 2. Build resources.neu (zipped resources directory) ──
echo "==> Building resources.neu..."
TMPRES=$(mktemp -d)

# Copy web dist
cp -r "$WEB_DIR/dist"/* "$TMPRES/"

# Add Neutralino client library + desktop bridge
mkdir -p "$TMPRES/js"
cp "$RESOURCES/js/neutralino.js" "$TMPRES/js/"
cp "$RESOURCES/js/desktop-bridge.js" "$TMPRES/js/"

# Copy icons if present
if [ -d "$RESOURCES/icons" ]; then
  cp -r "$RESOURCES/icons" "$TMPRES/icons"
fi

# Inject scripts into index.html (before </head>)
sed -i 's|</head>|<script src="js/neutralino.js"></script>\n<script src="js/desktop-bridge.js"></script>\n</head>|' "$TMPRES/index.html"

cd "$TMPRES"
zip -r -q "$DIST/resources.neu" .
cd "$SCRIPT_DIR"
rm -rf "$TMPRES"

# ── 3. Bundle demo parser with portable Node.js for Windows ──
echo "==> Downloading portable Node.js ${NODE_VERSION} for Windows..."
PARSER_DIST="$DIST/parser"
mkdir -p "$PARSER_DIST"

NODE_ZIP="/tmp/node-v${NODE_VERSION}-win-x64.zip"
if [ ! -f "$NODE_ZIP" ]; then
  curl -fsSL "$NODE_URL" -o "$NODE_ZIP"
fi

# Extract just node.exe
NODE_DIR_NAME="node-v${NODE_VERSION}-win-x64"
unzip -q -o -j "$NODE_ZIP" "${NODE_DIR_NAME}/node.exe" -d "$PARSER_DIST"

# Copy parser script
cp "$PARSER_DIR/index.js" "$PARSER_DIST/"

# Download Windows native addon from npm
echo "==> Downloading demoparser2 Windows native addon..."
ADDON_TMP=$(mktemp -d)
cd "$ADDON_TMP"

# Get the main JS wrapper package
npm pack @laihoe/demoparser2@0.41.1 --quiet 2>/dev/null
tar xzf laihoe-demoparser2-0.41.1.tgz
mkdir -p "$PARSER_DIST/node_modules/@laihoe/demoparser2"
cp package/index.js "$PARSER_DIST/node_modules/@laihoe/demoparser2/"
cp package/package.json "$PARSER_DIST/node_modules/@laihoe/demoparser2/"
rm -rf package

# Get the Windows x64 native addon
npm pack @laihoe/demoparser2-win32-x64-msvc@0.41.1 --quiet 2>/dev/null
tar xzf *win32*.tgz
mkdir -p "$PARSER_DIST/node_modules/@laihoe/demoparser2-win32-x64-msvc"
cp -r package/* "$PARSER_DIST/node_modules/@laihoe/demoparser2-win32-x64-msvc/"

cd "$SCRIPT_DIR"
rm -rf "$ADDON_TMP"

# ── 4. Create the final zip for distribution ──
echo "==> Creating distribution zip..."
cd "$SCRIPT_DIR/dist"
rm -f stratcall-win-x64.zip
zip -r -q stratcall-win-x64.zip stratcall-win-x64/
ZIP_SIZE=$(du -h stratcall-win-x64.zip | cut -f1)

echo ""
echo "==> Windows build complete!"
echo "    Zip: $SCRIPT_DIR/dist/stratcall-win-x64.zip ($ZIP_SIZE)"
echo ""
echo "    Contents:"
ls -lh "$DIST/"
echo ""
echo "    Parser:"
ls -lh "$DIST/parser/"
echo ""
du -sh "$DIST"
