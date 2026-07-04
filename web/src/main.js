import { DiscordSDK } from '@discord/embedded-app-sdk';
import './style.css';

const config = window.JACKBOX_CONFIG || {};
const steamPath = config.steamPath || '/steam/';
const frame = document.querySelector('#steamFrame');
const openSteam = document.querySelector('#openSteam');
const reloadSteam = document.querySelector('#reloadSteam');
const discordStatus = document.querySelector('#discordStatus');

frame.src = steamPath;
openSteam.href = steamPath;

reloadSteam.addEventListener('click', () => {
  frame.src = steamPath;
});

bootDiscordSdk();

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
