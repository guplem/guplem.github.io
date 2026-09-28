# ADR 0017: Peer-to-peer sync for web-projects, paired by hand, with one host

## Context

The site has no server (root ADR 0002), and GitHub Pages only serves files.
Games that people play together on their own devices still need one shared
state that every device sees at the same time.

taboo-game avoided the problem: every device computes the same state from a
shared seed, and the players advance the turns by hand (taboo-game ADR 0001).
That works when the whole state follows from a few numbers. It does not work
for a game where each move depends on a die and on a choice (Ludo).

We compared the options for moving messages between browsers:

1. **A hosted realtime service** (Firebase, Supabase, PartyKit). This is reliable, but
   it is a server and a database in all but name. It also puts a key in the page,
   and it adds a free-tier risk.
2. **WebRTC with a public signalling server** (PeerJS, Trystero over Nostr or
   MQTT). Pairing is easy, but every pairing depends on a third-party server
   that we do not control.
3. **WebRTC with manual signalling.** A person carries each connection
   description, as a link, a QR code or pasted text. There is no server at all.

We also compared two ways to keep the state consistent:

- **One authoritative host**: one page applies every move with the game's own
  rules, and the other pages only send intents.
- **CRDTs** (Yjs, Automerge): every page edits and the edits merge. A CRDT
  guarantees that the copies agree, not that the result is legal. So every
  page would still need to validate moves, and a turn-based game has almost no
  simultaneous edits to merge.

Manual signalling also favours a star shape: four players cost three pairings to
a host, but six pairings in a full mesh.

## Decision

**Add the shared module `web-projects/online-sync/`, the third exception to the
self-contained rule, after the directory index (root ADR 0008) and
`cloud-storage/` (root ADR 0016).**

- **Transport: WebRTC data channels with manual signalling.** `signal.js` packs a
  session description into a code of about 125 characters, and `peer.js` gathers
  every candidate before it returns a code. The code travels in the URL
  fragment (`#join=`, `#answer=`), so no server ever receives it. Google's public
  STUN servers tell each browser its own address. No message passes through them.
- **Consistency: one authoritative host.** A game provides a pure reducer
  `apply(state, intent, playerId)` and an `admit(state, player)` hook.
  `session.js` sends every accepted change to every guest with a version number.
  The sender of an intent is the link it arrived on.
- **Layers:** `session.js` talks only to a small link interface (`link.js`), so a
  later transport can replace WebRTC without a change to the session or any game.
- `ghana-ludo/` is the first project to use the module. The owner decides after testing
  whether every new online game must use it.

**Rejected alternative:** a hosted realtime service or a public signalling
server. Each works, but each brings back a server that the site does not own, which
is the constraint this decision exists to keep.

## Consequences

- Online play works on a static site, with no account and no key, and the moves
  stay between the players' devices.
- A game writes only its rules as a reducer. Joining, reconnects, presence and
  restore are written once, in the module, with tests.
- Pairing costs the players two scans (or two links) per guest. A reload drops
  every connection, and each guest then needs a new invite.
- There is no TURN relay, so some mobile networks cannot connect directly.
  Players on the same Wi-Fi always can.
- The host can cheat, because it rolls the dice. That is acceptable between friends.
- `peer.js` cannot run under Bun. It is checked by connecting two real browser
  profiles, and the rest of the module is unit-tested.
