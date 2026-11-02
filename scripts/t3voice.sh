#!/bin/bash
# t3 voice: run this fork's web client against the T3 Code server that is already running on this
# machine (the desktop app's), with the voice control. Nothing is installed or restarted.
#
#   scripts/t3voice.sh          start the dev web client on http://127.0.0.1:${T3VOICE_PORT:-5790}
#   scripts/t3voice.sh pair     write a one-time pairing link (15 min, one use) to /tmp/t3voice/pair-link.txt
#   scripts/t3voice.sh phone    publish it for a phone over HTTPS via `netbird expose` (NetBird SSO,
#                               group $T3VOICE_NETBIRD_GROUP) and write a phone pairing link
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
  # One-time T3 pairing link for a browser that is not paired yet: valid 15 minutes, one use.
  # It is a credential, so it goes to a private file and is never printed.
  origin="${T3VOICE_PUBLIC_ORIGIN:-http://127.0.0.1:$PORT}"
  scopes=()
  # A browser reaching T3 from outside this Mac gets only what voice needs: threads, no
  # terminal, files, settings or access management.
  [ -n "${T3VOICE_PUBLIC_ORIGIN:-}" ] && scopes=(--scope orchestration:read --scope orchestration:operate)
  out="${T3VOICE_PAIR_FILE:-/tmp/t3voice/pair-link.txt}"
  mkdir -p "$(dirname "$out")"
  token="$("$T3" pair --ttl 15m --label "t3 voice (${origin#*://})" ${scopes[@]+"${scopes[@]}"} | sed -n 's/.*token=\([^[:space:]]*\).*/\1/p' | head -1)"
  [ -n "$token" ] || { echo "Could not mint a pairing token." >&2; exit 1; }
  (umask 077 && printf '%s/pair#token=%s\n' "$origin" "$token" > "$out")
  echo "Pairing link written to $out (valid 15 minutes, one use)."
  exit 0
fi

if [ "${1:-}" = "phone" ]; then
  # Publishes the client for a phone behind NetBird SSO, then writes the URL to
  # /tmp/t3voice/public-origin and a phone pairing link to /tmp/t3voice/pair-link.txt.
  #   default: `netbird expose` of a loopback front door (URL changes on every restart)
  #   T3VOICE_PUBLIC_ORIGIN=https://<service>: a persistent NetBird service targeting this Mac's
  #   NetBird IP on $T3VOICE_PHONE_PORT; the front door binds that address only, like Presence.
  # The front door refuses MCP and OAuth. Ctrl+C takes it down.
  group="${T3VOICE_NETBIRD_GROUP:-kale-board-tim}"
  phone_port="${T3VOICE_PHONE_PORT:-5791}"
  mkdir -p /tmp/t3voice && rm -f /tmp/t3voice/public-origin
  bind=127.0.0.1
  if [ -n "${T3VOICE_PUBLIC_ORIGIN:-}" ]; then
    bind="$(netbird status | sed -n 's/^NetBird IP: \([0-9.]*\).*/\1/p')"
    [ -n "$bind" ] || { echo "NetBird is not connected." >&2; exit 1; }
  fi
  T3VOICE_PHONE_BIND="$bind" T3VOICE_PHONE_PORT="$phone_port" T3VOICE_PORT="$PORT" node "$ROOT/scripts/t3voice-phone.mjs" &
  front=$!
  trap 'kill $front 2>/dev/null' EXIT
  publish() {
    printf '%s\n' "$1" > /tmp/t3voice/public-origin
    T3VOICE_PUBLIC_ORIGIN="$1" "$ROOT/scripts/t3voice.sh" pair
  }
  if [ -n "${T3VOICE_PUBLIC_ORIGIN:-}" ]; then
    publish "$T3VOICE_PUBLIC_ORIGIN"
    wait "$front"
    exit 0
  fi
  netbird expose "$phone_port" --with-name-prefix t3-voice --with-user-groups "$group" 2>&1 |
    while IFS= read -r line; do
      echo "$line"
      url="$(printf '%s' "$line" | grep -o 'https://[A-Za-z0-9.-]*' | head -1 || true)"
      [ -n "$url" ] && [ ! -s /tmp/t3voice/public-origin ] && publish "$url"
    done
  exit 0
fi

# The voice thread lives in a project rooted at this checkout; adding an existing project is a no-op error.
[ "${1:-}" = "__web" ] || "$T3" project add "$ROOT" --title "t3 voice" >/dev/null 2>&1 || true

if [ "${1:-}" = "__web" ]; then
  cd "$ROOT/apps/web"
  # NetBird's domain may reach Vite through the phone front door; DNS there is NetBird's.
  exec env T3CODE_SINGLE_ORIGIN_DEV=1 T3CODE_DEV_ALLOWED_HOSTS=.netbird.services T3CODE_PORT="$SERVER_PORT" PORT="$PORT" HOST=127.0.0.1 "$ROOT/node_modules/.bin/vp" dev
fi

echo "t3 voice: http://127.0.0.1:$PORT  (server :$SERVER_PORT). First time in a browser: scripts/t3voice.sh pair"
if [ -z "${ELEVENLABS_API_KEY:-}" ] && command -v kale-secret-get >/dev/null 2>&1; then
  cd "${KALE_INFISICAL_DIR:-$HOME/dev/kale/cloud}"
  exec kale-secret-get ELEVENLABS_API_KEY_AGENT_DASHBOARD --env dev -- "$ROOT/scripts/t3voice.sh" __web
fi
exec "$ROOT/scripts/t3voice.sh" __web
