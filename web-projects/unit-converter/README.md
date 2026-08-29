# Unit Converter

Type an amount and a unit. Every unit it can be appears at once. There is no category to pick and no second dropdown: the unit you type is what says whether you mean length, weight, money or anything else.

## Features

- **One input box.** `100 km`, `5'10"`, `1 1/2 cup`, `20°C`, `100 USD`, `1h30m`, `1.234,56 €` and `7 l/100km` all work.
- **Every answer at once.** The whole category is converted and listed, most useful first, so most conversions need no target at all.
- **Pick a target when you want one.** Write `100 km to mi` (or `a mi` in Spanish) and that answer gets its own card at the top.
- **17 kinds of measurement**: length, weight, temperature, volume, data size, time, speed, currency, area, energy, power, pressure, data rate, fuel economy, angle, frequency and force.
- **59 currencies with live exchange rates**, and a copy built into the page for when the rates cannot be fetched. The page always says which of the two you are looking at.
- **A second reading where it helps.** `5.8399 ft` also reads `5′ 10.1″`, `0.75 in` also reads `3/4″`, and `1.5 h` also reads `1 h 30 min`.
- **Tap a number to copy it**, without the thousands separators, so it pastes straight into a spreadsheet.
- **Shareable links.** The address bar always holds what is on screen.
- **English and Spanish**, chosen from your browser and remembered.
- Works on a phone and on a desktop, in light and dark, and with a keyboard alone.

## How to Run

Open `index.html` in a browser, or serve the repository with any HTTP server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/unit-converter/`.

## Tests

```bash
bun test
```

## What you can type

| You type | It reads |
|---|---|
| `100 km` | 100 kilometres |
| `100km`, `100 kilometros`, `100 kilómetros` | the same |
| `km` | one kilometre |
| `5'10"`, `5ft 10in`, `5′10″` | 5 feet 10 inches |
| `1 1/2 cup`, `3/4 tsp` | a recipe fraction |
| `1h30m`, `2h 15min` | a length of time |
| `1,5 kg`, `1.234,56 €`, `1 000 000 m` | the European way of writing numbers |
| `2.5e3 J` | the exponent form |
| `$100`, `100$`, `€50` | a currency sign, before or after |
| `-40 C`, `20°C`, `98.6 F` | a temperature |
| `100 km to mi`, `100 km in mi`, `100 km a mi`, `100 km -> mi` | with a target |

## URL Parameters

| Parameter | What it does |
|---|---|
| `q` | The line to convert, exactly as typed. Example: `?q=100+km` |
| `to` | The unit to promote to the card at the top. Example: `&to=mile` |
| `lang` | `en` or `es`. Left out when the page is in English. |

## Files

| File | What it holds |
|---|---|
| `units.js` | Every unit and category: names in both languages, aliases, factors, and the bundled exchange-rate snapshot |
| `convert.js` | Converting one value, converting it into every unit of its category, and the order the answers come back in |
| `parse.js` | Reading one typed line into an amount, a unit and a target |
| `search.js` | Finding the unit a person means from the few letters they typed |
| `format.js` | Writing the numbers, including money and the second reading under a value |
| `rates.js` | Reading a rate table out of what an exchange-rate service sends |
| `dataSource.js` | The only file that touches the network |
| `store.js` | Recent conversions, the cached rates and the chosen language |
| `urlState.js` | Reading and writing the address bar |
| `i18n.js` | Every word the page says, in English and Spanish |
| `deployStamp.js` | The "deployed at" line in the footer |
| `app.js` | The page itself: listening to the input box and building the elements |

## Data and attribution

Exchange rates come from [ExchangeRate-API](https://www.exchangerate-api.com)'s open endpoint, and from [Frankfurter](https://frankfurter.dev) (the European Central Bank's daily reference rates) when the first does not answer. Every other conversion factor is fixed by a standard and is written into `units.js`.

## Privacy

Everything is worked out in your browser. The only request this page makes is for the exchange-rate table. Your conversions, your language and your recent lines stay in your own browser and are sent nowhere.

## Live Version

<https://triunitystudios.com/web-projects/unit-converter/>
