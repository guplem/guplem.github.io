// A link: one two-way pipe of JSON messages between two pages.
//
// The session layer (session.js) talks only to this shape, never to WebRTC,
// so it can be tested with an in-memory pair, and a later transport (a
// relay, a public signalling server) can take WebRTC's place without the
// session or any game noticing.
//
//   link.send(object)        -> false once the link is closed
//   link.listen({ message, status }) -> a function that stops listening
//   link.status              "live" | "quiet" | "closed"
//   link.close()
//
// "quiet" is not "closed". A phone that locks its screen or switches to
// the chat app stops answering for a while, and its data channel often
// survives. Closing on silence would force a fresh pairing, which costs
// the players two QR codes; marking the peer quiet costs nothing, and it
// turns live again the moment it speaks.

const BEAT = "~";

const realTimers = {
  now: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
};

/**
 * Wraps an open RTCDataChannel (or anything with its shape) as a link.
 *
 * @param {{ send(text: string): void, close(): void, readyState: string,
 *           onmessage: Function | null, onclose: Function | null }} channel
 * @param {{ timers?: object, beatMs?: number, quietMs?: number }} [options]
 *   `beatMs` is how often an idle link says it is still there; `quietMs` is
 *   how long without a word before the other side counts as quiet.
 * @returns {object} A link.
 */
export function wrapChannel(channel, { timers = realTimers, beatMs = 2000, quietMs = 7000 } = {}) {
  const emitter = makeEmitter();
  let status = "live";
  let lastHeard = timers.now();

  const setStatus = (next) => {
    if (status === next || status === "closed") return;
    status = next;
    emitter.status(next);
  };

  const beat = timers.setInterval(() => {
    if (status === "closed") return;
    rawSend({ [BEAT]: 1 });
    if (timers.now() - lastHeard > quietMs) setStatus("quiet");
  }, beatMs);

  const rawSend = (obj) => {
    if (status === "closed" || channel.readyState !== "open") return false;
    try {
      channel.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  };

  const shutDown = () => {
    if (status === "closed") return;
    timers.clearInterval(beat);
    setStatus("closed");
  };

  channel.onmessage = (event) => {
    lastHeard = timers.now();
    setStatus("live");
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message && typeof message === "object" && message[BEAT] !== 1) emitter.message(message);
  };
  channel.onclose = shutDown;

  return {
    get status() {
      return status;
    },
    send: rawSend,
    listen: emitter.listen,
    close() {
      shutDown();
      try {
        channel.close();
      } catch {
        /* already gone */
      }
    },
  };
}

/**
 * Two links joined to each other in memory. Messages arrive on the next
 * microtask, never inside the sender's call, and as copies, so a test sees
 * the same ordering and isolation a real network gives.
 *
 * @returns {[object, object]}
 */
export function loopbackPair() {
  const ends = [makeLoopEnd(), makeLoopEnd()];
  ends[0].peer = ends[1];
  ends[1].peer = ends[0];
  return ends.map((end) => end.link);
}

function makeLoopEnd() {
  const emitter = makeEmitter();
  const end = { peer: null, status: "live" };
  const shut = () => {
    if (end.status === "closed") return;
    end.status = "closed";
    emitter.status("closed");
  };
  end.shut = shut;
  end.deliver = (message) => {
    if (end.status !== "closed") emitter.message(message);
  };
  end.link = {
    get status() {
      return end.status;
    },
    send(obj) {
      if (end.status === "closed") return false;
      const copy = JSON.parse(JSON.stringify(obj));
      queueMicrotask(() => end.peer.deliver(copy));
      return true;
    },
    listen: emitter.listen,
    close() {
      shut();
      queueMicrotask(() => end.peer.shut());
    },
  };
  return end;
}

function makeEmitter() {
  const listeners = new Set();
  return {
    listen(handlers) {
      listeners.add(handlers);
      return () => listeners.delete(handlers);
    },
    message(m) {
      [...listeners].forEach((h) => h.message?.(m));
    },
    status(s) {
      [...listeners].forEach((h) => h.status?.(s));
    },
  };
}
