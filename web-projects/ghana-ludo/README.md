# Ghana Ludo

Ludo the way it is played in Ghana: besides landing on a piece, you can knock
an opponent out backwards, sideways across a house, and inside their own house.
Play alone against bots, pass one phone round, or invite friends to their own
phones, with no server in between.

## Features

- **The Ghanaian house rules.** Back kick, side kick (with the step back to
  line one up), home kick, and the walk back out of a raided house. The host
  can switch off each special kick, the three tries while nothing is out, the
  pile on your start field, and the safe start field.
- **Online with friends, no server.** The host shows a QR code; a friend scans
  it, and the host scans the answer on the friend's phone. Far apart, both
  links travel through any chat app. The phones then talk directly over
  WebRTC, through the shared [`online-sync`](../online-sync/) module.
- **One true board.** The host's phone applies every move and rolls every die,
  so two phones can never disagree.
- **A lost connection keeps its seat.** The host sends a new invite and the
  player sits back down where they were. A host who reloads can resume the table.
- **Bots and a shared phone.** Fill empty chairs with greedy bots, or add a
  second person who plays on the host's phone.
- **Pieces walk.** A six visibly walks six fields, and a back kick walks the
  wrong way.
- `#demo` opens the same round in progress every time.

## How to Run

Serve the repository with any HTTP server and open `web-projects/ghana-ludo/`:

```bash
python -m http.server 8000
```

Online play needs two devices, or two browser profiles, on a page served over
HTTPS or from `localhost`.

## Tests

```bash
bun test web-projects/ghana-ludo
```
