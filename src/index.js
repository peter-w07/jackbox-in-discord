import http from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  ChannelType,
  Client,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');

const env = readEnv();
const app = express();
const activitySessionSecret =
  env.activitySessionSecret || env.discordBotToken || randomBytes(32).toString('hex');
const activityAuthCookie = 'jackbox_activity_auth';

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '10kb' }));

const steamMount = env.steamProxyPrefix.replace(/\/$/, '');

app.get('/healthz', async (_req, res) => {
  const steam = await probeSteam();
  res.status(steam.ok ? 200 : 503).json({
    ok: steam.ok,
    service: 'jackbox-in-discord',
    steam
  });
});

app.get('/config.js', (_req, res) => {
  res.type('application/javascript').send(
    `window.JACKBOX_CONFIG = ${safeJson({
      discordApplicationId: env.discordApplicationId,
      activityPasswordRequired: Boolean(env.activityPassword),
      steamPath: env.steamProxyPrefix,
      publicActivityUrl: env.publicActivityUrl
    })};`
  );
});

app.get('/api/activity-auth', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    required: Boolean(env.activityPassword),
    authenticated: !env.activityPassword || isActivityAuthenticated(req)
  });
});

app.post('/api/activity-login', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!env.activityPassword) {
    res.json({ ok: true });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!secureEqual(password, env.activityPassword)) {
    res.status(401).json({ ok: false, error: 'Incorrect password.' });
    return;
  }

  setActivityCookie(res);
  res.json({ ok: true });
});

app.post('/api/activity-logout', (_req, res) => {
  clearActivityCookie(res);
  res.json({ ok: true });
});

app.use((req, res, next) => {
  if (!req.path.startsWith(steamMount)) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), geolocation=(), microphone=(self), fullscreen=(self), gamepad=(self), clipboard-read=(self), clipboard-write=(self)'
    );
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'self' https://*.discordsays.com https://discord.com https://*.discord.com",
        "frame-src 'self'",
        "connect-src 'self' https://discord.com https://*.discord.com wss:",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "object-src 'none'"
      ].join('; ')
    );
  }

  next();
});

app.use((req, res, next) => {
  if (!isSteamRequestPath(req.path) || !env.activityPassword) {
    next();
    return;
  }

  if (isActivityAuthenticated(req)) {
    next();
    return;
  }

  res.status(401);

  if (req.accepts('html')) {
    res
      .type('html')
      .send(
        '<!doctype html><title>Locked</title><body>Open the Activity and enter the password.</body>'
      );
    return;
  }

  res.json({ ok: false, error: 'Activity password required.' });
});

app.use((req, res, next) => {
  if (req.method === 'GET' && req.path === steamMount) {
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex === -1 ? '' : req.originalUrl.slice(queryIndex);
    res.redirect(301, `${env.steamProxyPrefix}${query}`);
    return;
  }

  next();
});

const steamProxy = createProxyMiddleware({
  pathFilter: (pathname) =>
    pathname === steamMount || pathname.startsWith(env.steamProxyPrefix),
  target: env.steamInternalUrl,
  changeOrigin: true,
  secure: false,
  ws: true,
  xfwd: true,
  logLevel: process.env.PROXY_LOG_LEVEL || 'warn',
  on: {
    proxyReq(proxyReq) {
      proxyReq.setHeader('X-Forwarded-Prefix', env.steamProxyPrefix);
    },
    error(error, _req, res) {
      const body = safeJson({
        ok: false,
        error: 'Steam desktop proxy is unavailable.',
        detail: error.message
      });

      if (res && typeof res.writeHead === 'function' && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
      }

      if (res && typeof res.end === 'function') {
        res.end(body);
      }
    }
  }
});

app.use(steamProxy);
app.use(express.static(distDir, { index: false }));

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    next();
    return;
  }

  res.sendFile(path.join(distDir, 'index.html'));
});

const server = http.createServer(app);

if (typeof steamProxy.upgrade === 'function') {
  server.on('upgrade', (req, socket, head) => {
    const pathname = parseRequestPath(req.url);

    if (
      isSteamRequestPath(pathname) &&
      env.activityPassword &&
      !isActivityAuthenticated(req)
    ) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    steamProxy.upgrade(req, socket, head);
  });
}

server.listen(env.port, () => {
  console.log(`Web and Activity server listening on port ${env.port}`);
  console.log(`Steam desktop proxy mounted at ${env.steamProxyPrefix}`);
});

let discordClient;

if (env.discordBotToken && env.discordApplicationId) {
  startDiscordBot().catch((error) => {
    console.error('Discord bot failed to start:', error);
    process.exitCode = 1;
  });
} else {
  console.warn(
    'DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID is missing; web Activity is running, but slash commands are disabled.'
  );
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function readEnv() {
  return {
    port: parseInteger(process.env.PORT || process.env.BOT_PORT, 3000),
    discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
    discordApplicationId:
      process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID || '',
    discordGuildId: process.env.DISCORD_GUILD_ID || '',
    publicActivityUrl: trimTrailingSlash(process.env.PUBLIC_ACTIVITY_URL || ''),
    activityPassword:
      process.env.ACTIVITY_PASSWORD || process.env.LEGACY_STEAM_WEB_PASSWORD || '',
    activitySessionSecret: process.env.ACTIVITY_SESSION_SECRET || '',
    activitySessionTtlSeconds: parseInteger(
      process.env.ACTIVITY_SESSION_TTL_SECONDS,
      86400
    ),
    activityCookieSecure: parseBoolean(
      process.env.ACTIVITY_COOKIE_SECURE,
      process.env.NODE_ENV === 'production'
    ),
    steamInternalUrl: trimTrailingSlash(
      process.env.STEAM_INTERNAL_URL || 'http://steam:3000'
    ),
    steamProxyPrefix: normalizePrefix(process.env.STEAM_PROXY_PREFIX || '/steam/'),
    inviteMaxAgeSeconds: parseInteger(process.env.INVITE_MAX_AGE_SECONDS, 86400)
  };
}

async function startDiscordBot() {
  await registerCommands();

  discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
  });

  discordClient.once('ready', (client) => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
  });

  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {
      if (interaction.commandName === 'jackbox') {
        await handleJackboxCommand(interaction);
        return;
      }

      if (interaction.commandName === 'steam') {
        await handleSteamCommand(interaction);
        return;
      }

      if (interaction.commandName === 'health') {
        await handleHealthCommand(interaction);
      }
    } catch (error) {
      console.error(`Command /${interaction.commandName} failed:`, error);
      const payload = {
        content: `I could not complete that command: ${error.message}`,
        flags: MessageFlags.Ephemeral
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  });

  await discordClient.login(env.discordBotToken);
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('jackbox')
      .setDescription('Create a Discord Activity invite for the Jackbox Steam desktop.')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('Voice or stage channel to launch the Activity in.')
          .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName('steam')
      .setDescription('Show the configured Steam Activity URLs.'),
    new SlashCommandBuilder()
      .setName('health')
      .setDescription('Check whether the bot and Steam desktop are reachable.')
  ].map((command) => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(env.discordBotToken);

  if (env.discordGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(env.discordApplicationId, env.discordGuildId),
      { body: commands }
    );
    console.log(`Registered slash commands in guild ${env.discordGuildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(env.discordApplicationId), {
    body: commands
  });
  console.log('Registered global slash commands');
}

async function handleJackboxCommand(interaction) {
  await interaction.deferReply();

  const channel = await resolveVoiceChannel(interaction);
  await assertInvitePermission(interaction, channel);

  const invite = await createActivityInvite(channel.id);
  const url = `https://discord.gg/${invite.code}`;
  const lines = [
    `Jackbox Activity invite for ${channel}: ${url}`,
    env.publicActivityUrl ? `Activity URL: ${env.publicActivityUrl}` : ''
  ].filter(Boolean);

  await interaction.editReply(lines.join('\n'));
}

async function handleSteamCommand(interaction) {
  const activityUrl = env.publicActivityUrl || 'Set PUBLIC_ACTIVITY_URL first.';
  const steamUrl = env.publicActivityUrl
    ? `${env.publicActivityUrl}${env.steamProxyPrefix}`
    : env.steamProxyPrefix;

  await interaction.reply({
    content: [`Activity: ${activityUrl}`, `Steam desktop: ${steamUrl}`].join('\n'),
    flags: MessageFlags.Ephemeral
  });
}

async function handleHealthCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const steam = await probeSteam();
  const status = steam.ok ? 'ok' : 'not reachable';

  await interaction.editReply(
    [`Bot: ok`, `Steam desktop: ${status}`, `Proxy path: ${env.steamProxyPrefix}`].join(
      '\n'
    )
  );
}

async function resolveVoiceChannel(interaction) {
  const selected = interaction.options.getChannel('channel');

  if (selected) {
    return selected;
  }

  if (!interaction.guild) {
    throw new Error('Use this command in a server voice channel.');
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    throw new Error('Join a voice channel first, or pass a channel option.');
  }

  return voiceChannel;
}

async function assertInvitePermission(interaction, channel) {
  const me =
    interaction.guild.members.me || (await interaction.guild.members.fetchMe());
  const permissions = channel.permissionsFor(me);

  if (!permissions?.has(PermissionFlagsBits.CreateInstantInvite)) {
    throw new Error(`I need Create Instant Invite permission in ${channel.name}.`);
  }
}

async function createActivityInvite(channelId) {
  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/invites`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${env.discordBotToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        max_age: env.inviteMaxAgeSeconds,
        max_uses: 0,
        temporary: false,
        target_type: 2,
        target_application_id: env.discordApplicationId
      })
    }
  );

  const body = await response.text();
  const json = parseJson(body);

  if (!response.ok) {
    const message = json?.message || body || response.statusText;
    throw new Error(`Discord API ${response.status}: ${message}`);
  }

  return json;
}

async function probeSteam() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(env.steamInternalUrl, {
      method: 'GET',
      signal: controller.signal
    });

    return {
      ok: response.ok || response.status < 500,
      status: response.status
    };
  } catch (error) {
    return {
      ok: false,
      error: error.name === 'AbortError' ? 'timeout' : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePrefix(value) {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function isSteamRequestPath(pathname) {
  return pathname === steamMount || pathname.startsWith(env.steamProxyPrefix);
}

function parseRequestPath(url = '/') {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

function isActivityAuthenticated(req) {
  if (!env.activityPassword) {
    return true;
  }

  const token = parseCookies(req.headers.cookie || '')[activityAuthCookie];
  return verifyActivityToken(token);
}

function setActivityCookie(res) {
  res.cookie(activityAuthCookie, createActivityToken(), {
    httpOnly: true,
    maxAge: env.activitySessionTtlSeconds * 1000,
    sameSite: env.activityCookieSecure ? 'none' : 'lax',
    secure: env.activityCookieSecure
  });
}

function clearActivityCookie(res) {
  res.clearCookie(activityAuthCookie, {
    sameSite: env.activityCookieSecure ? 'none' : 'lax',
    secure: env.activityCookieSecure
  });
}

function createActivityToken() {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + env.activitySessionTtlSeconds * 1000
    })
  ).toString('base64url');

  return `${payload}.${signActivityPayload(payload)}`;
}

function verifyActivityToken(token) {
  if (!token || !token.includes('.')) {
    return false;
  }

  const [payload, signature] = token.split('.', 2);

  if (!secureEqual(signature, signActivityPayload(payload))) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(decoded.exp) && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function signActivityPayload(payload) {
  return createHmac('sha256', activitySessionSecret).update(payload).digest('base64url');
}

function parseCookies(header) {
  return header.split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');

    if (separator === -1) {
      return cookies;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (name) {
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
    }

    return cookies;
  }, {});
}

function secureEqual(value, expected) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(valueBuffer, expectedBuffer);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function shutdown() {
  console.log('Shutting down...');
  discordClient?.destroy();
  server.close(() => process.exit(0));
}
