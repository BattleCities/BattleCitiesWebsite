const CHERRY_APP_ID = '148185d2-9181-4e2f-9e4d-47e5b5c12f2a';
const CHERRY_ROOM_ID = 'ffd51288-710c-4558-83dc-d5fe9b04451d';
const CHERRY_EMBED_URL = 'https://embed.cherry.fun';
const API_ORIGIN = 'https://api.battlecities.com';

let activeWallet = null;
let walletConnection = null;
let chat = null;

function getPhantomProvider() {
  const provider = window.phantom?.solana;
  if (provider?.isPhantom !== true) {
    throw new Error('Phantom wallet is required to send chat messages.');
  }
  return provider;
}

function signatureToBase64(signature) {
  let binary = '';
  signature.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

async function apiFetch(path, options = {}) {
  return fetch(`${API_ORIGIN}${path}`, {
    credentials: 'include',
    ...options,
  });
}

async function createWalletChallenge(walletAddress) {
  const response = await apiFetch('/api/session', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });

  if (!response.ok) {
    throw new Error('Could not create the Battle Cities wallet challenge.');
  }

  return response.json();
}

async function startWalletSession(walletAddress, challenge, signature) {
  const response = await apiFetch('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'wallet',
      walletAddress,
      nonce: challenge.nonce,
      message: challenge.message,
      signature: signatureToBase64(signature),
    }),
  });

  if (!response.ok) {
    throw new Error('Could not authenticate the Battle Cities wallet session.');
  }
}

async function connectWallet() {
  if (activeWallet !== null) {
    return activeWallet;
  }
  if (walletConnection !== null) {
    return walletConnection;
  }

  walletConnection = (async () => {
    const provider = getPhantomProvider();
    const { publicKey } = await provider.connect();
    const walletAddress = publicKey.toString();
    const challenge = await createWalletChallenge(walletAddress);
    const signedMessage = await provider.signMessage(
      new TextEncoder().encode(challenge.message),
      'utf8',
    );
    const signature =
      signedMessage instanceof Uint8Array
        ? signedMessage
        : signedMessage.signature;

    if (!(signature instanceof Uint8Array) || signature.length !== 64) {
      throw new Error('Phantom returned an invalid signature.');
    }

    await startWalletSession(walletAddress, challenge, signature);
    activeWallet = { provider, walletAddress };
    return activeWallet;
  })();

  try {
    return await walletConnection;
  } finally {
    walletConnection = null;
  }
}

async function mintEmbedToken(walletAddress) {
  const response = await apiFetch('/api/cherry-embed-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });

  if (!response.ok) {
    throw new Error('Could not start the Cherry chat session.');
  }

  const { token } = await response.json();
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Cherry returned an invalid chat token.');
  }

  return token;
}

async function initializeChat() {
  const mountPoint = document.querySelector('#cherry-chat');
  const CherryEmbed = window.CherryEmbedSDK?.CherryEmbed;
  if (mountPoint === null || typeof CherryEmbed !== 'function') {
    throw new Error('Cherry chat SDK did not load.');
  }

  chat = new CherryEmbed({
    appId: CHERRY_APP_ID,
    embedUrl: CHERRY_EMBED_URL,
    container: mountPoint,
    roomId: CHERRY_ROOM_ID,
    mode: 'single',
    position: 'floating-right',
    collapsed: false,
    theme: { mode: 'dark', primaryColor: '#FFB30F' },
    signChallengeHandler: async (message) => {
      const { provider } = await connectWallet();
      const signedMessage = await provider.signMessage(message, 'utf8');
      const signature =
        signedMessage instanceof Uint8Array
          ? signedMessage
          : signedMessage.signature;

      if (!(signature instanceof Uint8Array) || signature.length !== 64) {
        throw new Error('Phantom returned an invalid signature.');
      }

      return signature;
    },
  });

  chat.on('walletConnectRequested', async () => {
    try {
      const { walletAddress } = await connectWallet();
      const token = await mintEmbedToken(walletAddress);
      chat.setToken(token);
      chat.setWalletAddress(walletAddress);
    } catch (error) {
      console.error('Cherry chat wallet connection failed.', error);
    }
  });

  chat.on('authStateChange', (authenticated) => {
    console.info('Cherry chat authenticated:', authenticated);
  });

  await chat.mount();
}

initializeChat().catch((error) => {
  console.error('Cherry chat could not be mounted.', error);
});
