# Jackbox in Discord

A deployable Discord bot plus Discord Activity wrapper for running Jackbox from a Dockerized Steam desktop.

The stack has two containers:

- `bot`: Node.js Discord bot, slash commands, Activity web app, and same-origin reverse proxy.
- `steam`: A custom LinuxServer XFCE Webtop image with Steam installed, mounted to persistent Docker volumes.

## What Works

- `/jackbox` creates a Discord Activity invite for a voice or stage channel.
- Slash commands register automatically on startup.
- Optional Activity password screen uses a normal Discord-friendly password box.
- The Activity loads a full browser Steam desktop at `/steam/`.
- Steam can be signed into with the normal QR-code flow.
- Installed games and Steam state persist in Docker volumes.
- Steam install tooling is baked into the custom image.
- After startup, the Steam container automatically retries Jackbox install URLs for the configured Steam app IDs. Once you sign into Steam with QR, Steam can accept the queued installs for every game your account owns.
- A desktop launcher is also available as `Install All Jackbox Games`.
- Coolify can deploy it directly from this repository with Docker Compose.

## Discord Setup

1. Create an app in the Discord Developer Portal.
2. Add a bot and copy the bot token.
3. Copy the application ID from General Information.
4. Enable/configure Activities for the app and set the Activity URL to your deployed HTTPS domain.
5. Invite the bot to your server with `bot` and `applications.commands` scopes. It needs `Create Instant Invite` in the voice channel.

Discord Activity invites require the application to be configured as an embedded Activity. The bot creates the invite using Discord's `target_type: 2` embedded application invite.

## Local Deploy

```bash
cp .env.example .env
# Fill in DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, and PUBLIC_ACTIVITY_URL.
docker compose up -d --build
```

Open:

- Activity/web app: `http://localhost:3000`
- Steam desktop through the proxy: `http://localhost:3000/steam/`
- Health check: `http://localhost:3000/healthz`

For quick slash-command registration while testing, set `DISCORD_GUILD_ID` in `.env`. If it is blank, commands are registered globally and can take a while to appear.

## Environment Variables

Everything commonly changed in Coolify is exposed through environment variables. Start from `.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | blank | Discord bot token. |
| `DISCORD_APPLICATION_ID` | blank | Discord app/client ID used for slash commands and Activity invites. |
| `DISCORD_GUILD_ID` | blank | Optional test server for instant command registration. |
| `PUBLIC_ACTIVITY_URL` | blank | Public HTTPS URL configured in Discord Activities. |
| `ACTIVITY_PASSWORD` | blank | Optional password users enter in the Activity before Steam loads. |
| `ACTIVITY_SESSION_SECRET` | blank | Optional signing secret for Activity password sessions. Defaults to the bot token or a runtime secret. |
| `ACTIVITY_SESSION_TTL_SECONDS` | `86400` | How long the Activity password session lasts. |
| `ACTIVITY_COOKIE_SECURE` | `true` | Keep session cookies HTTPS-only. Set `false` only for local HTTP testing. |
| `INVITE_MAX_AGE_SECONDS` | `86400` | Activity invite lifetime. Use `0` for no expiry. |
| `BOT_IMAGE` | `jackbox-in-discord-bot:latest` | Built bot image name. |
| `BOT_CONTAINER_NAME` | `jackbox-discord-bot` | Bot container name. |
| `BOT_PORT` | `3000` | Port the Node app listens on inside the container. |
| `PUBLIC_HTTP_PORT` | `3000` | Host port for local Compose. Coolify usually manages this. |
| `STEAM_INTERNAL_URL` | `http://steam:3000` | Internal URL the bot uses to reach Steam. |
| `STEAM_PROXY_PREFIX` | `/steam/` | Public proxy path. This also becomes Steam's `SUBFOLDER`; keep the leading and trailing slash. |
| `STEAM_IMAGE` | `jackbox-steam-webtop:latest` | Built Steam/Webtop image name. The compose service builds `steam/Dockerfile`. |
| `STEAM_CONTAINER_NAME` | `jackbox-steam` | Steam container name. |
| `STEAM_TITLE` | `Jackbox Steam` | Browser/desktop title. |
| `STEAM_INTERNAL_PORT` | `3000` | Steam HTTP port inside the container. If changed, update `STEAM_INTERNAL_URL` too. |
| `STEAM_INTERNAL_HTTPS_PORT` | `3001` | Steam HTTPS port inside the container. |
| `STEAM_SHM_SIZE` | `2gb` | Shared memory size for the Steam desktop. |
| `STREAM_WIDTH` / `STREAM_HEIGHT` | `1920` / `1080` | Default stream resolution. |
| `STREAM_FRAMERATE` | `60` | Default stream frame rate. |
| `SELKIES_AUDIO_ENABLED` | `true` | Browser audio streaming. |
| `SELKIES_GAMEPAD_ENABLED` | `true` | Browser gamepad support. |
| `SELKIES_CLIPBOARD_ENABLED` | `true` | Browser clipboard sync. |
| `PIXELFLUX_WAYLAND` / `AUTO_GPU` | `false` / `false` | Enable through the GPU override files on compatible hosts. |
| `DISABLE_DRI3` / `DISABLE_ZINK` | `true` / `true` | Keep older or no-GPU VPS hosts on software rendering. |
| `MAX_RES` | `1920x1080` | Clamp the X11 virtual framebuffer for compatibility and lower memory use. |
| `SELKIES_ENCODER` / `SELKIES_USE_CPU` | `x264enc,jpeg` / `true` | Force software encoders for hosts without AVX2. |
| `STEAM_AUTO_START` | `true` | Auto-launch Steam when the XFCE desktop starts. |
| `STEAM_START_DELAY_SECONDS` | `12` | Delay before auto-launching Steam, giving the desktop time to settle. |
| `STEAM_ARGS` | `-silent` | Arguments passed to the Steam launcher. |
| `STEAM_LIBRARY_PATH` | `/mnt/games/SteamLibrary` | Persistent Steam library folder created in the `steam-games` volume. |
| `STEAM_INSTALL_URL_DELAY_SECONDS` | `3` | Delay between each queued Steam install URL. |
| `AUTO_INSTALL_JACKBOX_APPS` | `true` | Automatically queue configured Jackbox installs after startup. |
| `AUTO_OPEN_JACKBOX_INSTALLERS` | `true` | Backward-compatible alias for the auto installer. |
| `AUTO_INSTALL_DELAY_SECONDS` | `60` | Delay before auto-queueing Jackbox installs. Gives the desktop and QR login screen time to settle. |
| `AUTO_INSTALL_RETRY_ATTEMPTS` | `30` | Number of startup retry passes. Useful because Steam must be signed in before it can accept paid game installs. |
| `AUTO_INSTALL_RETRY_SECONDS` | `60` | Delay between retry passes. |
| `STEAM_APP_IDS` | Jackbox pack list | Steam app IDs used by the auto installer and desktop launcher. |
| `TZ`, `PUID`, `PGID` | `America/New_York`, `1000`, `1000` | LinuxServer container timezone and file ownership. |

## GPU Acceleration

CPU rendering is the default because it boots on the widest range of VPS hosts.

For Intel/AMD GPU hosts:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

For Nvidia hosts, install/configure the Nvidia container runtime on the host first, then use:

```bash
docker compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d --build
```

## Installing Jackbox

Steam and `steamcmd` are installed in the custom image. The paid Jackbox game files cannot be baked into the image unless a Steam account that owns them is authenticated, so the container queues installs after QR login instead.

After the Steam desktop opens:

1. Sign into Steam with the QR code.
2. Leave `AUTO_INSTALL_JACKBOX_APPS=true` and the container will retry the configured install URLs automatically.
3. If you want to trigger it manually, open the `Install All Jackbox Games` launcher on the desktop.
4. Steam downloads the apps your account owns, and skips or prompts for apps you do not own.

The default app list is Party Pack 1-11 plus The Jackbox Party Starter:

```text
331670 397460 434170 610180 774461 1005300 1211630 1552350 1755580 1850960 2216830 3364070
```

Override it with `STEAM_APP_IDS` in `.env`.

## Persistence

The Compose file creates:

- `steam-config` mounted at `/config`
- `steam-games` mounted at `/mnt/games`

The custom Steam Webtop stores the Steam home directory under `/config`, so normal Steam login state persists. It also creates `/mnt/games/SteamLibrary` in the `steam-games` volume and registers it as a Steam library folder for game downloads.

## Security Notes

The Steam web desktop can control a real Linux desktop in the container. Keep the public URL private, use HTTPS, and consider adding reverse-proxy auth if you expose it outside a trusted group.

Use `ACTIVITY_PASSWORD` if you want Discord users to enter a password before the Steam desktop loads. This is rendered as a normal text box inside the Activity instead of a browser auth prompt. The Steam container itself is left without HTTP basic auth so Discord can render the Activity cleanly.

## Coolify

Use the prompt in [docs/coolify-chatgpt-prompt.md](docs/coolify-chatgpt-prompt.md) if you want another assistant to walk through the VPS/Coolify setup.
