import { DiscordSDK } from '@discord/embedded-app-sdk';
import './style.css';

const config = window.JACKBOX_CONFIG || {};
const steamPath = config.steamPath || '/steam/';
const frame = document.querySelector('#steamFrame');
const openSteam = document.querySelector('#openSteam');
const reloadSteam = document.querySelector('#reloadSteam');
const discordStatus = document.querySelector('#discordStatus');
const authGate = document.querySelector('#authGate');
const authForm = document.querySelector('#authForm');
const activityPassword = document.querySelector('#activityPassword');
const authMessage = document.querySelector('#authMessage');
const unlockSteam = document.querySelector('#unlockSteam');

let steamUnlocked = false;

openSteam.href = steamPath;

reloadSteam.addEventListener('click', () => {
  if (steamUnlocked) {
    loadSteam(true);
    return;
  }

  showAuthMessage('Enter the Activity password first.');
  activityPassword.focus();
});

openSteam.addEventListener('click', (event) => {
  if (steamUnlocked) {
    return;
  }

  event.preventDefault();
  showAuthMessage('Enter the Activity password first.');
  activityPassword.focus();
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  unlockSteam.disabled = true;
  showAuthMessage('Checking password...');

  try {
    const response = await fetch('/api/activity-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: activityPassword.value })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      showAuthMessage(result.error || 'Incorrect password.');
      activityPassword.select();
      return;
    }

    unlockSteamView();
  } catch (error) {
    console.warn('Activity unlock failed:', error);
    showAuthMessage('Could not unlock Steam. Try again.');
  } finally {
    unlockSteam.disabled = false;
  }
});

bootActivityAuth();
bootDiscordSdk();

async function bootActivityAuth() {
  try {
    const response = await fetch('/api/activity-auth', { cache: 'no-store' });
    const auth = await response.json();

    if (!auth.required || auth.authenticated) {
      unlockSteamView();
      return;
    }

    lockSteamView();
  } catch (error) {
    console.warn('Activity auth check failed:', error);
    lockSteamView('Could not check password state.');
  }
}

async function bootDiscordSdk() {
  if (!config.discordApplicationId) {
    setStatus('Web');
    return;
  }

  try {
    const sdk = new DiscordSDK(config.discordApplicationId);
    await sdk.ready();
    setStatus('Discord');
  } catch (error) {
    console.warn('Discord Embedded App SDK did not initialize:', error);
    setStatus('Web');
  }
}

function setStatus(value) {
  discordStatus.textContent = value;
}

function lockSteamView(message = '') {
  steamUnlocked = false;
  authGate.hidden = false;
  frame.removeAttribute('src');
  showAuthMessage(message);
  activityPassword.focus();
}

function unlockSteamView() {
  steamUnlocked = true;
  authGate.hidden = true;
  showAuthMessage('');
  loadSteam();
}

function loadSteam(forceReload = false) {
  if (forceReload) {
    frame.src = 'about:blank';
    window.setTimeout(() => {
      frame.src = steamPath;
    }, 50);
    return;
  }

  if (frame.getAttribute('src') !== steamPath) {
    frame.src = steamPath;
  }
}

function showAuthMessage(message) {
  authMessage.textContent = message;
}
