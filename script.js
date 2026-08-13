document.getElementById('year').textContent = new Date().getFullYear();

const presenceElement = document.querySelector('[data-presence]');
const presenceLabel = document.querySelector('[data-presence-label]');
const onlineCount = document.querySelector('#online-count');
const inGameCount = document.querySelector('#in-game-count');
const presenceRetry = document.querySelector('[data-presence-retry]');

async function updatePresence() {
  presenceElement.setAttribute('aria-busy', 'true');
  presenceLabel.textContent = 'CONNECTING TO BATTLEFIELD';
  presenceRetry.hidden = true;

  try {
    const response = await fetch('https://api.battlecities.com/api/presence', {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Presence request failed: ${response.status}`);
    }

    const presence = await response.json();
    onlineCount.textContent = Number.isFinite(presence.online) ? presence.online : '—';
    inGameCount.textContent = Number.isFinite(presence.inGame) ? presence.inGame : '—';
    presenceLabel.textContent = 'BATTLE CITIES LIVE';
  } catch {
    onlineCount.textContent = '—';
    inGameCount.textContent = '—';
    presenceLabel.textContent = 'PRESENCE UNAVAILABLE';
    presenceRetry.hidden = false;
  } finally {
    presenceElement.setAttribute('aria-busy', 'false');
  }
}

presenceRetry.addEventListener('click', updatePresence);
updatePresence();
setInterval(updatePresence, 30000);
