#!/usr/bin/env bash
set -euo pipefail

APP_IDS="${STEAM_APP_IDS:-331670 397460 434170 610180 774461 1005300 1211630 1552350 1755580 1850960 2216830 3364070}"
JACKBOX_DIR="/config/jackbox"
DESKTOP_DIR="/config/Desktop"
AUTOSTART_DIR="/config/.config/autostart"
STEAM_START_DELAY_SECONDS="${STEAM_START_DELAY_SECONDS:-12}"
STEAM_ARGS="${STEAM_ARGS:--silent}"

mkdir -p "$JACKBOX_DIR" "$DESKTOP_DIR" "$AUTOSTART_DIR" /mnt/games/SteamLibrary

cat > "$JACKBOX_DIR/apps.env" <<EOF
STEAM_APP_IDS="$APP_IDS"
STEAM_ARGS="$STEAM_ARGS"
STEAM_START_DELAY_SECONDS="$STEAM_START_DELAY_SECONDS"
EOF

cat > "$JACKBOX_DIR/start-steam.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [ -f /config/jackbox/apps.env ]; then
  # shellcheck disable=SC1091
  . /config/jackbox/apps.env
fi

export DISPLAY="${DISPLAY:-:1}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-abc}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR" || true

sleep "${STEAM_START_DELAY_SECONDS:-12}"
steam ${STEAM_ARGS:--silent} >/config/jackbox/steam.log 2>&1 &
EOF

chmod +x "$JACKBOX_DIR/start-steam.sh"

cat > "$JACKBOX_DIR/open-installers.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [ -f /config/jackbox/apps.env ]; then
  # shellcheck disable=SC1091
  . /config/jackbox/apps.env
fi

APP_IDS="${STEAM_APP_IDS:-}"
LOG_FILE="/config/jackbox/install-queue.log"
export DISPLAY="${DISPLAY:-:1}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-abc}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR" || true

{
  echo "Opening Steam install URLs at $(date -Is)"

  for app_id in $APP_IDS; do
    echo "Queueing steam://install/${app_id}"
    xdg-open "steam://install/${app_id}" >/dev/null 2>&1 || true
    sleep 2
  done
} >> "$LOG_FILE" 2>&1
EOF

chmod +x "$JACKBOX_DIR/open-installers.sh"

cat > "$DESKTOP_DIR/Steam.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Steam
Comment=Open Steam for QR login and Jackbox installs
Exec=$JACKBOX_DIR/start-steam.sh
Terminal=false
Categories=Game;
EOF

cat > "$DESKTOP_DIR/Install Jackbox Packs.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Install Jackbox Packs
Comment=Open Steam install prompts for configured Jackbox app IDs
Exec=$JACKBOX_DIR/open-installers.sh
Terminal=false
Categories=Game;
EOF

if [ "${STEAM_AUTO_START:-true}" = "true" ]; then
  cp "$DESKTOP_DIR/Steam.desktop" "$AUTOSTART_DIR/Steam.desktop"
else
  rm -f "$AUTOSTART_DIR/Steam.desktop"
fi

chmod +x "$DESKTOP_DIR/Steam.desktop" "$DESKTOP_DIR/Install Jackbox Packs.desktop"
chown -R abc:abc "$JACKBOX_DIR" "$DESKTOP_DIR" "$AUTOSTART_DIR" /mnt/games
