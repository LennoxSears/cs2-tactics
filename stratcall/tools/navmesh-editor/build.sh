#!/bin/sh
# Copy map images and navmesh data from the main app before Docker build
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$SCRIPT_DIR/../../apps/web"

mkdir -p "$SCRIPT_DIR/data/maps" "$SCRIPT_DIR/data/navmesh"
cp "$WEB_DIR/src/assets/maps/"*.png "$SCRIPT_DIR/data/maps/"
cp "$WEB_DIR/public/navmesh/"*.json "$SCRIPT_DIR/data/navmesh/"
echo "Data copied to $SCRIPT_DIR/data/"
