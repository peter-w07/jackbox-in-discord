# Prompt for ChatGPT/Coolify Setup

Copy this prompt into ChatGPT when you want it to help operate a Coolify VPS.

```text
You are helping me deploy my GitHub repo peter-w07/jackbox-in-discord to my Coolify VPS.

Goal:
- Deploy the repository from the main branch with Docker Compose.
- Serve the Node bot/web Activity publicly over HTTPS.
- Keep the Steam container internal behind the Node app's /steam/ reverse proxy.
- Create persistent Docker volumes for Steam config and games.
- Configure Discord so /jackbox creates an Activity invite that opens the Steam desktop.
- After I scan the Steam QR login code, help me queue Jackbox downloads with the desktop "Install Jackbox Packs" launcher.

Repository:
https://github.com/peter-w07/jackbox-in-discord

Before touching Coolify, ask me for the environment variables below. Treat required values as blockers and optional values as defaults I can override.

Required:
- DISCORD_BOT_TOKEN: ask me for my Discord bot token.
- DISCORD_APPLICATION_ID: ask me for my Discord application/client ID.
- PUBLIC_ACTIVITY_URL: ask me for the public HTTPS domain Coolify should serve, such as https://jackbox.example.com.
- ACTIVITY_PASSWORD: ask me for the password Discord users should enter in the Activity before Steam loads. Leave blank only if I explicitly want no Activity password.

Strongly recommended:
- DISCORD_GUILD_ID: ask whether I want instant slash-command registration in one server. If not, leave blank for global commands.
- STEAM_APP_IDS: ask which Steam app IDs to install. Offer this default list for Jackbox Party Pack 1-11 plus Party Starter:
  331670 397460 434170 610180 774461 1005300 1211630 1552350 1755580 1850960 2216830 3364070

Optional, ask whether I want to change these from defaults:
- BOT_IMAGE=jackbox-in-discord-bot:latest
- BOT_CONTAINER_NAME=jackbox-discord-bot
- BOT_PORT=3000
- PUBLIC_HTTP_PORT=3000
- STEAM_INTERNAL_URL=http://steam:3000
- STEAM_PROXY_PREFIX=/steam/
- INVITE_MAX_AGE_SECONDS=86400
- STEAM_IMAGE=jackbox-steam-webtop:latest
- STEAM_CONTAINER_NAME=jackbox-steam
- STEAM_TITLE=Jackbox Steam
- STEAM_INTERNAL_PORT=3000
- STEAM_INTERNAL_HTTPS_PORT=3001
- TZ=America/New_York
- PUID=1000
- PGID=1000
- STEAM_SHM_SIZE=2gb
- STREAM_WIDTH=1920
- STREAM_HEIGHT=1080
- STREAM_FRAMERATE=60
- SELKIES_AUDIO_ENABLED=true
- SELKIES_GAMEPAD_ENABLED=true
- SELKIES_CLIPBOARD_ENABLED=true
- PIXELFLUX_WAYLAND=false
- AUTO_GPU=false
- DISABLE_DRI3=true
- DISABLE_ZINK=true
- MAX_RES=1920x1080
- SELKIES_ENCODER=x264enc,jpeg
- SELKIES_USE_CPU=true
- START_DOCKER=false
- ACTIVITY_SESSION_SECRET blank by default
- ACTIVITY_SESSION_TTL_SECONDS=86400
- ACTIVITY_COOKIE_SECURE=true
- STEAM_AUTO_START=true
- STEAM_START_DELAY_SECONDS=12
- STEAM_ARGS=-silent
- AUTO_OPEN_JACKBOX_INSTALLERS=false
- AUTO_INSTALL_DELAY_SECONDS=90

Use these Coolify steps:
1. Create a new Coolify resource from the GitHub repo peter-w07/jackbox-in-discord.
2. Choose Docker Compose deployment from docker-compose.yml.
3. Set the public domain to my PUBLIC_ACTIVITY_URL and route it to the bot service on BOT_PORT.
4. Do not publicly expose the steam service directly. It should only be reached through the bot service at /steam/.
5. Add persistent volumes exactly as defined by Compose: steam-config and steam-games.
6. Add all required environment variables I provided, plus any optional overrides I chose. For optional values I did not change, either omit them or set the defaults above.
7. Deploy and watch logs until both jackbox-discord-bot and jackbox-steam are healthy. The Steam service builds from steam/Dockerfile, based on linuxserver/webtop:ubuntu-xfce with Steam installed.
8. Visit PUBLIC_ACTIVITY_URL + /healthz and confirm it returns ok.
9. In Discord Developer Portal, set the Activity URL for this app to PUBLIC_ACTIVITY_URL. Make sure the bot is invited with bot and applications.commands scopes and Create Instant Invite permission.
10. In Discord, join a voice channel and run /jackbox. Open the invite.
11. In the Activity, open the Steam desktop, scan the Steam QR code with my Steam mobile app, then wait for me to confirm I am signed in.
12. After I confirm Steam is signed in, open the desktop launcher named "Install Jackbox Packs". Confirm the install prompts for the games my Steam account owns.

Important constraints:
- Never ask me to paste my Steam password. Use the QR-code login only.
- Prefer ACTIVITY_PASSWORD over browser basic auth so Discord users see a normal in-app password box.
- Do not enable browser basic auth on the Steam container; it creates a native browser prompt that may not render correctly in Discord.
- If the VPS has Intel/AMD GPU access, redeploy with docker-compose.gpu.yml as an override. If it has Nvidia, verify the Nvidia container runtime first, then use docker-compose.nvidia.yml.
- If STEAM_PROXY_PREFIX changes, keep the leading/trailing slash and make sure the Steam service SUBFOLDER and bot STEAM_PROXY_PREFIX match.
- If STEAM_INTERNAL_PORT changes, update STEAM_INTERNAL_URL so the bot points at the same port.
- If the Activity opens but Steam does not load, check that the steam service has SUBFOLDER matching STEAM_PROXY_PREFIX and that the bot service can reach STEAM_INTERNAL_URL.
```
