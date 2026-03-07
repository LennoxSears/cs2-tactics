#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIST="$SCRIPT_DIR/../web/dist"
RESOURCES="$SCRIPT_DIR/resources"

echo "==> Building web app..."
cd "$SCRIPT_DIR/../.."
pnpm build --filter=@stratcall/web

echo "==> Copying web dist into Neutralino resources..."
# Preserve Neutralino-specific files before clearing
TMPDIR=$(mktemp -d)
cp "$RESOURCES/js/neutralino.js" "$TMPDIR/" 2>/dev/null || true
cp "$RESOURCES/js/desktop-bridge.js" "$TMPDIR/" 2>/dev/null || true
cp -r "$RESOURCES/icons" "$TMPDIR/icons" 2>/dev/null || true

# Clear and copy web dist
rm -rf "$RESOURCES"/*
cp -r "$WEB_DIST"/* "$RESOURCES/"

# Restore Neutralino-specific files
mkdir -p "$RESOURCES/js"
cp "$TMPDIR/neutralino.js" "$RESOURCES/js/" 2>/dev/null || true
cp "$TMPDIR/desktop-bridge.js" "$RESOURCES/js/" 2>/dev/null || true
cp -r "$TMPDIR/icons" "$RESOURCES/icons" 2>/dev/null || true
rm -rf "$TMPDIR"

# Inject Neutralino client script + desktop bridge into index.html
# The bridge script must load before the app so it can set window.__STRATCALL_DESKTOP__
sed -i 's|</head>|<script src="js/neutralino.js"></script>\n<script src="js/desktop-bridge.js"></script>\n</head>|' "$RESOURCES/index.html"

echo "==> Building Neutralino app..."
cd "$SCRIPT_DIR"
neu build

echo "==> Done. Binaries in $SCRIPT_DIR/dist/"
