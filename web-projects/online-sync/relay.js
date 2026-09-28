// Carries an answer from the tab it was opened in to the tab that holds
// the table.
//
// The fastest pairing needs no typing: the guest's phone shows the answer
// as a QR code, the host points the phone's own camera app at it, and the
// camera opens the answer link. But it opens it in a NEW tab, and the
// invitation that must read the answer lives in the host's OLD tab. Both
// tabs share an origin, so this file passes the code across twice:
//
//   BroadcastChannel   instant, when the table tab is awake
//   localStorage       kept ten minutes, for a table tab the phone put to
//                      sleep; read when it wakes (visibilitychange, focus)
//
// It only works when the camera opens links in the same browser the host
// plays in. Pasting the code by hand stays the fallback, and the page
// always offers it.

const KEEP_MS = 10 * 60 * 1000;
const channelName = (app) => `online-sync.${app}`;
const storageKey = (app) => `online-sync.${app}.answers`;

const defaultChannel = typeof BroadcastChannel === "function" ? (name) => new BroadcastChannel(name) : null;
const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Sends an answer code to every other tab of this app in this browser.
 *
 * @param {{ app: string, code: string, channelFactory?: Function | null,
 *           storage?: Storage | null, now?: () => number }} options
 * @returns {boolean} True when at least one of the two ways worked.
 */
export function relayAnswer({ app, code, channelFactory = defaultChannel, storage = defaultStorage(), now = Date.now }) {
  let sent = false;
  try {
    const kept = readKept(storage, app, now).filter((entry) => entry.code !== code);
    kept.push({ code, at: now() });
    storage.setItem(storageKey(app), JSON.stringify(kept.slice(-10)));
    sent = true;
  } catch {
    /* private mode or blocked storage: the channel may still work */
  }
  try {
    const channel = channelFactory(channelName(app));
    channel.postMessage({ code });
    channel.close();
    sent = true;
  } catch {
    /* no BroadcastChannel in this browser */
  }
  return sent;
}

/**
 * Hands every answer this app receives, from either way, to `onAnswer`,
 * once each. Answers already waiting in storage are handed over at once.
 *
 * @param {{ app: string, onAnswer: (code: string) => void,
 *           channelFactory?: Function | null, storage?: Storage | null,
 *           target?: EventTarget, now?: () => number }} options
 * @returns {() => void} Stops listening.
 */
export function listenForAnswers({
  app,
  onAnswer,
  channelFactory = defaultChannel,
  storage = defaultStorage(),
  target = globalThis,
  now = Date.now,
}) {
  const seen = new Set();
  const hand = (code) => {
    if (typeof code !== "string" || seen.has(code)) return;
    seen.add(code);
    onAnswer(code);
  };
  const scan = () => readKept(storage, app, now).forEach((entry) => hand(entry.code));

  let channel = null;
  try {
    channel = channelFactory(channelName(app));
    channel.onmessage = (event) => hand(event.data?.code);
  } catch {
    channel = null;
  }

  const onStorage = (event) => {
    if (!event || event.key === storageKey(app)) scan();
  };
  target.addEventListener?.("storage", onStorage);
  target.addEventListener?.("visibilitychange", scan);
  target.addEventListener?.("focus", scan);
  scan();

  return () => {
    try {
      channel?.close();
    } catch {
      /* already closed */
    }
    target.removeEventListener?.("storage", onStorage);
    target.removeEventListener?.("visibilitychange", scan);
    target.removeEventListener?.("focus", scan);
  };
}

function readKept(storage, app, now) {
  try {
    const list = JSON.parse(storage.getItem(storageKey(app)) ?? "[]");
    return Array.isArray(list) ? list.filter((entry) => entry && now() - entry.at < KEEP_MS) : [];
  } catch {
    return [];
  }
}
