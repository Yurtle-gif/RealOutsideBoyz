#!/usr/bin/env bash
# Generates config.local.js (gitignored) from .env.local so the browser can read the Google Maps key.
# Never prints the key. Usage: scripts/make-config.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "no .env.local; Google 3D mode stays off"; exit 0; }
key=$(grep -E '^GOOGLE_MAPS_API_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"'[:space:]')
[ -n "$key" ] || { echo "GOOGLE_MAPS_API_KEY missing in .env.local"; exit 1; }
umask 077
printf 'window.ROB_CONFIG = { googleMapsApiKey: "%s" };\n' "$key" > config.local.js
chmod 600 config.local.js
echo "wrote config.local.js (key length ${#key})"
