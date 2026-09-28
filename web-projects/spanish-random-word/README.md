# Palabra al azar

A random everyday Spanish word from Spain. The definition stays hidden until you press the button, so you can guess first.

## Features

- One random word at a time, from about 6,300 common words.
- The definition is hidden by default. One button shows it and hides it again.
- Only words and senses used in Spain: the list leaves out old, cultured and rare words, and words used only in the Americas.
- The word is in the link (`?palabra=casa`), so you can share the word you got. The back button goes through the words you already saw.
- Links to the word on Wiktionary and in the RAE dictionary.

## How to Run

Open `index.html` through any HTTP server, for example from the repository root:

```bash
python -m http.server 8000
```

Then go to `http://localhost:8000/web-projects/spanish-random-word/`.

## Tests

```bash
bun test
```

## Refresh the word list

`words.js` is generated. Do not edit it by hand. To build it again, download the two sources and run the script:

```bash
curl -O https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt
curl -O https://dumps.wikimedia.org/eswiktionary/latest/eswiktionary-latest-pages-articles.xml.bz2
bun tools/buildWordList.js --frequency es_50k.txt --dump eswiktionary-latest-pages-articles.xml.bz2
```

## Files

| File | What it does |
|---|---|
| `index.html`, `style.css` | The page |
| `app.js` | DOM glue: shows the word, the button, the definition |
| `pick.js` | Picks a word, reads and writes the link, builds the dictionary links |
| `wikitext.js` | Reads a Wiktionary page and decides which senses are usable in Spain |
| `words.js` | The generated word list |
| `tools/buildWordList.js` | Builds `words.js` from the frequency list and the Wiktionary dump |
| `deployStamp.js`, `i18n.js` | The "deployed at" line in the footer |

## Data and attribution

- Word frequencies: [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords), from OpenSubtitles, CC BY-SA 4.0.
- Definitions and labels: [Wikcionario](https://es.wiktionary.org/), CC BY-SA 4.0.

## Privacy

The page stores nothing. It sends one request to `es.wiktionary.org`, with the word on screen, when you open the definition.

## Live Version

[triunitystudios.com/web-projects/spanish-random-word/](https://triunitystudios.com/web-projects/spanish-random-word/)
