# web-projects/online-sync/AGENTS.md

> **SCOPE:** These rules apply to `web-projects/online-sync/` and to every project that imports it. Root ADR 0017 records why the module exists and why it is shaped this way.

`online-sync/` is a shared module for real-time play between browsers, with no server. Two parts do the work:

- **Transport.** Two browsers connect over a WebRTC data channel. A person carries the connection details as a link, a QR code, or pasted text. This step is called **manual signalling**.
- **Authority.** One page, the **host**, holds the only true state. Guests send **intents**. The host runs the game's reducer and sends the new state with a version number.

`ghana-ludo/` is the reference adopter. Read its `app.js` to see the whole flow in one file.

## Module map

| File | Job | Tested |
|---|---|---|
| `signal.js` | Packs a session description into a short base64url code and writes a full description back from it. Builds and reads `#join=` / `#answer=` links. | `signal.test.js` |
| `link.js` | Wraps a data channel as a **link**: JSON messages, a heartbeat, status `live` / `quiet` / `closed`. `loopbackPair()` gives two joined links in memory. | `link.test.js` |
| `session.js` | `createHost` / `createGuest`: handshake, admission, intents, versioned state, presence, reconnect, restore. Talks only to links. | `session.test.js` |
| `peer.js` | `createInvite` / `answerInvite`: the only WebRTC code. Gathers every candidate before it returns a code. | By a two-browser run, not by Bun |
| `relay.js` | Passes an answer from the tab the camera opened to the tab that holds the table (BroadcastChannel, then localStorage). | `relay.test.js` |
| `qr.js` | QR encoder, byte mode, levels L and M. | `qr.test.js`, pinned to `qr.fixtures.json` |
| `pairingPanel.js` + `.css` | The invite card (host) and the answer card (guest). Words come in through `labels`. | DOM, exempt |

## Rules

- **Change the state only on the host.** A guest never edits its copy; it calls `guest.dispatch(intent)`.
- **Write the game's reducer as `apply(state, intent, playerId)`.** Return the new state, or `null` to reject. The host gives it a copy, so a reducer may mutate its argument.
- **Take the sender from the link, never from the message.** `session.js` passes the link's player id to `apply`. Never read a player id out of an intent.
- **Seat players in `admit(state, player)`.** Return `{ state }` or `{ refuse: reason }`. A returning player (same id) passes through `admit` again, so keep their seat.
- **Drive computer players and timed moves with `host.update(fn)`,** outside the reducer. No link speaks for a bot.
- **Keep `session.js`, `link.js`, `signal.js` and `relay.js` free of DOM and WebRTC.** Only `peer.js` and `pairingPanel.js` may touch the browser.
- **Mark a silent peer `quiet`, never `closed`.** A locked phone often keeps its channel. Closing costs the players a fresh pairing.
- **Keep the protocol additive.** Add message types; never change the meaning of an existing one. Raise `PROTOCOL` in `session.js` only for a breaking change.

## Adopting the module in a project (the checklist)

1. Write the shared state as one JSON value, and a pure reducer and `admit` for it, test-first.
2. Import `createHost`, `createGuest` from `../online-sync/session.js` and `createInvite`, `answerInvite` from `../online-sync/peer.js`.
3. On the host: call `createInvite({ app, room })`, show `linkFor(location.href, "offer", invite.code)` with `renderInviteCard`, and pass the answer to `invite.accept(code)`. Give the returned link to `host.connect(link)`.
4. Call `listenForAnswers({ app, onAnswer })` on the host page, and call `relayAnswer({ app, code })` when a page opens with `#answer=`. Clear the fragment after you read it.
5. On a page opened with `#join=`: call `answerInvite(code, { app })`, show the answer with `renderAnswerCard`, then give `await answer.connected` to `createGuest`.
6. Keep one player id per browser in `localStorage`, and pass `freshId` and `onIdChange` to `createGuest` for a second tab.
7. Link `../online-sync/pairingPanel.css` in `index.html`. Set the `--os-*-color` custom properties to match the project.
8. Test the full path in two separate browser profiles before you ship. Bun cannot run `peer.js`.

## Gotchas

- **The `app` string must match on both sides.** The host refuses a guest from another app with the reason `"app"`.
- **A code carries UDP candidates only, and at most eight.** TCP candidates are dropped on purpose.
- **There is no TURN relay.** Some mobile networks block direct connections, and then the pair cannot connect. Tell the players to join the same Wi-Fi.
- **The relay works only when the camera opens links in the browser that holds the table.** Always offer the paste box too.
- **The first state after a `welcome` wins, even with a lower version.** A host that restarted counts from zero. Later states never step backwards.
- **`qr.fixtures.json` comes from the Python `qrcode` library.** Do not regenerate it with segno. Segno adds a zero byte after the terminator, so its matrices differ.
