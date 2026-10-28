#!/bin/bash
# t3 voice: run this fork's web client against the T3 Code server that is already running on this
# machine (the desktop app's), with the voice control. Nothing is installed or restarted.
#
#   scripts/t3voice.sh          start the dev web client on http://127.0.0.1:${T3VOICE_PORT:-5790}
#   scripts/t3voice.sh pair     print a one-time pairing link for a browser that is not paired yet
#
# The ElevenLabs key comes from ELEVENLABS_API_KEY, or from Infisical through kale-secret-get, and
# only ever lives in the Vite process's environment.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${T3VOICE_PORT:-5790}"
T3="${T3CODE_CLI_PATH:-$HOME/.t3/bin/t3}"
RUNTIME="${T3CODE_HOME:-$HOME/.t3}/userdata/server-runtime.json"

server_port() {
  node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));try{process.kill(s.pid,0)}catch{process.exit(1)}console.log(s.port)' "$RUNTIME" 2>/dev/null
}

SERVER_PORT="$(server_port)" || { echo "No running T3 Code server found ($RUNTIME). Open T3 Code first." >&2; exit 1; }

if [ "${1:-}" = "pair" ]; then
  token="$("$T3" pair --ttl 15m --label "t3 voice (web dev)" | sed -n 's/.*token=\([^[:space:]]*\).*/\1/p' | head -1)"
  [ -n "$token" ] || { echo "Could not mint a pairing token." >&2; exit 1; }
  echo "Open once in your browser (valid 15 minutes, one use):"
  echo "  http://127.0.0.1:$PORT/pair#token=$token"
  exit 0
fi

# The voice thread lives in a project rooted at this checkout; adding an existing project is a no-op error.
[ "${1:-}" = "__web" ] || "$T3" project add "$ROOT" --title "t3 voice" >/dev/null 2>&1 || true

if [ "${1:-}" = "__web" ]; then
  cd "$ROOT/apps/web"
  exec env T3CODE_SINGLE_ORIGIN_DEV=1 T3CODE_PORT="$SERVER_PORT" PORT="$PORT" HOST=127.0.0.1 "$ROOT/node_modules/.bin/vp" dev
fi

echo "t3 voice: http://127.0.0.1:$PORT  (server :$SERVER_PORT). First time in a browser: scripts/t3voice.sh pair"
if [ -z "${ELEVENLABS_API_KEY:-}" ] && command -v kale-secret-get >/dev/null 2>&1; then
  cd "${KALE_INFISICAL_DIR:-$HOME/dev/kale/cloud}"
  exec kale-secret-get ELEVENLABS_API_KEY_AGENT_DASHBOARD --env dev -- "$ROOT/scripts/t3voice.sh" __web
fi
exec "$ROOT/scripts/t3voice.sh" __web
