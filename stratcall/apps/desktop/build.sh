#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIST="$SCRIPT_DIR/../web/dist"
RESOURCES="$SCRIPT_DIR/resources"

echo "==> Building web app..."
cd "$SCRIPT_DIR/../.."
pnpm build --filter=@stratcall/web

echo "==> Copying web dist into Neutralino resources..."
# Keep the Neutralino JS client and icons
mkdir -p "$RESOURCES/js"
cp "$RESOURCES/js/neutralino.js" /tmp/_neutralino.js 2>/dev/null || true
cp -r "$RESOURCES/icons" /tmp/_icons 2>/dev/null || true

# Clear and copy web dist
rm -rf "$RESOURCES"/*
cp -r "$WEB_DIST"/* "$RESOURCES/"

# Restore Neutralino client and icons
mkdir -p "$RESOURCES/js"
cp /tmp/_neutralino.js "$RESOURCES/js/neutralino.js" 2>/dev/null || true
cp -r /tmp/_icons "$RESOURCES/icons" 2>/dev/null || true
rm -f /tmp/_neutralino.js
rm -rf /tmp/_icons

# Inject Neutralino client script + desktop bridge into index.html
# The bridge script must load before the app so it can set window.__STRATCALL_DESKTOP__
sed -i 's|</head>|<script src="js/neutralino.js"></script>\n<script src="js/desktop-bridge.js"></script>\n</head>|' "$RESOURCES/index.html"

echo "==> Building Neutralino app..."
cd "$SCRIPT_DIR"
neu build

echo "==> Done. Binaries in $SCRIPT_DIR/dist/"
