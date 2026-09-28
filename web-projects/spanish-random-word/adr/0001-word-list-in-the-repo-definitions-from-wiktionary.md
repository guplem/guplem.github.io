# ADR 0001: The word list lives in the repository, and the definitions come from Wiktionary

## Context

The page shows a random Spanish word and, when the reader asks, its definition. The owner set two requirements:

- Leave out words that nobody in Spain would use: old words, cultured words, and words from other Spanish-speaking countries.
- Keep the page light.

There are three places the data could come from:

1. **An API that returns a random word.** No public API returns a random Spanish word with a filter for "common in Spain". The random-page call of Wiktionary returns any page, and most Wiktionary pages are rare words, inflected forms or words from other languages. The page could not apply the filter without many calls per word.
2. **Everything in the repository**: the words and their definitions. The filter is then free at run time. But definitions for about 6,300 words are about 1 MB, and the reader downloads all of it to read one definition. The owner would also have to re-publish the definitions under their licence and refresh them by hand.
3. **The words in the repository, the definitions from an API.** The list is small (about 53 KB), and the filter runs once, offline, over the whole Wiktionary dump. The page asks the Wiktionary API for the one word on screen. That API sends a CORS header (`origin=*`), needs no key and returns the page source (wikitext).

The Real Academia Española (RAE) has no public API that a browser can call, so the page links to the RAE entry but does not read it.

## Decision

Use option 3.

- `tools/buildWordList.js` writes `words.js`. It takes the 20,000 most frequent words of the OpenSubtitles frequency list (words people say, not words people only read). It keeps a word when its Spanish Wiktionary page, read from the dump, has a lemma sense usable in Spain.
- `wikitext.js` holds the rules, and both sides use it. The build script calls `isEligibleWord`. The page calls `spainEntries` to choose the senses to show. So the list and the page can never disagree about a word.
- A sense is usable in Spain when it has no `{{ámbito}}` label, or the label includes "España", and it has no `{{uso}}` label from `EXCLUDED_USES` (such as anticuado, desusado, culto, literario, poco usado).
- A word is left out when it is a plural or a feminine form ("partes", "bonita"), when it is mostly said as a form of a more frequent verb ("pongo", from "poner"), when it ends in "-mente", or when its only senses are vulgar.

## Consequences

**Good**

- The page loads about 70 KB of script and word list, and one small request per definition that the reader opens.
- The filter reads the dictionary's own labels, not a list someone keeps by hand.
- The definitions are always current, because they come from Wiktionary at the moment the reader asks.

**Bad**

- The definition needs a network connection and depends on Wiktionary. The page says so when the request fails, and it keeps the two dictionary links visible.
- The frequency list comes from subtitles in all Spanish-speaking countries, and the Wiktionary labels are incomplete. A few odd words still get in (names that are also common nouns, for example). The list is a filter, not a curated list.
- A change to the rules in `wikitext.js` changes the senses on the page at once, but the word list only after someone runs the build script again.
