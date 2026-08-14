document.getElementById('year').textContent = new Date().getFullYear();

/*
DEPLOYMENT SEQUENCE
[  0ms] Tactical shutters close over the site.
[180ms] Deployment clearance appears.
[900ms] Player enters the live battlefield.
*/
const DEPLOYMENT_TIMING = {
  redirectDelay: 900,
};

const playButton = document.querySelector('.play-button');
const deploymentOverlay = document.querySelector('[data-deployment-overlay]');

playButton?.addEventListener('click', (event) => {
  if (
    !deploymentOverlay ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  event.preventDefault();
  if (document.body.classList.contains('is-deploying')) {
    return;
  }

  document.body.classList.add('is-deploying');
  deploymentOverlay.classList.add('is-active');
  window.setTimeout(() => {
    window.location.assign(playButton.href);
  }, DEPLOYMENT_TIMING.redirectDelay);
});

const presenceElement = document.querySelector('[data-presence]');
const presenceLabel = document.querySelector('[data-presence-label]');
const onlineCount = document.querySelector('#online-count');
const inGameCount = document.querySelector('#in-game-count');
const presenceRetry = document.querySelector('[data-presence-retry]');
const presenceClientId = getPresenceClientId();

function getPresenceClientId() {
  const storageKey = 'battlecities.presence.client';
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing && /^[a-z0-9-]{6,80}$/i.test(existing)) {
      return existing;
    }
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const generated = `site-${Array.from(bytes, (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('')}`;
    sessionStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `site-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

async function updatePresence() {
  presenceElement.setAttribute('aria-busy', 'true');
  presenceLabel.textContent = 'CONNECTING TO BATTLEFIELD';
  presenceRetry.hidden = true;

  try {
    const response = await fetch('https://api.battlecities.com/api/presence', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: presenceClientId, inGame: false }),
    });

    if (!response.ok) {
      throw new Error(`Presence request failed: ${response.status}`);
    }

    const presence = await response.json();
    onlineCount.textContent = Number.isFinite(presence.online)
      ? presence.online
      : '—';
    inGameCount.textContent = Number.isFinite(presence.inGame)
      ? presence.inGame
      : '—';
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

window.addEventListener('pagehide', () => {
  void fetch(
    `https://api.battlecities.com/api/presence?clientId=${encodeURIComponent(presenceClientId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      keepalive: true,
    },
  );
});
