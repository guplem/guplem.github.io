# WhatsApp Without Saving a Contact

Open a WhatsApp chat with any phone number, without saving that number as a contact first. Pick the country, type the number, open the chat.

WhatsApp accepts a link of the form `https://api.whatsapp.com/send?phone=<number>`, where `<number>` is the full international number as plain digits. This page is a friendly way to build that link and follow it.

## Features

- **Country selector with search** -- 227 countries. Search by name, by dialling code (`+34`), or by ISO code (`ES`). Accents are ignored, so `reunion` finds Réunion. Full keyboard support: arrow keys, Home, End, Enter, Escape.
- **Your country is preselected** -- read from the browser locale.
- **Paste a full number** -- type or paste `+44 (0) 7911 123456` or `0044 7911 123456` and the page selects the United Kingdom and keeps only the national part.
- **The trunk zero is handled** -- a number written `07911 123456` at home becomes `44 7911 123456` abroad. The page removes the leading zero and says that it did. Italy is the exception, where the leading zero is part of the number and stays.
- **Clear feedback** -- the number is shown the way it is dialled internationally before you open the chat, and an unusable number says what is wrong instead of failing silently.
- **Shareable link** -- the number is kept in the page URL, so a link opens the tool ready to send. Useful for a "message me" link.
- **Recent numbers** -- the last 6 numbers this browser used, kept in `localStorage` and never sent anywhere. One button clears them.
- **Responsive** -- one column, built for phones first, comfortable on a desktop.

## How to Run

No build step required. Serve the folder with any HTTP server:

```bash
# From the repository root
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/whatsapp-no-contact/` in a browser.

Opening `index.html` directly also works: all assets are self-contained. The page only cannot write the shareable URL, because a `file://` page may refuse a history write.

## Tests

The number logic is covered by tests using Bun's built-in test runner.

```bash
# From the project folder
bun test
```

## URL Parameters

- `p` -- the full international number as digits, e.g. `?p=34639078482`. A leading `+` (as `%2B`) or a `0034` exit code is also accepted.

Example: `https://triunitystudios.com/web-projects/whatsapp-no-contact/?p=34639078482`

The number in a shared link is visible to anyone who has the link. Only share a number you are happy to hand out.

## Files

| File | Holds |
|---|---|
| `countries.js` | The country list and its lookups: flag from ISO code, search, longest-match dial-code split |
| `phone.js` | Number rules: digits, trunk zero, validity, the WhatsApp link, the URL parameter |
| `recents.js` | The recent-numbers list and its stored format |
| `app.js` | DOM glue only. It reads the page, calls the three modules above, and writes the result back |

## Tech Stack

Vanilla HTML, CSS, and JavaScript. No frameworks and no dependencies.

## Privacy

Nothing leaves the browser. There is no server, no analytics, and no request to any third party. The recent-numbers list is stored in this browser only. Opening a chat hands the number to WhatsApp, which is the point of the page.

Not affiliated with WhatsApp.

## Live Version

[triunitystudios.com/web-projects/whatsapp-no-contact](https://triunitystudios.com/web-projects/whatsapp-no-contact/)
