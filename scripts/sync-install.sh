#!/bin/sh
# Copy the installer from the afk repo so goafk.dev/install.sh always matches it.
# Usage: scripts/sync-install.sh [path-to-afk-checkout]   (default ../afk)
set -eu
SRC="${1:-../afk}/install.sh"
[ -f "$SRC" ] || { echo "not found: $SRC" >&2; exit 1; }
cp "$SRC" static/install.sh
echo "static/install.sh ← $SRC"
