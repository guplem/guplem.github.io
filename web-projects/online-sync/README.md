# online-sync

A shared module that lets web-projects play in real time between devices,
**with no server**. It is used by [Ghana Ludo](../ghana-ludo/).

## What it does

- **Connects two browsers directly** over WebRTC, the technology video calls use.
- **Pairs them without a server.** The host shows an invite as a QR code or a
  link; the guest's phone answers with a link of its own. A connection
  description of about 900 characters is packed into a code of about 125.
- **Keeps one true state.** The host's page holds the game and applies every
  move; the other pages send what they want to do and draw what comes back.
  Two devices can never disagree.
- **Survives a lost connection.** A quiet phone is marked as away, not dropped.
  A player who reconnects with a new invite gets their seat back, and a host
  that lost its state can take it back from a guest.
- **Draws its own QR codes.** No library and no third-party script.

## Limits

- There is no relay server (TURN). Some mobile networks block direct
  connections; two phones on the same Wi-Fi always connect.
- Google's public STUN servers tell each device its own internet address.
  They never see a message.
- A reload drops the connections, and each guest then needs a fresh invite.

## Tests

```bash
bun test web-projects/online-sync
```

`peer.js` needs a real browser, so it is checked by connecting two browser
profiles, not by Bun.
