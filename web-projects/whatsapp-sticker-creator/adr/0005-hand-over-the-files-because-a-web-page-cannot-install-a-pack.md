# ADR 0005: Hand over the files, because a web page cannot install a pack

## Context

The obvious thing for this tool to do at the end is add the pack to WhatsApp.
It cannot, and no web page can.

WhatsApp reads sticker packs from an installed application that answers as a
content provider on Android, or through an app extension on iOS. Both READMEs in
`WhatsApp/stickers` open by saying so: "you can package them in an Android app.
You will need to distribute your app via the Google Play Store". There is no URL
scheme, no web intent and no share target that installs a pack from a page. The
gap is deliberate on WhatsApp's part, not an oversight to work around.

So the tool has to stop one step short of the thing a person came for, and the
question is what it hands over instead, and how honestly it explains the step it
cannot take.

## Decision

**The tool hands over files, in the two layouts something else can install, and
says plainly what has to happen next.**

**`.wastickers`, for a person on a phone.** This is the format the third-party
sticker apps read, and it is the route that actually works today: save the file,
share it to one of those apps, add the pack. It is a flat ZIP archive holding
`title.txt`, `author.txt`, a 96 by 96 `cover.png`, and the stickers. It has no
manifest, so a phone app reads the folder and takes the order it finds. That is
why the sticker names are padded to two digits: `1.webp` and `10.webp` sort as 1,
10, 2 and would shuffle the pack.

**`contents.json` plus the files, for a developer.** This is the folder that drops
straight into WhatsApp's own sample app. Two fields here are easy to get wrong
and both are covered by tests: `animated_sticker_pack` is required for an
animated pack and its absence fails the whole pack even when every sticker
animates, and `image_data_version` has to move on every edit or WhatsApp keeps
serving the pack it already cached.

**A single sticker downloads on its own too.** It is a 512 by 512 WebP, which can
be sent into a chat as an image. That is not the same as installing it, and the
tool does not pretend it is.

**The page explains the step it cannot take, rather than hiding it.** A short
note under the export buttons says WhatsApp only reads packs from an installed
app, and what to do about it. A tool that ended with a download and no
explanation would leave every person wondering what they had done wrong.

**Both archives are written by `zip.js`, with the files stored rather than
compressed.** Method 0. A sticker is a WebP and a tray icon is a PNG, and both
are already compressed, so deflating them again would be the larger half of the
work here for no smaller file. That is also why no ZIP library is needed, which
keeps root ADR 0002 satisfied.

**`zip.js` refuses a name holding a folder.** Both layouts are read as a flat
list, and a name with a folder in it would install nothing and do so quietly.

## Consequences

- **The last step is not automatic, and cannot be made so from a web page.** An
  app of its own is the only way to close it, which is outside what a project in
  `web-projects/` is.
- **The `.wastickers` format is a third-party convention, not a WhatsApp one.** It
  is documented by the tools that read it rather than by WhatsApp, so it could
  change without notice. The developer archive is the one built from WhatsApp's
  own published shape.
- **The tray icon is generated, not asked for.** It is the pack's first sticker
  scaled to 96 by 96 as a PNG, and any sticker can be chosen instead. Asking a
  person to draw a separate icon at a different size would stop most packs from
  ever being finished.
- **An animated sticker's tray icon is its first frame**, because it is drawn from
  the sticker's own file and that is what a decoder gives. WhatsApp requires a
  still image here, so that is the right answer rather than a limitation.
- **The archive is verified against a standard ZIP reader**, not only against the
  writer in this folder: every checksum, the central directory offsets, and the
  dates all read back correctly.
- **Export is blocked until the pack passes**, because a pack that cannot install
  is worse than no download at all. Three stickers, no mixing of still and
  animated, a name, a publisher, a legal identifier and a tray icon.
