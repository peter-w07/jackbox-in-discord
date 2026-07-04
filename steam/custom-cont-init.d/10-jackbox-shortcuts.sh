#!/usr/bin/env bash
set -euo pipefail

APP_IDS="${STEAM_APP_IDS:-331670 397460 434170 610180 774461 1005300 1211630 1552350 1755580 1850960 2216830 3364070}"
JACKBOX_DIR="/config/jackbox"
DESKTOP_DIR="/config/Desktop"

mkdir -p "$JACKBOX_DIR" "$DESKTOP_DIR"

cat > "$JACKBOX_DIR/apps.env" <<EOF
STEAM_APP_IDS="$APP_IDS"
EOF

cat > "$JACKBOX_DIR/open-installers.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [ -f /config/jackbox/apps.env ]; then
  # shellcheck disable=SC1091
  . /config/jackbox/apps.env
fi

APP_IDS="${STEAM_APP_IDS:-}"
LOG_FILE="/config/jackbox/install-queue.log"

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

cat > "$DESKTOP_DIR/Install Jackbox Packs.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Install Jackbox Packs
Comment=Open Steam install prompts for configured Jackbox app IDs
Exec=$JACKBOX_DIR/open-installers.sh
Terminal=false
Categories=Game;
EOF

chmod +x "$DESKTOP_DIR/Install Jackbox Packs.desktop"
chown -R abc:abc "$JACKBOX_DIR" "$DESKTOP_DIR"
