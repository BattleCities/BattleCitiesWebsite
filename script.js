document.getElementById('year').textContent = new Date().getFullYear();

/*
DEPLOYMENT SEQUENCE
[   0ms] Elevator doors begin closing from both sides.
[ 324ms] Doors seal and the battlefield readout appears.
[ 778ms] Readout completes while the doors remain closed.
[1080ms] Doors reopen and the player enters the live battlefield.
*/
const DEPLOYMENT_TIMING = {
  redirectDelay: 1080,
};

const DEPLOYMENT_SOUND = {
  masterGain: 0.82,
  rumbleDuration: 0.78,
  motorDuration: 0.85,
};

const playButton = document.querySelector('.play-button');
const deploymentOverlay = document.querySelector('[data-deployment-overlay]');

function playDeploymentSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = DEPLOYMENT_SOUND.masterGain;
  master.connect(context.destination);

  const tone = (frequency, duration, gain, delay = 0, endFrequency = frequency) => {
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      start + duration,
    );
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.006);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume);
    volume.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  };

  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  const noiseBuffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * DEPLOYMENT_SOUND.rumbleDuration),
    context.sampleRate,
  );
  const noiseData = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseData.length; index += 1) {
    noiseData[index] = Math.random() * 2 - 1;
  }
  noise.buffer = noiseBuffer;
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 260;
  noiseFilter.Q.value = 0.8;
  noiseGain.gain.setValueAtTime(0.0001, context.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.11, context.currentTime + 0.004);
  noiseGain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + DEPLOYMENT_SOUND.rumbleDuration,
  );
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start();
  noise.stop(context.currentTime + DEPLOYMENT_SOUND.rumbleDuration + 0.02);

  tone(190, DEPLOYMENT_SOUND.motorDuration, 0.2, 0, 48);
  [840, 730, 620].forEach((frequency, index) => {
    tone(frequency, 0.075, 0.095, index * 0.22);
  });
}

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
  playButton.setAttribute('aria-disabled', 'true');
  deploymentOverlay.classList.add('is-active');
  deploymentOverlay.setAttribute('aria-hidden', 'false');
  playDeploymentSound();
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
    const liveUsersEnabled = presence.liveUsersEnabled === true;
    presenceElement.hidden = !liveUsersEnabled;
    if (!liveUsersEnabled) {
      return;
    }
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
