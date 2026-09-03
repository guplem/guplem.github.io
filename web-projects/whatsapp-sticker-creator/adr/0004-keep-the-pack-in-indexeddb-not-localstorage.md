# ADR 0004: Keep the pack in IndexedDB, not localStorage

## Context

A pack is worth keeping. Someone builds thirty stickers over an evening, and a
reload that lost them would be the worst thing this tool could do. So the pack
has to survive a reload, and there is no server to put it on: the site is static
GitHub Pages, and every sibling project here promises that nothing leaves the
device.

Root ADR 0007 answers exactly that need, and chose `localStorage`. Its own words:
"For web-projects with **private, per-device state that must persist across
sessions but is never shared**, `localStorage` is the source of truth."

That is this project's need precisely. But it is not this project's data.

`localStorage` holds strings and about 5MB of them. A pack is up to thirty
stickers at up to 100KB each, and an animated pack is thirty at up to 500KB: 3MB
at the low end and 15MB at the high end. Worse, storing bytes as a string means
base64, which makes every picture a third larger again. A full still pack would
not fit, and an animated pack would not come close. Root ADR 0007 names its own
ceiling in the same breath as its choice, "~5MB of room", and never claimed to
cover anything larger.

Nothing in this repository used IndexedDB before this project.

## Decision

**The pack goes in IndexedDB. The chosen language stays in `localStorage`.**

The split follows the data, not the project:

- **The pack** is megabytes of binary. IndexedDB stores a `Uint8Array` as it is,
  with no base64 and no practical size limit at this scale. `store.js` owns the
  database; `save.js` owns the shape.
- **The language** is a two letter string, and it is wanted before the first
  paint. `localStorage` is read synchronously, IndexedDB is not. This is exactly
  the case root ADR 0007 describes, so it follows it.

**Root ADR 0007's reasoning carries over unchanged; only its mechanism does
not.** Client-side only, never sent over the network, per-device, private, no
server, no cookie. IndexedDB satisfies every one of those. What it does not
satisfy is being a synchronous string store, which is the only part that fails
here.

**`save.js` follows one rule, borrowed from akwaaba-monsters ADR 0002: only ever
add fields, and give every new field a default in `migrate`.** Never rename a
field and never reuse a name. A pack saved last month has to keep opening, and
the way to promise that is for old documents to stay readable rather than for old
code to stay around.

**A document from a newer version is refused, not read.** Reading it would drop
the fields this code does not know about and then write the loss back, which
turns a temporary mismatch into permanent damage.

**Every call can fail and none of them throw.** A browser in private mode refuses
storage on the first write, a phone can be out of room, and a person can have
blocked site data. None of that is the reader's fault, so a refused write is
reported once and forgotten, a refused read looks like an empty store, and the
editor keeps working.

## Consequences

- **This is a new pattern in the repository, and it is recorded here rather than
  in root `adr/` on purpose.** One project needs it. `web-projects/AGENTS.md`
  already sets the threshold for promoting a pattern: two copies is cheaper than
  a new exception. A second project wanting binary persistence is the trigger to
  consider a root ADR, not this one.
- **Root ADR 0007 is left exactly as it is.** It stays true for what it describes,
  and widening it to mean "or IndexedDB for blobs" would blur two decisions into
  one.
- **The editor's own work in progress is not saved, only the finished pack.** The
  source photograph, its cut-out mask and the undo history are tens of megabytes
  and belong to a session. Losing a finished sticker is the loss that matters.
- **Only the pack's own data is stored.** Blob URLs are rebuilt on load and never
  written: a stored blob URL would point at nothing on the next visit.
- **A sticker whose picture comes back missing is dropped and the rest kept.**
  Storage can come back short, and losing one sticker is far better than losing
  the pack.
- **Writes are debounced.** A person typing a pack name would otherwise write the
  whole pack, pictures and all, on every keystroke.
- **The database name carries no version but the key does** (`pack:v1`). A future
  shape can sit beside this one rather than replacing it.
