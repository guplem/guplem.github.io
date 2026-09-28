// One table, one authority: the host holds the only true state.
//
// Every page at the table holds a copy of the state, but only the host ever
// changes it. A guest never edits its copy; it sends an intent ("roll",
// "move piece 3"), the host runs the game's own reducer on it, and sends
// the result to everybody with a version number. So two phones can never
// disagree about the board, and a game needs no merge rules: it writes one
// pure function, apply(state, intent, playerId), and the reducer is the
// whole referee.
//
// Messages, all JSON over a link (link.js):
//
//   guest -> host   hello   { protocol, app, player: { id, name }, v }
//                   intent  { i }
//                   restore { v, s }      only when the host asks for it
//   host -> guest   welcome { room, host: { id, name } }
//                   state   { v, s }
//                   peers   { list }
//                   refuse  { reason }    "app", "protocol", "id-in-use", or the game's own
//                   restore?              "you hold a newer board than I do"
//                   bye     { reason }    "removed", "host-left", or the game's own
//
// The sender of an intent is the link it came in on, never a field in the
// message, so a guest cannot act for somebody else.

export const PROTOCOL = 1;

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * Opens a table as its host.
 *
 * @param {object} options
 * @param {string} options.app - Must match the guests' app, so one game's
 *   invite cannot seat somebody at another game's table.
 * @param {string} options.room - The table's name, sent to every guest.
 * @param {{ id: string, name: string }} options.self - The host as a player.
 * @param {any} options.state - The starting state; any JSON value.
 * @param {number} [options.version] - The starting version (0 for a new table).
 * @param {(state: any, intent: any, playerId: string) => any} options.apply -
 *   The game's reducer. It gets a copy of the state, so it may mutate it.
 *   It returns the new state, or null to reject the intent.
 * @param {(state: any, player: { id: string, name: string }) => ({ state: any } | { refuse: string })} [options.admit] -
 *   Decides whether a player who says hello may sit down, and seats them.
 *   A returning player (same id) comes through here again. Without it,
 *   everybody is admitted and the state does not change.
 * @param {(change: { state: any, version: number, peers: object[] }) => void} [options.onChange] -
 *   Called after every change to the state or to who is connected.
 */
export function createHost({ app, room, self, state, version = 0, apply, admit, onChange = () => {} }) {
  let current = clone(state);
  let currentVersion = version;
  // id -> { id, name, link, status }
  const peers = new Map();

  const peerList = () => [
    { id: self.id, name: self.name, status: "live", host: true },
    ...[...peers.values()].map(({ id, name, status }) => ({ id, name, status })),
  ];

  const toAll = (message) => {
    peers.forEach((p) => {
      if (p.status !== "closed") p.link.send(message);
    });
  };

  const changed = () => onChange({ state: current, version: currentVersion, peers: peerList() });

  const commit = (next) => {
    current = next;
    currentVersion += 1;
    toAll({ t: "state", v: currentVersion, s: current });
    changed();
  };

  const presenceChanged = () => {
    toAll({ t: "peers", list: peerList() });
    changed();
  };

  /** Runs the reducer on a copy; true when the state changed. */
  const run = (intent, playerId) => {
    const next = apply(clone(current), intent, playerId);
    if (next == null) return false;
    commit(next);
    return true;
  };

  /** A player said hello and, if a restore was needed, it is done: seat them. */
  function seat(link, player) {
    const verdict = admit ? admit(clone(current), player) : { state: current };
    if (verdict.refuse) {
      link.send({ t: "refuse", reason: verdict.refuse });
      link.close();
      return;
    }

    const old = peers.get(player.id);
    if (old && old.link !== link) old.link.close();
    const peer = { id: player.id, name: player.name, link, status: "live" };
    peers.set(player.id, peer);

    link.listen({
      status(status) {
        if (peers.get(player.id) !== peer) return; // replaced by a newer link
        peer.status = status;
        presenceChanged();
      },
    });

    link.send({ t: "welcome", room, host: { id: self.id, name: self.name } });
    if (JSON.stringify(verdict.state) !== JSON.stringify(current)) {
      commit(verdict.state);
    } else {
      link.send({ t: "state", v: currentVersion, s: current });
    }
    presenceChanged();
  }

  function connect(link) {
    let player = null; // set once this link's hello is accepted
    let awaitingRestore = null;

    link.listen({
      message(message) {
        if (message.t === "hello") {
          if (player) return;
          if (message.app !== app) {
            link.send({ t: "refuse", reason: "app" });
            link.close();
            return;
          }
          if (message.protocol !== PROTOCOL) {
            link.send({ t: "refuse", reason: "protocol" });
            link.close();
            return;
          }
          const hello = { id: String(message.player?.id ?? ""), name: String(message.player?.name ?? "").slice(0, 24) };
          const holder = peers.get(hello.id);
          if (!hello.id || hello.id === self.id || (holder && holder.status === "live" && holder.link !== link)) {
            // The link stays open: the guest picks a fresh id and says hello again.
            link.send({ t: "refuse", reason: "id-in-use" });
            return;
          }
          player = hello;
          if (Number(message.v) > currentVersion) {
            awaitingRestore = player;
            link.send({ t: "restore?" });
            return;
          }
          seat(link, player);
          return;
        }

        if (message.t === "restore" && awaitingRestore) {
          const who = awaitingRestore;
          awaitingRestore = null;
          if (Number(message.v) > currentVersion && message.s !== undefined) {
            current = message.s;
            currentVersion = Number(message.v);
            toAll({ t: "state", v: currentVersion, s: current });
            changed();
          }
          seat(link, who);
          return;
        }

        if (message.t === "intent" && player && peers.get(player.id)?.link === link) {
          run(message.i, player.id);
        }
      },
    });
  }

  return {
    get state() {
      return current;
    },
    get version() {
      return currentVersion;
    },
    get peers() {
      return peerList();
    },
    room,
    connect,

    /** The host's own intent, through the same reducer. True when it changed the state. */
    dispatch(intent) {
      return run(intent, self.id);
    },

    /**
     * A change only the host makes, outside any player's turn: seating a
     * bot, switching a rule, starting the round. `fn` gets a copy and
     * returns the new state, or null for no change.
     */
    update(fn) {
      const next = fn(clone(current));
      if (next == null) return false;
      commit(next);
      return true;
    },

    /** Takes a player away from the table for good. */
    drop(playerId, reason = "removed") {
      const peer = peers.get(playerId);
      if (!peer) return;
      peers.delete(playerId);
      peer.link.send({ t: "bye", reason });
      peer.link.close();
      presenceChanged();
    },

    close() {
      peers.forEach((p) => {
        p.link.send({ t: "bye", reason: "host-left" });
        p.link.close();
      });
      peers.clear();
    },
  };
}

/**
 * Sits down at somebody else's table over an open link.
 *
 * @param {object} options
 * @param {string} options.app - This game's name; the host refuses another.
 * @param {{ id: string, name: string }} options.self - This player. The id
 *   should survive a reload, so the host gives back the same seat.
 * @param {object} options.link - An open link to the host.
 * @param {any} [options.state] - A board this page already holds, offered
 *   to a host that lost its own.
 * @param {number} [options.version] - The version of that board.
 * @param {() => string} [options.freshId] - Makes a new id when the host
 *   says this one is already sitting at the table (a second tab).
 * @param {(id: string) => void} [options.onIdChange] - Told about that new id.
 * @param {(change: object) => void} [options.onChange] - Called with
 *   `{ state, version, peers, status }` after every change.
 * @param {(reason: string) => void} [options.onRefuse]
 * @param {(reason: string) => void} [options.onClose]
 */
export function createGuest({
  app,
  self,
  link,
  state = null,
  version = 0,
  freshId = () => `p${Math.random().toString(36).slice(2, 10)}`,
  onIdChange = () => {},
  onChange = () => {},
  onRefuse = () => {},
  onClose = () => {},
}) {
  const me = { ...self };
  let current = state;
  let currentVersion = version;
  let status = "joining";
  let room = null;
  let hostId = null;
  let peers = [];
  let welcomed = false;
  let firstStateAfterWelcome = false;
  let ended = false;

  const changed = () => onChange({ state: current, version: currentVersion, peers, status, room, hostId });
  const end = (reason, refused) => {
    if (ended) return;
    ended = true;
    status = "closed";
    if (refused) onRefuse(reason);
    else onClose(reason);
    changed();
  };

  const hello = () =>
    link.send({ t: "hello", protocol: PROTOCOL, app, player: { id: me.id, name: me.name }, v: currentVersion });

  link.listen({
    message(message) {
      switch (message.t) {
        case "welcome":
          welcomed = true;
          firstStateAfterWelcome = true;
          room = message.room;
          hostId = message.host?.id ?? null;
          status = link.status === "quiet" ? "quiet" : "live";
          break;
        case "state":
          // The first state after a welcome is final even if its number is
          // lower (the host restarted with a fresh table); after that, a
          // state never steps backwards.
          if (!welcomed) return;
          if (!firstStateAfterWelcome && Number(message.v) < currentVersion) return;
          firstStateAfterWelcome = false;
          current = message.s;
          currentVersion = Number(message.v);
          changed();
          return;
        case "peers":
          peers = Array.isArray(message.list) ? message.list : [];
          changed();
          return;
        case "restore?":
          link.send({ t: "restore", v: currentVersion, s: current });
          return;
        case "refuse":
          if (message.reason === "id-in-use") {
            me.id = freshId();
            onIdChange(me.id);
            hello();
            return;
          }
          end(message.reason, true);
          link.close();
          return;
        case "bye":
          end(message.reason, false);
          link.close();
          return;
        default:
          return;
      }
      changed();
    },
    status(next) {
      if (next === "closed") {
        end("lost", false);
        return;
      }
      if (!welcomed || ended) return;
      status = next;
      changed();
    },
  });

  hello();

  return {
    get state() {
      return current;
    },
    get version() {
      return currentVersion;
    },
    get peers() {
      return peers;
    },
    get status() {
      return status;
    },
    get room() {
      return room;
    },
    get hostId() {
      return hostId;
    },
    get self() {
      return { ...me };
    },

    /** Asks the host to do something. The host decides; the state comes back. */
    dispatch(intent) {
      if (ended) return false;
      return link.send({ t: "intent", i: intent });
    },

    leave() {
      end("left", false);
      link.close();
    },
  };
}
