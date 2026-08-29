// Every unit the converter knows, and the categories that group them.
//
// One unit is one object. `factor` is how many base units one of it is worth,
// so `metre` is 1 and `kilometre` is 1000. A few units cannot be written as a
// multiplication, so they carry `toBase` and `fromBase` instead:
//
//   - temperature has an offset (0 °C is 273.15 K, not 0 K)
//   - fuel economy runs backwards (more miles per gallon is fewer litres per
//     100 km), so the two are divided, not multiplied
//
// `aliases` is what the search matches against. Put in every spelling a person
// might type, in English and in Spanish, plus the symbol. More aliases means
// fewer moments where a real unit looks missing. `units.test.js` checks that no
// alias is claimed twice inside one category; the same alias in two different
// categories is fine, and `search.js` settles it with `rank`.
//
// `rank` is how common a unit is: 1 is everyday, 4 is exotic. The result list
// shows low ranks first and hides the rest behind a "show all" control, so the
// answer a person came for is on screen without any scrolling.
//
// Currencies are different: their factor is a rate that changes every day. Each
// carries `live: true` and a snapshot factor (see SNAPSHOT_DATE) that
// `rates.js` overwrites once the real rates arrive. The snapshot is a fallback,
// never a claim: the page always says which of the two it used.

/** How many decimal places of a degree one radian is. */
const DEG_PER_RAD = 180 / Math.PI;
/** One inch, in metres. Every imperial length below is built from it. */
const INCH = 0.0254;
/** One pound, in kilograms. Every imperial mass below is built from it. */
const POUND = 0.45359237;
/** One US gallon, in litres. Every US kitchen measure below is built from it. */
const US_GALLON = 3.785411784;
/** One imperial gallon, in litres. */
const UK_GALLON = 4.54609;
/** Litres per 100 km for a car that does one US mile per US gallon. */
const MPG_US_BASE = (100 * US_GALLON) / 1.609344;
/** Litres per 100 km for a car that does one mile per imperial gallon. */
const MPG_UK_BASE = (100 * UK_GALLON) / 1.609344;

/**
 * The groups of units. `base` names the unit every factor in the group is
 * measured against. `hue` is the colour the page tints the group with. `sample`
 * is the query the page runs when a person taps the group, so one tap always
 * lands on a full table of answers instead of an empty field.
 */
export const CATEGORIES = [
  { id: "length", base: "metre", hue: 24, sample: "1 m", name: { en: "Length", es: "Longitud" } },
  { id: "mass", base: "kilogram", hue: 268, sample: "1 kg", name: { en: "Weight", es: "Peso" } },
  { id: "temperature", base: "kelvin", hue: 8, sample: "20 °C", name: { en: "Temperature", es: "Temperatura" } },
  { id: "volume", base: "litre", hue: 200, sample: "1 l", name: { en: "Volume", es: "Volumen" } },
  { id: "data", base: "byte", hue: 172, sample: "1 GB", name: { en: "Data size", es: "Tamaño de datos" } },
  { id: "time", base: "second", hue: 44, sample: "1 h", name: { en: "Time", es: "Tiempo" } },
  { id: "speed", base: "metre-per-second", hue: 320, sample: "100 km/h", name: { en: "Speed", es: "Velocidad" } },
  { id: "currency", base: "eur", hue: 140, sample: "100 EUR", name: { en: "Currency", es: "Moneda" } },
  { id: "area", base: "square-metre", hue: 96, sample: "1 m²", name: { en: "Area", es: "Área" } },
  { id: "energy", base: "joule", hue: 52, sample: "1 kWh", name: { en: "Energy", es: "Energía" } },
  { id: "power", base: "watt", hue: 232, sample: "1 kW", name: { en: "Power", es: "Potencia" } },
  { id: "pressure", base: "pascal", hue: 188, sample: "1 bar", name: { en: "Pressure", es: "Presión" } },
  { id: "data-rate", base: "bit-per-second", hue: 156, sample: "100 Mbps", name: { en: "Data rate", es: "Velocidad de datos" } },
  { id: "fuel", base: "litre-per-100km", hue: 288, sample: "7 l/100km", name: { en: "Fuel economy", es: "Consumo" } },
  { id: "angle", base: "degree", hue: 340, sample: "90°", name: { en: "Angle", es: "Ángulo" } },
  { id: "frequency", base: "hertz", hue: 260, sample: "1 kHz", name: { en: "Frequency", es: "Frecuencia" } },
  { id: "force", base: "newton", hue: 12, sample: "1 N", name: { en: "Force", es: "Fuerza" } },
];

/* -------------------------------------------------------------------------- */
/* Length                                                                     */
/* -------------------------------------------------------------------------- */

const LENGTH = [
  { id: "millimetre", sym: "mm", factor: 0.001, rank: 1, name: { en: "millimetre", es: "milímetro" }, aliases: ["mm", "millimetre", "millimetres", "millimeter", "millimeters", "milimetro", "milímetro", "milimetros", "milímetros"] },
  { id: "centimetre", sym: "cm", factor: 0.01, rank: 1, name: { en: "centimetre", es: "centímetro" }, aliases: ["cm", "centimetre", "centimetres", "centimeter", "centimeters", "centimetro", "centímetro", "centimetros", "centímetros"] },
  { id: "metre", sym: "m", factor: 1, rank: 1, name: { en: "metre", es: "metro" }, aliases: ["m", "metre", "metres", "meter", "meters", "metro", "metros"] },
  { id: "kilometre", sym: "km", factor: 1000, rank: 1, name: { en: "kilometre", es: "kilómetro" }, aliases: ["km", "kilometre", "kilometres", "kilometer", "kilometers", "kilometro", "kilómetro", "kilometros", "kilómetros"] },
  { id: "inch", sym: "in", factor: INCH, rank: 1, name: { en: "inch", es: "pulgada" }, aliases: ["in", "inch", "inches", "\"", "″", "pulgada", "pulgadas"] },
  { id: "foot", sym: "ft", factor: INCH * 12, rank: 1, name: { en: "foot", es: "pie" }, aliases: ["ft", "foot", "feet", "'", "′", "pie", "pies"] },
  { id: "yard", sym: "yd", factor: INCH * 36, rank: 2, name: { en: "yard", es: "yarda" }, aliases: ["yd", "yard", "yards", "yarda", "yardas"] },
  { id: "mile", sym: "mi", factor: 1609.344, rank: 1, name: { en: "mile", es: "milla" }, aliases: ["mi", "mile", "miles", "milla", "millas"] },
  { id: "nautical-mile", sym: "nmi", factor: 1852, rank: 3, name: { en: "nautical mile", es: "milla náutica" }, aliases: ["nmi", "nautical mile", "nautical miles", "milla nautica", "milla náutica", "millas nauticas"] },
  { id: "micrometre", sym: "µm", factor: 1e-6, rank: 3, name: { en: "micrometre", es: "micrómetro" }, aliases: ["µm", "um", "micrometre", "micrometres", "micrometer", "micron", "microns", "micra", "micrometro", "micrómetro"] },
  { id: "nanometre", sym: "nm", factor: 1e-9, rank: 3, name: { en: "nanometre", es: "nanómetro" }, aliases: ["nm", "nanometre", "nanometres", "nanometer", "nanometers", "nanometro", "nanómetro", "nanometros"] },
  { id: "decimetre", sym: "dm", factor: 0.1, rank: 4, name: { en: "decimetre", es: "decímetro" }, aliases: ["dm", "decimetre", "decimetres", "decimeter", "decimetro", "decímetro"] },
  { id: "pixel", sym: "px", factor: INCH / 96, rank: 3, tag: { en: "CSS, 96 dpi", es: "CSS, 96 ppp" }, name: { en: "pixel", es: "píxel" }, aliases: ["px", "pixel", "pixels", "píxel", "píxeles", "pixeles"] },
  { id: "point", sym: "pt", factor: INCH / 72, rank: 3, tag: { en: "typography", es: "tipografía" }, name: { en: "point", es: "punto" }, aliases: ["pt", "point", "points", "punto", "puntos"] },
  { id: "pica", sym: "pica", factor: INCH / 6, rank: 4, tag: { en: "typography", es: "tipografía" }, name: { en: "pica", es: "pica" }, aliases: ["pica", "picas"] },
  { id: "thou", sym: "mil", factor: INCH / 1000, rank: 4, name: { en: "thou", es: "milésima de pulgada" }, aliases: ["mil", "mils", "thou", "thous", "thousandth of an inch", "milesima de pulgada"] },
  { id: "fathom", sym: "ftm", factor: INCH * 72, rank: 4, name: { en: "fathom", es: "braza" }, aliases: ["ftm", "fathom", "fathoms", "braza", "brazas"] },
  { id: "furlong", sym: "fur", factor: 201.168, rank: 4, name: { en: "furlong", es: "furlong" }, aliases: ["fur", "furlong", "furlongs"] },
  { id: "angstrom", sym: "Å", factor: 1e-10, rank: 4, name: { en: "angstrom", es: "ángstrom" }, aliases: ["å", "angstrom", "angstroms", "ångström", "ángstrom"] },
  { id: "astronomical-unit", sym: "AU", factor: 149597870700, rank: 4, name: { en: "astronomical unit", es: "unidad astronómica" }, aliases: ["au", "astronomical unit", "astronomical units", "ua", "unidad astronomica", "unidad astronómica"] },
  { id: "light-year", sym: "ly", factor: 9460730472580800, rank: 3, name: { en: "light-year", es: "año luz" }, aliases: ["ly", "light year", "light years", "lightyear", "lightyears", "al", "ano luz", "año luz", "años luz"] },
  { id: "parsec", sym: "pc", factor: 3.0856775814913673e16, rank: 4, name: { en: "parsec", es: "pársec" }, aliases: ["pc", "parsec", "parsecs", "pársec", "pársecs"] },
];

/* -------------------------------------------------------------------------- */
/* Mass                                                                       */
/* -------------------------------------------------------------------------- */

const MASS = [
  { id: "gram", sym: "g", factor: 0.001, rank: 1, name: { en: "gram", es: "gramo" }, aliases: ["g", "gr", "gram", "grams", "gramme", "grammes", "gramo", "gramos"] },
  { id: "kilogram", sym: "kg", factor: 1, rank: 1, name: { en: "kilogram", es: "kilogramo" }, aliases: ["kg", "kilo", "kilos", "kilogram", "kilograms", "kilogramme", "kilogramo", "kilogramos"] },
  { id: "pound", sym: "lb", factor: POUND, rank: 1, name: { en: "pound", es: "libra" }, aliases: ["lb", "lbs", "pound", "pounds", "libra", "libras"] },
  { id: "ounce", sym: "oz", factor: POUND / 16, rank: 1, name: { en: "ounce", es: "onza" }, aliases: ["oz", "ounce", "ounces", "onza", "onzas"] },
  { id: "milligram", sym: "mg", factor: 1e-6, rank: 2, name: { en: "milligram", es: "miligramo" }, aliases: ["mg", "milligram", "milligrams", "miligramo", "miligramos"] },
  { id: "tonne", sym: "t", factor: 1000, rank: 2, tag: { en: "metric", es: "métrica" }, name: { en: "tonne", es: "tonelada" }, aliases: ["t", "tonne", "tonnes", "metric ton", "metric tons", "tonelada", "toneladas"] },
  { id: "stone", sym: "st", factor: POUND * 14, rank: 2, tag: { en: "UK", es: "RU" }, name: { en: "stone", es: "stone" }, aliases: ["st", "stone", "stones"] },
  { id: "microgram", sym: "µg", factor: 1e-9, rank: 3, name: { en: "microgram", es: "microgramo" }, aliases: ["µg", "ug", "mcg", "microgram", "micrograms", "microgramo", "microgramos"] },
  { id: "short-ton", sym: "ton", factor: POUND * 2000, rank: 3, tag: { en: "US", es: "EE. UU." }, name: { en: "short ton", es: "tonelada corta" }, aliases: ["ton", "tons", "short ton", "short tons", "us ton", "tonelada corta"] },
  { id: "long-ton", sym: "LT", factor: POUND * 2240, rank: 4, tag: { en: "UK", es: "RU" }, name: { en: "long ton", es: "tonelada larga" }, aliases: ["lt", "long ton", "long tons", "imperial ton", "tonelada larga"] },
  { id: "carat", sym: "ct", factor: 0.0002, rank: 3, name: { en: "carat", es: "quilate" }, aliases: ["ct", "carat", "carats", "quilate", "quilates"] },
  { id: "troy-ounce", sym: "ozt", factor: 0.0311034768, rank: 3, tag: { en: "gold, silver", es: "oro, plata" }, name: { en: "troy ounce", es: "onza troy" }, aliases: ["ozt", "troy ounce", "troy ounces", "onza troy", "onzas troy"] },
  { id: "grain", sym: "grain", factor: 0.00006479891, rank: 4, name: { en: "grain", es: "grano" }, aliases: ["grain", "grains", "grano", "granos"] },
];

/* -------------------------------------------------------------------------- */
/* Temperature                                                                */
/* -------------------------------------------------------------------------- */

const TEMPERATURE = [
  { id: "celsius", sym: "°C", rank: 1, name: { en: "Celsius", es: "Celsius" }, aliases: ["°c", "c", "celsius", "centigrade", "centigrado", "centígrado", "grados", "grado"], toBase: (v) => v + 273.15, fromBase: (v) => v - 273.15 },
  { id: "fahrenheit", sym: "°F", rank: 1, name: { en: "Fahrenheit", es: "Fahrenheit" }, aliases: ["°f", "f", "fahrenheit", "farenheit"], toBase: (v) => (v + 459.67) * (5 / 9), fromBase: (v) => v * 1.8 - 459.67 },
  { id: "kelvin", sym: "K", factor: 1, rank: 2, name: { en: "kelvin", es: "kelvin" }, aliases: ["k", "kelvin", "kelvins"] },
  { id: "rankine", sym: "°R", factor: 5 / 9, rank: 4, name: { en: "Rankine", es: "Rankine" }, aliases: ["°r", "r", "rankine"] },
];

/* -------------------------------------------------------------------------- */
/* Volume                                                                     */
/* -------------------------------------------------------------------------- */

const VOLUME = [
  { id: "millilitre", sym: "ml", factor: 0.001, rank: 1, name: { en: "millilitre", es: "mililitro" }, aliases: ["ml", "millilitre", "millilitres", "milliliter", "milliliters", "mililitro", "mililitros", "cc", "cubic centimetre", "cubic centimeter", "centimetro cubico"] },
  { id: "litre", sym: "l", factor: 1, rank: 1, name: { en: "litre", es: "litro" }, aliases: ["l", "lt", "litre", "litres", "liter", "liters", "litro", "litros"] },
  { id: "us-cup", sym: "cup", factor: US_GALLON / 16, rank: 1, tag: { en: "US", es: "EE. UU." }, name: { en: "cup", es: "taza" }, aliases: ["cup", "cups", "us cup", "us cups", "taza", "tazas"] },
  { id: "us-tablespoon", sym: "tbsp", factor: US_GALLON / 256, rank: 1, tag: { en: "US", es: "EE. UU." }, name: { en: "tablespoon", es: "cucharada" }, aliases: ["tbsp", "tablespoon", "tablespoons", "tbs", "cucharada", "cucharadas"] },
  { id: "us-teaspoon", sym: "tsp", factor: US_GALLON / 768, rank: 1, tag: { en: "US", es: "EE. UU." }, name: { en: "teaspoon", es: "cucharadita" }, aliases: ["tsp", "teaspoon", "teaspoons", "cucharadita", "cucharaditas"] },
  { id: "us-fluid-ounce", sym: "fl oz", factor: US_GALLON / 128, rank: 1, tag: { en: "US", es: "EE. UU." }, name: { en: "fluid ounce", es: "onza líquida" }, aliases: ["fl oz", "floz", "fluid ounce", "fluid ounces", "us fl oz", "onza liquida", "onza líquida", "onzas liquidas"] },
  { id: "us-gallon", sym: "gal", factor: US_GALLON, rank: 1, tag: { en: "US", es: "EE. UU." }, name: { en: "gallon", es: "galón" }, aliases: ["gal", "gallon", "gallons", "us gallon", "us gallons", "galon", "galón", "galones"] },
  { id: "us-pint", sym: "pt", factor: US_GALLON / 8, rank: 2, tag: { en: "US", es: "EE. UU." }, name: { en: "pint", es: "pinta" }, aliases: ["pt", "pint", "pints", "us pint", "us pints", "pinta", "pintas"] },
  { id: "us-quart", sym: "qt", factor: US_GALLON / 4, rank: 2, tag: { en: "US", es: "EE. UU." }, name: { en: "quart", es: "cuarto de galón" }, aliases: ["qt", "quart", "quarts", "us quart", "cuarto de galon"] },
  { id: "imperial-gallon", sym: "gal UK", factor: UK_GALLON, rank: 2, tag: { en: "UK", es: "RU" }, name: { en: "imperial gallon", es: "galón imperial" }, aliases: ["gal uk", "imperial gallon", "imperial gallons", "uk gallon", "uk gallons", "galon imperial", "galón imperial"] },
  { id: "imperial-pint", sym: "pt UK", factor: UK_GALLON / 8, rank: 2, tag: { en: "UK", es: "RU" }, name: { en: "imperial pint", es: "pinta imperial" }, aliases: ["pt uk", "imperial pint", "imperial pints", "uk pint", "uk pints", "pinta imperial"] },
  { id: "imperial-fluid-ounce", sym: "fl oz UK", factor: UK_GALLON / 160, rank: 3, tag: { en: "UK", es: "RU" }, name: { en: "imperial fluid ounce", es: "onza líquida imperial" }, aliases: ["fl oz uk", "imperial fluid ounce", "uk fl oz", "uk fluid ounce", "onza liquida imperial"] },
  { id: "metric-cup", sym: "cup (250 ml)", factor: 0.25, rank: 2, tag: { en: "metric", es: "métrica" }, name: { en: "metric cup", es: "taza métrica" }, aliases: ["cup (250 ml)", "metric cup", "metric cups", "taza metrica", "taza métrica"] },
  { id: "metric-tablespoon", sym: "tbsp (15 ml)", factor: 0.015, rank: 2, tag: { en: "metric", es: "métrica" }, name: { en: "metric tablespoon", es: "cucharada métrica" }, aliases: ["tbsp (15 ml)", "metric tablespoon", "metric tablespoons", "cucharada metrica", "cucharada métrica"] },
  { id: "metric-teaspoon", sym: "tsp (5 ml)", factor: 0.005, rank: 2, tag: { en: "metric", es: "métrica" }, name: { en: "metric teaspoon", es: "cucharadita métrica" }, aliases: ["tsp (5 ml)", "metric teaspoon", "metric teaspoons", "cucharadita metrica", "cucharadita métrica"] },
  { id: "centilitre", sym: "cl", factor: 0.01, rank: 3, name: { en: "centilitre", es: "centilitro" }, aliases: ["cl", "centilitre", "centilitres", "centiliter", "centilitro", "centilitros"] },
  { id: "decilitre", sym: "dl", factor: 0.1, rank: 3, name: { en: "decilitre", es: "decilitro" }, aliases: ["dl", "decilitre", "decilitres", "deciliter", "decilitro", "decilitros"] },
  { id: "cubic-metre", sym: "m³", factor: 1000, rank: 2, name: { en: "cubic metre", es: "metro cúbico" }, aliases: ["m³", "m3", "cubic metre", "cubic metres", "cubic meter", "cubic meters", "metro cubico", "metro cúbico", "metros cubicos"] },
  { id: "cubic-inch", sym: "in³", factor: INCH ** 3 * 1000, rank: 3, name: { en: "cubic inch", es: "pulgada cúbica" }, aliases: ["in³", "in3", "cubic inch", "cubic inches", "ci", "pulgada cubica", "pulgada cúbica"] },
  { id: "cubic-foot", sym: "ft³", factor: (INCH * 12) ** 3 * 1000, rank: 3, name: { en: "cubic foot", es: "pie cúbico" }, aliases: ["ft³", "ft3", "cubic foot", "cubic feet", "cf", "pie cubico", "pie cúbico", "pies cubicos"] },
  { id: "oil-barrel", sym: "bbl", factor: US_GALLON * 42, rank: 4, tag: { en: "oil", es: "petróleo" }, name: { en: "oil barrel", es: "barril de petróleo" }, aliases: ["bbl", "barrel", "barrels", "oil barrel", "barril", "barriles"] },
];

/* -------------------------------------------------------------------------- */
/* Data size                                                                  */
/* -------------------------------------------------------------------------- */

const DATA = [
  { id: "byte", sym: "B", factor: 1, rank: 2, name: { en: "byte", es: "byte" }, aliases: ["b", "byte", "bytes"] },
  { id: "kilobyte", sym: "kB", factor: 1e3, rank: 1, tag: { en: "1000 bytes", es: "1000 bytes" }, name: { en: "kilobyte", es: "kilobyte" }, aliases: ["kb", "kilobyte", "kilobytes"] },
  { id: "megabyte", sym: "MB", factor: 1e6, rank: 1, tag: { en: "1000 kB", es: "1000 kB" }, name: { en: "megabyte", es: "megabyte" }, exact: ["MB"], aliases: ["mb", "megabyte", "megabytes", "mega", "megas"] },
  { id: "gigabyte", sym: "GB", factor: 1e9, rank: 1, tag: { en: "1000 MB", es: "1000 MB" }, name: { en: "gigabyte", es: "gigabyte" }, aliases: ["gb", "gigabyte", "gigabytes", "giga", "gigas"] },
  { id: "terabyte", sym: "TB", factor: 1e12, rank: 1, tag: { en: "1000 GB", es: "1000 GB" }, name: { en: "terabyte", es: "terabyte" }, aliases: ["tb", "terabyte", "terabytes", "tera", "teras"] },
  { id: "petabyte", sym: "PB", factor: 1e15, rank: 3, name: { en: "petabyte", es: "petabyte" }, aliases: ["pb", "petabyte", "petabytes"] },
  { id: "kibibyte", sym: "KiB", factor: 1024, rank: 2, tag: { en: "1024 bytes", es: "1024 bytes" }, name: { en: "kibibyte", es: "kibibyte" }, aliases: ["kib", "kibibyte", "kibibytes"] },
  { id: "mebibyte", sym: "MiB", factor: 1024 ** 2, rank: 2, tag: { en: "1024 KiB", es: "1024 KiB" }, name: { en: "mebibyte", es: "mebibyte" }, aliases: ["mib", "mebibyte", "mebibytes"] },
  { id: "gibibyte", sym: "GiB", factor: 1024 ** 3, rank: 2, tag: { en: "what your disk really shows", es: "lo que muestra tu disco" }, name: { en: "gibibyte", es: "gibibyte" }, aliases: ["gib", "gibibyte", "gibibytes"] },
  { id: "tebibyte", sym: "TiB", factor: 1024 ** 4, rank: 2, tag: { en: "1024 GiB", es: "1024 GiB" }, name: { en: "tebibyte", es: "tebibyte" }, aliases: ["tib", "tebibyte", "tebibytes"] },
  { id: "pebibyte", sym: "PiB", factor: 1024 ** 5, rank: 4, name: { en: "pebibyte", es: "pebibyte" }, aliases: ["pib", "pebibyte", "pebibytes"] },
  { id: "bit", sym: "bit", factor: 0.125, rank: 2, name: { en: "bit", es: "bit" }, aliases: ["bit", "bits"] },
  { id: "kilobit", sym: "kbit", factor: 125, rank: 3, name: { en: "kilobit", es: "kilobit" }, aliases: ["kbit", "kilobit", "kilobits"] },
  { id: "megabit", sym: "Mbit", factor: 125000, rank: 3, name: { en: "megabit", es: "megabit" }, exact: ["Mb"], aliases: ["mbit", "megabit", "megabits"] },
  { id: "gigabit", sym: "Gbit", factor: 1.25e8, rank: 3, name: { en: "gigabit", es: "gigabit" }, exact: ["Gb"], aliases: ["gbit", "gigabit", "gigabits"] },
  { id: "terabit", sym: "Tbit", factor: 1.25e11, rank: 4, name: { en: "terabit", es: "terabit" }, aliases: ["tbit", "terabit", "terabits"] },
];

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

const TIME = [
  { id: "second", sym: "s", factor: 1, rank: 1, name: { en: "second", es: "segundo" }, aliases: ["s", "sec", "secs", "second", "seconds", "segundo", "segundos", "seg"] },
  { id: "minute", sym: "min", factor: 60, rank: 1, name: { en: "minute", es: "minuto" }, aliases: ["min", "mins", "m", "minute", "minutes", "minuto", "minutos"] },
  { id: "hour", sym: "h", factor: 3600, rank: 1, name: { en: "hour", es: "hora" }, aliases: ["h", "hr", "hrs", "hour", "hours", "hora", "horas"] },
  { id: "day", sym: "d", factor: 86400, rank: 1, name: { en: "day", es: "día" }, aliases: ["d", "day", "days", "dia", "día", "dias", "días"] },
  { id: "week", sym: "wk", factor: 604800, rank: 2, name: { en: "week", es: "semana" }, aliases: ["wk", "week", "weeks", "semana", "semanas"] },
  { id: "month", sym: "mo", factor: 2629746, rank: 2, tag: { en: "average", es: "media" }, name: { en: "month", es: "mes" }, aliases: ["mo", "month", "months", "mes", "meses"] },
  { id: "year", sym: "yr", factor: 31556952, rank: 2, tag: { en: "average", es: "media" }, name: { en: "year", es: "año" }, aliases: ["yr", "y", "year", "years", "ano", "año", "anos", "años"] },
  { id: "millisecond", sym: "ms", factor: 0.001, rank: 2, name: { en: "millisecond", es: "milisegundo" }, aliases: ["ms", "millisecond", "milliseconds", "milisegundo", "milisegundos"] },
  { id: "microsecond", sym: "µs", factor: 1e-6, rank: 3, name: { en: "microsecond", es: "microsegundo" }, aliases: ["µs", "us", "microsecond", "microseconds", "microsegundo", "microsegundos"] },
  { id: "nanosecond", sym: "ns", factor: 1e-9, rank: 3, name: { en: "nanosecond", es: "nanosegundo" }, aliases: ["ns", "nanosecond", "nanoseconds", "nanosegundo", "nanosegundos"] },
  { id: "decade", sym: "dec", factor: 315569520, rank: 3, name: { en: "decade", es: "década" }, aliases: ["dec", "decade", "decades", "decada", "década", "decadas"] },
  { id: "century", sym: "cent", factor: 3155695200, rank: 4, name: { en: "century", es: "siglo" }, aliases: ["cent", "century", "centuries", "siglo", "siglos"] },
  { id: "fortnight", sym: "fn", factor: 1209600, rank: 4, name: { en: "fortnight", es: "quincena" }, aliases: ["fn", "fortnight", "fortnights", "quincena", "quincenas"] },
];

/* -------------------------------------------------------------------------- */
/* Speed                                                                      */
/* -------------------------------------------------------------------------- */

const SPEED = [
  { id: "kilometre-per-hour", sym: "km/h", factor: 1 / 3.6, rank: 1, name: { en: "kilometre per hour", es: "kilómetro por hora" }, aliases: ["km/h", "kmh", "kph", "km per hour", "kilometre per hour", "kilometres per hour", "kilometers per hour", "kilometro por hora", "kilómetros por hora"] },
  { id: "mile-per-hour", sym: "mph", factor: 0.44704, rank: 1, name: { en: "mile per hour", es: "milla por hora" }, aliases: ["mph", "mi/h", "mile per hour", "miles per hour", "milla por hora", "millas por hora"] },
  { id: "metre-per-second", sym: "m/s", factor: 1, rank: 1, name: { en: "metre per second", es: "metro por segundo" }, aliases: ["m/s", "mps", "metre per second", "metres per second", "meters per second", "metro por segundo", "metros por segundo"] },
  { id: "knot", sym: "kn", factor: 1852 / 3600, rank: 2, name: { en: "knot", es: "nudo" }, aliases: ["kn", "kt", "kts", "knot", "knots", "nudo", "nudos"] },
  { id: "foot-per-second", sym: "ft/s", factor: INCH * 12, rank: 3, name: { en: "foot per second", es: "pie por segundo" }, aliases: ["ft/s", "fps", "foot per second", "feet per second", "pie por segundo", "pies por segundo"] },
  { id: "mach", sym: "Mach", factor: 340.29, rank: 3, tag: { en: "at sea level", es: "a nivel del mar" }, name: { en: "Mach", es: "Mach" }, aliases: ["mach", "machs"] },
  { id: "speed-of-light", sym: "c", factor: 299792458, rank: 4, name: { en: "speed of light", es: "velocidad de la luz" }, aliases: ["c", "speed of light", "light speed", "velocidad de la luz"] },
];

/* -------------------------------------------------------------------------- */
/* Area                                                                       */
/* -------------------------------------------------------------------------- */

const AREA = [
  { id: "square-metre", sym: "m²", factor: 1, rank: 1, name: { en: "square metre", es: "metro cuadrado" }, aliases: ["m²", "m2", "sqm", "sq m", "square metre", "square metres", "square meter", "square meters", "metro cuadrado", "metros cuadrados"] },
  { id: "square-kilometre", sym: "km²", factor: 1e6, rank: 1, name: { en: "square kilometre", es: "kilómetro cuadrado" }, aliases: ["km²", "km2", "sq km", "square kilometre", "square kilometres", "square kilometer", "kilometro cuadrado", "kilómetros cuadrados"] },
  { id: "square-foot", sym: "ft²", factor: (INCH * 12) ** 2, rank: 1, name: { en: "square foot", es: "pie cuadrado" }, aliases: ["ft²", "ft2", "sqft", "sq ft", "square foot", "square feet", "pie cuadrado", "pies cuadrados"] },
  { id: "hectare", sym: "ha", factor: 10000, rank: 1, name: { en: "hectare", es: "hectárea" }, aliases: ["ha", "hectare", "hectares", "hectarea", "hectárea", "hectareas", "hectáreas"] },
  { id: "acre", sym: "ac", factor: 4046.8564224, rank: 1, name: { en: "acre", es: "acre" }, aliases: ["ac", "acre", "acres"] },
  { id: "square-centimetre", sym: "cm²", factor: 1e-4, rank: 2, name: { en: "square centimetre", es: "centímetro cuadrado" }, aliases: ["cm²", "cm2", "sq cm", "square centimetre", "square centimetres", "square centimeter", "centimetro cuadrado", "centímetros cuadrados"] },
  { id: "square-mile", sym: "mi²", factor: 1609.344 ** 2, rank: 2, name: { en: "square mile", es: "milla cuadrada" }, aliases: ["mi²", "mi2", "sq mi", "square mile", "square miles", "milla cuadrada", "millas cuadradas"] },
  { id: "square-inch", sym: "in²", factor: INCH ** 2, rank: 2, name: { en: "square inch", es: "pulgada cuadrada" }, aliases: ["in²", "in2", "sq in", "square inch", "square inches", "pulgada cuadrada", "pulgadas cuadradas"] },
  { id: "square-yard", sym: "yd²", factor: (INCH * 36) ** 2, rank: 3, name: { en: "square yard", es: "yarda cuadrada" }, aliases: ["yd²", "yd2", "sq yd", "square yard", "square yards", "yarda cuadrada"] },
  { id: "square-millimetre", sym: "mm²", factor: 1e-6, rank: 3, name: { en: "square millimetre", es: "milímetro cuadrado" }, aliases: ["mm²", "mm2", "sq mm", "square millimetre", "square millimeters", "milimetro cuadrado"] },
  { id: "are", sym: "a", factor: 100, rank: 4, name: { en: "are", es: "área" }, aliases: ["a", "are", "ares"] },
];

/* -------------------------------------------------------------------------- */
/* Energy                                                                     */
/* -------------------------------------------------------------------------- */

const ENERGY = [
  { id: "kilocalorie", sym: "kcal", factor: 4184, rank: 1, tag: { en: "food Calorie", es: "caloría de los alimentos" }, name: { en: "kilocalorie", es: "kilocaloría" }, aliases: ["kcal", "kilocalorie", "kilocalories", "food calorie", "food calories", "kilocaloria", "kilocaloría", "kilocalorias"] },
  { id: "kilowatt-hour", sym: "kWh", factor: 3.6e6, rank: 1, name: { en: "kilowatt-hour", es: "kilovatio-hora" }, aliases: ["kwh", "kilowatt hour", "kilowatt hours", "kilovatio hora", "kilovatios hora"] },
  { id: "joule", sym: "J", factor: 1, rank: 1, name: { en: "joule", es: "julio" }, aliases: ["j", "joule", "joules", "julio", "julios"] },
  { id: "kilojoule", sym: "kJ", factor: 1000, rank: 1, name: { en: "kilojoule", es: "kilojulio" }, aliases: ["kj", "kilojoule", "kilojoules", "kilojulio", "kilojulios"] },
  { id: "calorie", sym: "cal", factor: 4.184, rank: 2, tag: { en: "small calorie", es: "caloría pequeña" }, name: { en: "calorie", es: "caloría" }, aliases: ["cal", "calorie", "calories", "caloria", "caloría", "calorias", "calorías"] },
  { id: "watt-hour", sym: "Wh", factor: 3600, rank: 2, name: { en: "watt-hour", es: "vatio-hora" }, aliases: ["wh", "watt hour", "watt hours", "vatio hora", "vatios hora"] },
  { id: "megajoule", sym: "MJ", factor: 1e6, rank: 2, name: { en: "megajoule", es: "megajulio" }, aliases: ["mj", "megajoule", "megajoules", "megajulio", "megajulios"] },
  { id: "megawatt-hour", sym: "MWh", factor: 3.6e9, rank: 3, name: { en: "megawatt-hour", es: "megavatio-hora" }, aliases: ["mwh", "megawatt hour", "megawatt hours", "megavatio hora"] },
  { id: "btu", sym: "BTU", factor: 1055.05585262, rank: 3, name: { en: "British thermal unit", es: "unidad térmica británica" }, aliases: ["btu", "btus", "british thermal unit", "british thermal units", "unidad termica britanica"] },
  { id: "foot-pound", sym: "ft·lb", factor: 1.3558179483314004, rank: 4, name: { en: "foot-pound", es: "pie-libra" }, aliases: ["ft·lb", "ft lb", "ftlb", "foot pound", "foot pounds", "pie libra"] },
  { id: "electronvolt", sym: "eV", factor: 1.602176634e-19, rank: 4, name: { en: "electronvolt", es: "electronvoltio" }, aliases: ["ev", "electronvolt", "electronvolts", "electron volt", "electronvoltio", "electronvoltios"] },
];

/* -------------------------------------------------------------------------- */
/* Power                                                                      */
/* -------------------------------------------------------------------------- */

const POWER = [
  { id: "watt", sym: "W", factor: 1, rank: 1, name: { en: "watt", es: "vatio" }, aliases: ["w", "watt", "watts", "vatio", "vatios"] },
  { id: "kilowatt", sym: "kW", factor: 1000, rank: 1, name: { en: "kilowatt", es: "kilovatio" }, aliases: ["kw", "kilowatt", "kilowatts", "kilovatio", "kilovatios"] },
  { id: "horsepower", sym: "hp", factor: 745.6998715822702, rank: 1, tag: { en: "mechanical", es: "mecánico" }, name: { en: "horsepower", es: "caballo de fuerza" }, aliases: ["hp", "horsepower", "horse power", "caballo de fuerza", "caballos de fuerza"] },
  { id: "metric-horsepower", sym: "PS", factor: 735.49875, rank: 1, tag: { en: "metric, CV", es: "métrico, CV" }, name: { en: "metric horsepower", es: "caballo de vapor" }, aliases: ["ps", "cv", "metric horsepower", "caballo de vapor", "caballos de vapor", "cavallo vapore"] },
  { id: "megawatt", sym: "MW", factor: 1e6, rank: 2, name: { en: "megawatt", es: "megavatio" }, exact: ["MW"], aliases: ["mw", "megawatt", "megawatts", "megavatio", "megavatios"] },
  { id: "milliwatt", sym: "mW", factor: 0.001, rank: 3, exact: ["mW"], name: { en: "milliwatt", es: "milivatio" }, aliases: ["milliwatt", "milliwatts", "milivatio", "milivatios"] },
  { id: "gigawatt", sym: "GW", factor: 1e9, rank: 3, name: { en: "gigawatt", es: "gigavatio" }, aliases: ["gw", "gigawatt", "gigawatts", "gigavatio", "gigavatios"] },
  { id: "btu-per-hour", sym: "BTU/h", factor: 0.29307107017222, rank: 3, tag: { en: "air conditioning", es: "aire acondicionado" }, name: { en: "BTU per hour", es: "BTU por hora" }, aliases: ["btu/h", "btuh", "btu per hour", "btu por hora"] },
];

/* -------------------------------------------------------------------------- */
/* Pressure                                                                   */
/* -------------------------------------------------------------------------- */

const PRESSURE = [
  { id: "bar", sym: "bar", factor: 1e5, rank: 1, name: { en: "bar", es: "bar" }, aliases: ["bar", "bars", "bares"] },
  { id: "psi", sym: "psi", factor: 6894.757293168361, rank: 1, tag: { en: "tyres, US", es: "neumáticos, EE. UU." }, name: { en: "pound per square inch", es: "libra por pulgada cuadrada" }, aliases: ["psi", "pound per square inch", "pounds per square inch", "lb/in2", "libra por pulgada cuadrada"] },
  { id: "pascal", sym: "Pa", factor: 1, rank: 2, name: { en: "pascal", es: "pascal" }, aliases: ["pa", "pascal", "pascals", "pascales"] },
  { id: "hectopascal", sym: "hPa", factor: 100, rank: 2, tag: { en: "weather", es: "meteorología" }, name: { en: "hectopascal", es: "hectopascal" }, aliases: ["hpa", "hectopascal", "hectopascals", "hectopascales"] },
  { id: "kilopascal", sym: "kPa", factor: 1000, rank: 2, name: { en: "kilopascal", es: "kilopascal" }, aliases: ["kpa", "kilopascal", "kilopascals", "kilopascales"] },
  { id: "atmosphere", sym: "atm", factor: 101325, rank: 2, name: { en: "atmosphere", es: "atmósfera" }, aliases: ["atm", "atmosphere", "atmospheres", "atmosfera", "atmósfera", "atmosferas"] },
  { id: "millibar", sym: "mbar", factor: 100, rank: 3, tag: { en: "weather", es: "meteorología" }, name: { en: "millibar", es: "milibar" }, aliases: ["mbar", "millibar", "millibars", "milibar", "milibares"] },
  { id: "torr", sym: "mmHg", factor: 133.32236842105263, rank: 3, tag: { en: "blood pressure", es: "presión arterial" }, name: { en: "millimetre of mercury", es: "milímetro de mercurio" }, aliases: ["mmhg", "torr", "mm hg", "millimetre of mercury", "milimetro de mercurio", "milímetro de mercurio"] },
  { id: "megapascal", sym: "MPa", factor: 1e6, rank: 3, name: { en: "megapascal", es: "megapascal" }, aliases: ["mpa", "megapascal", "megapascals", "megapascales"] },
  { id: "inch-of-mercury", sym: "inHg", factor: 3386.388640341, rank: 4, name: { en: "inch of mercury", es: "pulgada de mercurio" }, aliases: ["inhg", "in hg", "inch of mercury", "pulgada de mercurio"] },
];

/* -------------------------------------------------------------------------- */
/* Data rate                                                                  */
/* -------------------------------------------------------------------------- */

const DATA_RATE = [
  { id: "megabit-per-second", sym: "Mbps", factor: 1e6, rank: 1, tag: { en: "what your ISP sells", es: "lo que vende tu operador" }, name: { en: "megabit per second", es: "megabit por segundo" }, aliases: ["mbps", "mbit/s", "mb/s-bit", "megabit per second", "megabits per second", "megas", "megabit por segundo"] },
  { id: "megabyte-per-second", sym: "MB/s", factor: 8e6, rank: 1, tag: { en: "what your download shows", es: "lo que muestra tu descarga" }, name: { en: "megabyte per second", es: "megabyte por segundo" }, aliases: ["mb/s", "mbyte/s", "megabyte per second", "megabytes per second", "megabyte por segundo"] },
  { id: "gigabit-per-second", sym: "Gbps", factor: 1e9, rank: 2, name: { en: "gigabit per second", es: "gigabit por segundo" }, aliases: ["gbps", "gbit/s", "gigabit per second", "gigabits per second", "gigabit por segundo"] },
  { id: "kilobit-per-second", sym: "kbps", factor: 1000, rank: 2, name: { en: "kilobit per second", es: "kilobit por segundo" }, aliases: ["kbps", "kbit/s", "kilobit per second", "kilobits per second", "kilobit por segundo"] },
  { id: "kilobyte-per-second", sym: "kB/s", factor: 8000, rank: 2, name: { en: "kilobyte per second", es: "kilobyte por segundo" }, aliases: ["kb/s", "kbyte/s", "kilobyte per second", "kilobytes per second", "kilobyte por segundo"] },
  { id: "mebibyte-per-second", sym: "MiB/s", factor: 8 * 1024 ** 2, rank: 3, name: { en: "mebibyte per second", es: "mebibyte por segundo" }, aliases: ["mib/s", "mebibyte per second", "mebibytes per second"] },
  { id: "gigabyte-per-second", sym: "GB/s", factor: 8e9, rank: 3, name: { en: "gigabyte per second", es: "gigabyte por segundo" }, aliases: ["gb/s", "gigabyte per second", "gigabytes per second", "gigabyte por segundo"] },
  { id: "bit-per-second", sym: "bit/s", factor: 1, rank: 3, name: { en: "bit per second", es: "bit por segundo" }, aliases: ["bit/s", "bps", "bit per second", "bits per second", "bit por segundo"] },
];

/* -------------------------------------------------------------------------- */
/* Fuel economy                                                               */
/* -------------------------------------------------------------------------- */
// This is the one group where a bigger number means a worse car in one unit and
// a better car in another, because the two are reciprocals of each other. The
// pair of functions below is what makes that work; a factor cannot express it.

const FUEL = [
  { id: "litre-per-100km", sym: "l/100km", factor: 1, rank: 1, tag: { en: "lower is better", es: "menos es mejor" }, name: { en: "litres per 100 km", es: "litros a los 100 km" }, aliases: ["l/100km", "l/100 km", "litres per 100km", "liters per 100km", "litros a los 100", "litros por 100 km", "l100"] },
  { id: "mpg-us", sym: "mpg", factor: undefined, rank: 1, tag: { en: "US, higher is better", es: "EE. UU., más es mejor" }, name: { en: "miles per gallon", es: "millas por galón" }, aliases: ["mpg", "mpg us", "miles per gallon", "us mpg", "millas por galon", "millas por galón"], toBase: (v) => MPG_US_BASE / v, fromBase: (v) => MPG_US_BASE / v },
  { id: "mpg-uk", sym: "mpg UK", factor: undefined, rank: 2, tag: { en: "UK, higher is better", es: "RU, más es mejor" }, name: { en: "miles per imperial gallon", es: "millas por galón imperial" }, aliases: ["mpg uk", "imperial mpg", "uk mpg", "miles per imperial gallon", "millas por galon imperial"], toBase: (v) => MPG_UK_BASE / v, fromBase: (v) => MPG_UK_BASE / v },
  { id: "km-per-litre", sym: "km/l", factor: undefined, rank: 2, tag: { en: "higher is better", es: "más es mejor" }, name: { en: "kilometres per litre", es: "kilómetros por litro" }, aliases: ["km/l", "kml", "kilometres per litre", "kilometers per liter", "kilometros por litro", "kilómetros por litro"], toBase: (v) => 100 / v, fromBase: (v) => 100 / v },
];

/* -------------------------------------------------------------------------- */
/* Angle, frequency, force                                                    */
/* -------------------------------------------------------------------------- */

const ANGLE = [
  { id: "degree", sym: "°", factor: 1, rank: 1, name: { en: "degree", es: "grado" }, aliases: ["°", "deg", "degree", "degrees", "grado", "grados"] },
  { id: "radian", sym: "rad", factor: DEG_PER_RAD, rank: 1, name: { en: "radian", es: "radián" }, aliases: ["rad", "radian", "radians", "radián", "radianes"] },
  { id: "gradian", sym: "gon", factor: 0.9, rank: 3, name: { en: "gradian", es: "gradián" }, aliases: ["gon", "grad", "gradian", "gradians", "gradián", "gradianes"] },
  { id: "turn", sym: "turn", factor: 360, rank: 3, name: { en: "turn", es: "vuelta" }, aliases: ["turn", "turns", "revolution", "revolutions", "vuelta", "vueltas"] },
  { id: "arcminute", sym: "arcmin", factor: 1 / 60, rank: 4, name: { en: "arcminute", es: "minuto de arco" }, aliases: ["arcmin", "arcminute", "arcminutes", "minuto de arco", "minutos de arco"] },
  { id: "arcsecond", sym: "arcsec", factor: 1 / 3600, rank: 4, name: { en: "arcsecond", es: "segundo de arco" }, aliases: ["arcsec", "arcsecond", "arcseconds", "segundo de arco", "segundos de arco"] },
];

const FREQUENCY = [
  { id: "hertz", sym: "Hz", factor: 1, rank: 1, name: { en: "hertz", es: "hercio" }, aliases: ["hz", "hertz", "hercio", "hercios"] },
  { id: "kilohertz", sym: "kHz", factor: 1000, rank: 1, name: { en: "kilohertz", es: "kilohercio" }, aliases: ["khz", "kilohertz", "kilohercio", "kilohercios"] },
  { id: "megahertz", sym: "MHz", factor: 1e6, rank: 1, name: { en: "megahertz", es: "megahercio" }, aliases: ["mhz", "megahertz", "megahercio", "megahercios"] },
  { id: "gigahertz", sym: "GHz", factor: 1e9, rank: 1, name: { en: "gigahertz", es: "gigahercio" }, aliases: ["ghz", "gigahertz", "gigahercio", "gigahercios"] },
  { id: "rpm", sym: "rpm", factor: 1 / 60, rank: 2, name: { en: "revolutions per minute", es: "revoluciones por minuto" }, aliases: ["rpm", "revolutions per minute", "revoluciones por minuto"] },
  { id: "bpm", sym: "bpm", factor: 1 / 60, rank: 2, tag: { en: "music, heart rate", es: "música, pulso" }, name: { en: "beats per minute", es: "pulsaciones por minuto" }, aliases: ["bpm", "beats per minute", "pulsaciones por minuto"] },
];

const FORCE = [
  { id: "newton", sym: "N", factor: 1, rank: 1, name: { en: "newton", es: "newton" }, aliases: ["n", "newton", "newtons"] },
  { id: "kilonewton", sym: "kN", factor: 1000, rank: 2, name: { en: "kilonewton", es: "kilonewton" }, aliases: ["kn", "kilonewton", "kilonewtons"] },
  { id: "kilogram-force", sym: "kgf", factor: 9.80665, rank: 2, name: { en: "kilogram-force", es: "kilogramo-fuerza" }, aliases: ["kgf", "kp", "kilogram force", "kilopond", "kilogramo fuerza"] },
  { id: "pound-force", sym: "lbf", factor: 4.4482216152605, rank: 2, name: { en: "pound-force", es: "libra-fuerza" }, aliases: ["lbf", "pound force", "pounds force", "libra fuerza"] },
  { id: "dyne", sym: "dyn", factor: 1e-5, rank: 4, name: { en: "dyne", es: "dina" }, aliases: ["dyn", "dyne", "dynes", "dina", "dinas"] },
];

/* -------------------------------------------------------------------------- */
/* Currency                                                                   */
/* -------------------------------------------------------------------------- */
// The factor here is a snapshot, not the truth. `rates.js` replaces it the
// moment live rates arrive, and the page always tells the reader which of the
// two it is looking at. The snapshot exists so the tool still answers with no
// network at all, which is the same rule the rest of this site follows: never
// leave the page blank.

/** The day the bundled fallback rates were read, base EUR. */
export const SNAPSHOT_DATE = "2026-08-29";

/** [ISO 4217 code, worth in euros, rank, English name, Spanish name, extra aliases] */
const CURRENCY_ROWS = [
  ["EUR", 1, 1, "euro", "euro", ["€", "euros"]],
  ["USD", 0.86134796, 1, "US dollar", "dólar estadounidense", ["$", "dollar", "dollars", "us dollar", "dolar", "dólar", "dolares"]],
  ["GBP", 1.1677427, 1, "pound sterling", "libra esterlina", ["£", "pound sterling", "sterling", "libra esterlina", "libras esterlinas"]],
  ["JPY", 0.0053890859, 1, "Japanese yen", "yen japonés", ["¥", "yen", "yenes"]],
  ["CHF", 1.0667429, 1, "Swiss franc", "franco suizo", ["swiss franc", "franco suizo"]],
  ["CAD", 0.62060842, 1, "Canadian dollar", "dólar canadiense", ["canadian dollar", "dolar canadiense"]],
  ["AUD", 0.61792285, 1, "Australian dollar", "dólar australiano", ["australian dollar", "dolar australiano"]],
  ["CNY", 0.12790282, 1, "Chinese yuan", "yuan chino", ["yuan", "renminbi", "rmb", "yuan chino"]],
  ["INR", 0.0090189757, 1, "Indian rupee", "rupia india", ["₹", "rupee", "rupees", "rupia", "rupias"]],
  ["MXN", 0.050685576, 1, "Mexican peso", "peso mexicano", ["mexican peso", "peso mexicano"]],
  ["BRL", 0.16645289, 1, "Brazilian real", "real brasileño", ["real", "reais", "real brasileno", "real brasileño"]],
  ["ARS", 0.00056928864, 2, "Argentine peso", "peso argentino", ["argentine peso", "peso argentino"]],
  ["CLP", 0.00092809608, 2, "Chilean peso", "peso chileno", ["chilean peso", "peso chileno"]],
  ["COP", 0.00027525547, 2, "Colombian peso", "peso colombiano", ["colombian peso", "peso colombiano"]],
  ["PEN", 0.2569043, 2, "Peruvian sol", "sol peruano", ["sol", "soles", "sol peruano"]],
  ["UYU", 0.021352829, 3, "Uruguayan peso", "peso uruguayo", ["uruguayan peso", "peso uruguayo"]],
  ["KRW", 0.00062470989, 2, "South Korean won", "won surcoreano", ["₩", "won", "won surcoreano"]],
  ["HKD", 0.10982418, 2, "Hong Kong dollar", "dólar de Hong Kong", ["hong kong dollar", "dolar de hong kong"]],
  ["SGD", 0.67653506, 2, "Singapore dollar", "dólar de Singapur", ["singapore dollar", "dolar de singapur"]],
  ["NZD", 0.51049162, 2, "New Zealand dollar", "dólar neozelandés", ["new zealand dollar", "dolar neozelandes"]],
  ["TWD", 0.027229723, 3, "New Taiwan dollar", "dólar taiwanés", ["taiwan dollar", "dolar taiwanes"]],
  ["THB", 0.026080136, 2, "Thai baht", "baht tailandés", ["baht", "baht tailandes"]],
  ["MYR", 0.21354271, 3, "Malaysian ringgit", "ringgit malayo", ["ringgit", "ringgit malayo"]],
  ["IDR", 0.000048782917, 2, "Indonesian rupiah", "rupia indonesia", ["rupiah", "rupia indonesia"]],
  ["PHP", 0.013834012, 2, "Philippine peso", "peso filipino", ["philippine peso", "peso filipino"]],
  ["VND", 0.000033296792, 3, "Vietnamese dong", "dong vietnamita", ["dong", "dong vietnamita"]],
  ["PKR", 0.0031048629, 3, "Pakistani rupee", "rupia pakistaní", ["pakistani rupee", "rupia pakistani"]],
  ["BDT", 0.0069973263, 3, "Bangladeshi taka", "taka bangladesí", ["taka", "taka bangladesi"]],
  ["LKR", 0.0026154687, 4, "Sri Lankan rupee", "rupia de Sri Lanka", ["sri lankan rupee", "rupia de sri lanka"]],
  ["NPR", 0.0056368851, 4, "Nepalese rupee", "rupia nepalí", ["nepalese rupee", "rupia nepali"]],
  ["SEK", 0.089986792, 2, "Swedish krona", "corona sueca", ["swedish krona", "corona sueca"]],
  ["NOK", 0.092045018, 2, "Norwegian krone", "corona noruega", ["norwegian krone", "corona noruega"]],
  ["DKK", 0.13378331, 2, "Danish krone", "corona danesa", ["danish krone", "corona danesa"]],
  ["ISK", 0.0071187092, 4, "Icelandic krona", "corona islandesa", ["icelandic krona", "corona islandesa"]],
  ["PLN", 0.23071755, 2, "Polish zloty", "esloti polaco", ["zloty", "esloti polaco"]],
  ["CZK", 0.041430248, 2, "Czech koruna", "corona checa", ["czech koruna", "corona checa"]],
  ["HUF", 0.00274419, 2, "Hungarian forint", "forinto húngaro", ["forint", "forinto hungaro"]],
  ["RON", 0.19018233, 3, "Romanian leu", "leu rumano", ["leu", "lei", "leu rumano"]],
  ["BGN", 0.51129188, 3, "Bulgarian lev", "lev búlgaro", ["lev", "lev bulgaro"]],
  ["RSD", 0.0085245065, 4, "Serbian dinar", "dinar serbio", ["serbian dinar", "dinar serbio"]],
  ["UAH", 0.019270946, 3, "Ukrainian hryvnia", "grivna ucraniana", ["hryvnia", "grivna ucraniana"]],
  ["RUB", 0.01000238, 3, "Russian rouble", "rublo ruso", ["rouble", "ruble", "rublo", "rublo ruso"]],
  ["TRY", 0.017864643, 2, "Turkish lira", "lira turca", ["lira", "turkish lira", "lira turca"]],
  ["ILS", 0.28884212, 3, "Israeli shekel", "séquel israelí", ["shekel", "sequel israeli", "séquel israelí"]],
  ["AED", 0.23454154, 2, "UAE dirham", "dírham de los EAU", ["dirham", "uae dirham", "dirham de los eau"]],
  ["SAR", 0.22969433, 3, "Saudi riyal", "riyal saudí", ["riyal", "saudi riyal", "riyal saudi"]],
  ["QAR", 0.23663565, 4, "Qatari riyal", "riyal catarí", ["qatari riyal", "riyal catari"]],
  ["KWD", 2.7963111, 4, "Kuwaiti dinar", "dinar kuwaití", ["kuwaiti dinar", "dinar kuwaiti"]],
  ["BHD", 2.2908353, 4, "Bahraini dinar", "dinar bareiní", ["bahraini dinar", "dinar bareini"]],
  ["OMR", 2.2402086, 4, "Omani rial", "rial omaní", ["omani rial", "rial omani"]],
  ["JOD", 1.2148853, 4, "Jordanian dinar", "dinar jordano", ["jordanian dinar", "dinar jordano"]],
  ["EGP", 0.017090902, 3, "Egyptian pound", "libra egipcia", ["egyptian pound", "libra egipcia"]],
  ["MAD", 0.092858633, 3, "Moroccan dirham", "dírham marroquí", ["moroccan dirham", "dirham marroqui"]],
  ["ZAR", 0.053513378, 2, "South African rand", "rand sudafricano", ["rand", "rand sudafricano"]],
  ["NGN", 0.00063124681, 3, "Nigerian naira", "naira nigeriana", ["naira", "naira nigeriana"]],
  ["KES", 0.0066336309, 3, "Kenyan shilling", "chelín keniano", ["kenyan shilling", "chelin keniano"]],
  ["GHS", 0.076209155, 4, "Ghanaian cedi", "cedi ghanés", ["cedi", "cedi ghanes"]],
  ["KZT", 0.001856667, 4, "Kazakhstani tenge", "tenge kazajo", ["tenge", "tenge kazajo"]],
  ["GEL", 0.32851414, 4, "Georgian lari", "lari georgiano", ["lari", "lari georgiano"]],
];

const CURRENCY = CURRENCY_ROWS.map(([code, factor, rank, en, es, extra]) => ({
  id: code.toLowerCase(),
  sym: code,
  factor,
  rank,
  live: true,
  name: { en, es },
  aliases: [code.toLowerCase(), ...extra],
}));

/* -------------------------------------------------------------------------- */
/* The catalogue                                                              */
/* -------------------------------------------------------------------------- */

/** Every unit, each stamped with the category it was declared under. */
export const UNITS = [
  ...LENGTH.map((unit) => ({ ...unit, cat: "length" })),
  ...MASS.map((unit) => ({ ...unit, cat: "mass" })),
  ...TEMPERATURE.map((unit) => ({ ...unit, cat: "temperature" })),
  ...VOLUME.map((unit) => ({ ...unit, cat: "volume" })),
  ...DATA.map((unit) => ({ ...unit, cat: "data" })),
  ...TIME.map((unit) => ({ ...unit, cat: "time" })),
  ...SPEED.map((unit) => ({ ...unit, cat: "speed" })),
  ...CURRENCY.map((unit) => ({ ...unit, cat: "currency" })),
  ...AREA.map((unit) => ({ ...unit, cat: "area" })),
  ...ENERGY.map((unit) => ({ ...unit, cat: "energy" })),
  ...POWER.map((unit) => ({ ...unit, cat: "power" })),
  ...PRESSURE.map((unit) => ({ ...unit, cat: "pressure" })),
  ...DATA_RATE.map((unit) => ({ ...unit, cat: "data-rate" })),
  ...FUEL.map((unit) => ({ ...unit, cat: "fuel" })),
  ...ANGLE.map((unit) => ({ ...unit, cat: "angle" })),
  ...FREQUENCY.map((unit) => ({ ...unit, cat: "frequency" })),
  ...FORCE.map((unit) => ({ ...unit, cat: "force" })),
];

const BY_ID = new Map(UNITS.map((unit) => [unit.id, unit]));
const BY_CATEGORY = new Map(
  CATEGORIES.map((category) => [
    category.id,
    UNITS.filter((unit) => unit.cat === category.id).sort((a, b) => a.rank - b.rank),
  ]),
);
const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

/**
 * Find one unit by its id.
 * @returns {object|undefined} undefined for an id that names no unit
 */
export function unitById(id) {
  return typeof id === "string" ? BY_ID.get(id) : undefined;
}

/**
 * Every unit in one category, most common first.
 * @returns {object[]} an empty array for a category that does not exist
 */
export function unitsInCategory(id) {
  return BY_CATEGORY.get(id) ?? [];
}

/** The category one unit measures, or undefined when the unit is unknown. */
export function categoryOf(unitId) {
  const unit = unitById(unitId);
  return unit ? CATEGORY_BY_ID.get(unit.cat) : undefined;
}

/** One category by its id, or undefined. */
export function categoryById(id) {
  return CATEGORY_BY_ID.get(id);
}
