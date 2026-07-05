#!/usr/bin/env bash
set -euo pipefail

APP_IDS="${STEAM_APP_IDS:-331670 397460 434170 610180 774461 1005300 1211630 1552350 1755580 1850960 2216830 3364070}"
JACKBOX_DIR="/config/jackbox"
DESKTOP_DIR="/config/Desktop"
AUTOSTART_DIR="/config/.config/autostart"
STEAM_ROOT="${STEAM_ROOT:-/config/.local/share/Steam}"
STEAM_LIBRARY_PATH="${STEAM_LIBRARY_PATH:-/mnt/games/SteamLibrary}"
STEAM_START_DELAY_SECONDS="${STEAM_START_DELAY_SECONDS:-12}"
STEAM_ARGS="${STEAM_ARGS:--silent}"
STEAM_INSTALL_URL_DELAY_SECONDS="${STEAM_INSTALL_URL_DELAY_SECONDS:-3}"

mkdir -p \
  "$JACKBOX_DIR" \
  "$DESKTOP_DIR" \
  "$AUTOSTART_DIR" \
  "$STEAM_ROOT/steamapps" \
  "$STEAM_LIBRARY_PATH/steamapps/common"

if [ ! -e /config/.steam/steam ]; then
  mkdir -p /config/.steam
  ln -s "$STEAM_ROOT" /config/.steam/steam
fi

if [ ! -f "$STEAM_ROOT/steamapps/libraryfolders.vdf" ]; then
  cat > "$STEAM_ROOT/steamapps/libraryfolders.vdf" <<EOF
"libraryfolders"
{
	"0"
	{
		"path"		"$STEAM_ROOT"
		"label"		"Steam"
		"contentid"		"0"
		"totalsize"		"0"
		"update_clean_bytes_tally"		"0"
		"time_last_update_corruption"		"0"
		"apps"
		{
		}
	}
	"1"
	{
		"path"		"$STEAM_LIBRARY_PATH"
		"label"		"Jackbox"
		"contentid"		"0"
		"totalsize"		"0"
		"update_clean_bytes_tally"		"0"
		"time_last_update_corruption"		"0"
		"apps"
		{
		}
	}
}
EOF
fi

cat > "$JACKBOX_DIR/apps.env" <<EOF
STEAM_APP_IDS="$APP_IDS"
STEAM_ARGS="$STEAM_ARGS"
STEAM_START_DELAY_SECONDS="$STEAM_START_DELAY_SECONDS"
STEAM_INSTALL_URL_DELAY_SECONDS="$STEAM_INSTALL_URL_DELAY_SECONDS"
STEAM_LIBRARY_PATH="$STEAM_LIBRARY_PATH"
STEAM_ROOT="$STEAM_ROOT"
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
STEAM_ROOT="${STEAM_ROOT:-/config/.local/share/Steam}"
STEAM_LIBRARY_PATH="${STEAM_LIBRARY_PATH:-/mnt/games/SteamLibrary}"
STEAM_INSTALL_URL_DELAY_SECONDS="${STEAM_INSTALL_URL_DELAY_SECONDS:-3}"
export DISPLAY="${DISPLAY:-:1}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-abc}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR" || true

steam_app_manifest_exists() {
  local app_id="$1"
  local manifest

  for manifest in \
    "$STEAM_ROOT/steamapps/appmanifest_${app_id}.acf" \
    "/config/.steam/steam/steamapps/appmanifest_${app_id}.acf" \
    "$STEAM_LIBRARY_PATH/steamapps/appmanifest_${app_id}.acf"; do
    if [ -f "$manifest" ]; then
      return 0
    fi
  done

  return 1
}

open_steam_install_url() {
  local app_id="$1"
  local url="steam://install/${app_id}"

  if command -v steam >/dev/null 2>&1; then
    steam "$url" >/dev/null 2>&1 &
    return 0
  fi

  xdg-open "$url" >/dev/null 2>&1 || true
}

{
  echo "Opening Steam install URLs at $(date -Is)"

  for app_id in $APP_IDS; do
    if steam_app_manifest_exists "$app_id"; then
      echo "Skipping ${app_id}; Steam already has an app manifest."
      continue
    fi

    echo "Queueing steam://install/${app_id}"
    open_steam_install_url "$app_id"
    sleep "$STEAM_INSTALL_URL_DELAY_SECONDS"
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
Name=Install All Jackbox Games
Comment=Queue Steam installs for all configured Jackbox app IDs
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
chown -R abc:abc "$JACKBOX_DIR" "$DESKTOP_DIR" "$AUTOSTART_DIR" "$STEAM_ROOT" "$STEAM_LIBRARY_PATH" /mnt/games
