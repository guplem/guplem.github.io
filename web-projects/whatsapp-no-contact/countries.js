// Country dial codes and the lookups the selector needs. Pure data and pure
// functions, so tests can import this without a browser.
//
// Fields per entry:
//   name    display name, and what the search box matches against
//   iso2    ISO 3166-1 alpha-2 code. The flag emoji is derived from it.
//   dial    country calling code, digits only, no plus sign
//   primary set only where several countries share one dial code (+1, +7,
//           +39, +44). It marks the country a pasted number resolves to.
//
// The list stays sorted by name, so the selector never sorts at runtime.

export const COUNTRIES = [
  { name: "Afghanistan", iso2: "AF", dial: "93" },
  { name: "Albania", iso2: "AL", dial: "355" },
  { name: "Algeria", iso2: "DZ", dial: "213" },
  { name: "American Samoa", iso2: "AS", dial: "1684" },
  { name: "Andorra", iso2: "AD", dial: "376" },
  { name: "Angola", iso2: "AO", dial: "244" },
  { name: "Anguilla", iso2: "AI", dial: "1264" },
  { name: "Antigua and Barbuda", iso2: "AG", dial: "1268" },
  { name: "Argentina", iso2: "AR", dial: "54" },
  { name: "Armenia", iso2: "AM", dial: "374" },
  { name: "Aruba", iso2: "AW", dial: "297" },
  { name: "Australia", iso2: "AU", dial: "61" },
  { name: "Austria", iso2: "AT", dial: "43" },
  { name: "Azerbaijan", iso2: "AZ", dial: "994" },
  { name: "Bahamas", iso2: "BS", dial: "1242" },
  { name: "Bahrain", iso2: "BH", dial: "973" },
  { name: "Bangladesh", iso2: "BD", dial: "880" },
  { name: "Barbados", iso2: "BB", dial: "1246" },
  { name: "Belarus", iso2: "BY", dial: "375" },
  { name: "Belgium", iso2: "BE", dial: "32" },
  { name: "Belize", iso2: "BZ", dial: "501" },
  { name: "Benin", iso2: "BJ", dial: "229" },
  { name: "Bermuda", iso2: "BM", dial: "1441" },
  { name: "Bhutan", iso2: "BT", dial: "975" },
  { name: "Bolivia", iso2: "BO", dial: "591" },
  { name: "Bosnia and Herzegovina", iso2: "BA", dial: "387" },
  { name: "Botswana", iso2: "BW", dial: "267" },
  { name: "Brazil", iso2: "BR", dial: "55" },
  { name: "British Virgin Islands", iso2: "VG", dial: "1284" },
  { name: "Brunei", iso2: "BN", dial: "673" },
  { name: "Bulgaria", iso2: "BG", dial: "359" },
  { name: "Burkina Faso", iso2: "BF", dial: "226" },
  { name: "Burundi", iso2: "BI", dial: "257" },
  { name: "Cambodia", iso2: "KH", dial: "855" },
  { name: "Cameroon", iso2: "CM", dial: "237" },
  { name: "Canada", iso2: "CA", dial: "1" },
  { name: "Cape Verde", iso2: "CV", dial: "238" },
  { name: "Cayman Islands", iso2: "KY", dial: "1345" },
  { name: "Central African Republic", iso2: "CF", dial: "236" },
  { name: "Chad", iso2: "TD", dial: "235" },
  { name: "Chile", iso2: "CL", dial: "56" },
  { name: "China", iso2: "CN", dial: "86" },
  { name: "Colombia", iso2: "CO", dial: "57" },
  { name: "Comoros", iso2: "KM", dial: "269" },
  { name: "Congo (Brazzaville)", iso2: "CG", dial: "242" },
  { name: "Congo (Kinshasa)", iso2: "CD", dial: "243" },
  { name: "Cook Islands", iso2: "CK", dial: "682" },
  { name: "Costa Rica", iso2: "CR", dial: "506" },
  { name: "Côte d'Ivoire", iso2: "CI", dial: "225" },
  { name: "Croatia", iso2: "HR", dial: "385" },
  { name: "Cuba", iso2: "CU", dial: "53" },
  { name: "Curaçao", iso2: "CW", dial: "599" },
  { name: "Cyprus", iso2: "CY", dial: "357" },
  { name: "Czechia", iso2: "CZ", dial: "420" },
  { name: "Denmark", iso2: "DK", dial: "45" },
  { name: "Djibouti", iso2: "DJ", dial: "253" },
  { name: "Dominica", iso2: "DM", dial: "1767" },
  { name: "Dominican Republic", iso2: "DO", dial: "1809" },
  { name: "Ecuador", iso2: "EC", dial: "593" },
  { name: "Egypt", iso2: "EG", dial: "20" },
  { name: "El Salvador", iso2: "SV", dial: "503" },
  { name: "Equatorial Guinea", iso2: "GQ", dial: "240" },
  { name: "Eritrea", iso2: "ER", dial: "291" },
  { name: "Estonia", iso2: "EE", dial: "372" },
  { name: "Eswatini", iso2: "SZ", dial: "268" },
  { name: "Ethiopia", iso2: "ET", dial: "251" },
  { name: "Faroe Islands", iso2: "FO", dial: "298" },
  { name: "Fiji", iso2: "FJ", dial: "679" },
  { name: "Finland", iso2: "FI", dial: "358" },
  { name: "France", iso2: "FR", dial: "33" },
  { name: "French Guiana", iso2: "GF", dial: "594" },
  { name: "French Polynesia", iso2: "PF", dial: "689" },
  { name: "Gabon", iso2: "GA", dial: "241" },
  { name: "Gambia", iso2: "GM", dial: "220" },
  { name: "Georgia", iso2: "GE", dial: "995" },
  { name: "Germany", iso2: "DE", dial: "49" },
  { name: "Ghana", iso2: "GH", dial: "233" },
  { name: "Gibraltar", iso2: "GI", dial: "350" },
  { name: "Greece", iso2: "GR", dial: "30" },
  { name: "Greenland", iso2: "GL", dial: "299" },
  { name: "Grenada", iso2: "GD", dial: "1473" },
  { name: "Guadeloupe", iso2: "GP", dial: "590" },
  { name: "Guam", iso2: "GU", dial: "1671" },
  { name: "Guatemala", iso2: "GT", dial: "502" },
  { name: "Guernsey", iso2: "GG", dial: "44" },
  { name: "Guinea", iso2: "GN", dial: "224" },
  { name: "Guinea-Bissau", iso2: "GW", dial: "245" },
  { name: "Guyana", iso2: "GY", dial: "592" },
  { name: "Haiti", iso2: "HT", dial: "509" },
  { name: "Honduras", iso2: "HN", dial: "504" },
  { name: "Hong Kong", iso2: "HK", dial: "852" },
  { name: "Hungary", iso2: "HU", dial: "36" },
  { name: "Iceland", iso2: "IS", dial: "354" },
  { name: "India", iso2: "IN", dial: "91" },
  { name: "Indonesia", iso2: "ID", dial: "62" },
  { name: "Iran", iso2: "IR", dial: "98" },
  { name: "Iraq", iso2: "IQ", dial: "964" },
  { name: "Ireland", iso2: "IE", dial: "353" },
  { name: "Isle of Man", iso2: "IM", dial: "44" },
  { name: "Israel", iso2: "IL", dial: "972" },
  { name: "Italy", iso2: "IT", dial: "39", primary: true },
  { name: "Jamaica", iso2: "JM", dial: "1876" },
  { name: "Japan", iso2: "JP", dial: "81" },
  { name: "Jersey", iso2: "JE", dial: "44" },
  { name: "Jordan", iso2: "JO", dial: "962" },
  { name: "Kazakhstan", iso2: "KZ", dial: "7" },
  { name: "Kenya", iso2: "KE", dial: "254" },
  { name: "Kiribati", iso2: "KI", dial: "686" },
  { name: "Kosovo", iso2: "XK", dial: "383" },
  { name: "Kuwait", iso2: "KW", dial: "965" },
  { name: "Kyrgyzstan", iso2: "KG", dial: "996" },
  { name: "Laos", iso2: "LA", dial: "856" },
  { name: "Latvia", iso2: "LV", dial: "371" },
  { name: "Lebanon", iso2: "LB", dial: "961" },
  { name: "Lesotho", iso2: "LS", dial: "266" },
  { name: "Liberia", iso2: "LR", dial: "231" },
  { name: "Libya", iso2: "LY", dial: "218" },
  { name: "Liechtenstein", iso2: "LI", dial: "423" },
  { name: "Lithuania", iso2: "LT", dial: "370" },
  { name: "Luxembourg", iso2: "LU", dial: "352" },
  { name: "Macau", iso2: "MO", dial: "853" },
  { name: "Madagascar", iso2: "MG", dial: "261" },
  { name: "Malawi", iso2: "MW", dial: "265" },
  { name: "Malaysia", iso2: "MY", dial: "60" },
  { name: "Maldives", iso2: "MV", dial: "960" },
  { name: "Mali", iso2: "ML", dial: "223" },
  { name: "Malta", iso2: "MT", dial: "356" },
  { name: "Marshall Islands", iso2: "MH", dial: "692" },
  { name: "Martinique", iso2: "MQ", dial: "596" },
  { name: "Mauritania", iso2: "MR", dial: "222" },
  { name: "Mauritius", iso2: "MU", dial: "230" },
  { name: "Mexico", iso2: "MX", dial: "52" },
  { name: "Micronesia", iso2: "FM", dial: "691" },
  { name: "Moldova", iso2: "MD", dial: "373" },
  { name: "Monaco", iso2: "MC", dial: "377" },
  { name: "Mongolia", iso2: "MN", dial: "976" },
  { name: "Montenegro", iso2: "ME", dial: "382" },
  { name: "Montserrat", iso2: "MS", dial: "1664" },
  { name: "Morocco", iso2: "MA", dial: "212" },
  { name: "Mozambique", iso2: "MZ", dial: "258" },
  { name: "Myanmar", iso2: "MM", dial: "95" },
  { name: "Namibia", iso2: "NA", dial: "264" },
  { name: "Nauru", iso2: "NR", dial: "674" },
  { name: "Nepal", iso2: "NP", dial: "977" },
  { name: "Netherlands", iso2: "NL", dial: "31" },
  { name: "New Caledonia", iso2: "NC", dial: "687" },
  { name: "New Zealand", iso2: "NZ", dial: "64" },
  { name: "Nicaragua", iso2: "NI", dial: "505" },
  { name: "Niger", iso2: "NE", dial: "227" },
  { name: "Nigeria", iso2: "NG", dial: "234" },
  { name: "North Korea", iso2: "KP", dial: "850" },
  { name: "North Macedonia", iso2: "MK", dial: "389" },
  { name: "Northern Mariana Islands", iso2: "MP", dial: "1670" },
  { name: "Norway", iso2: "NO", dial: "47" },
  { name: "Oman", iso2: "OM", dial: "968" },
  { name: "Pakistan", iso2: "PK", dial: "92" },
  { name: "Palau", iso2: "PW", dial: "680" },
  { name: "Palestine", iso2: "PS", dial: "970" },
  { name: "Panama", iso2: "PA", dial: "507" },
  { name: "Papua New Guinea", iso2: "PG", dial: "675" },
  { name: "Paraguay", iso2: "PY", dial: "595" },
  { name: "Peru", iso2: "PE", dial: "51" },
  { name: "Philippines", iso2: "PH", dial: "63" },
  { name: "Poland", iso2: "PL", dial: "48" },
  { name: "Portugal", iso2: "PT", dial: "351" },
  { name: "Puerto Rico", iso2: "PR", dial: "1787" },
  { name: "Qatar", iso2: "QA", dial: "974" },
  { name: "Réunion", iso2: "RE", dial: "262" },
  { name: "Romania", iso2: "RO", dial: "40" },
  { name: "Russia", iso2: "RU", dial: "7", primary: true },
  { name: "Rwanda", iso2: "RW", dial: "250" },
  { name: "Saint Helena", iso2: "SH", dial: "290" },
  { name: "Saint Kitts and Nevis", iso2: "KN", dial: "1869" },
  { name: "Saint Lucia", iso2: "LC", dial: "1758" },
  { name: "Saint Vincent and the Grenadines", iso2: "VC", dial: "1784" },
  { name: "Samoa", iso2: "WS", dial: "685" },
  { name: "San Marino", iso2: "SM", dial: "378" },
  { name: "São Tomé and Príncipe", iso2: "ST", dial: "239" },
  { name: "Saudi Arabia", iso2: "SA", dial: "966" },
  { name: "Senegal", iso2: "SN", dial: "221" },
  { name: "Serbia", iso2: "RS", dial: "381" },
  { name: "Seychelles", iso2: "SC", dial: "248" },
  { name: "Sierra Leone", iso2: "SL", dial: "232" },
  { name: "Singapore", iso2: "SG", dial: "65" },
  { name: "Sint Maarten", iso2: "SX", dial: "1721" },
  { name: "Slovakia", iso2: "SK", dial: "421" },
  { name: "Slovenia", iso2: "SI", dial: "386" },
  { name: "Solomon Islands", iso2: "SB", dial: "677" },
  { name: "Somalia", iso2: "SO", dial: "252" },
  { name: "South Africa", iso2: "ZA", dial: "27" },
  { name: "South Korea", iso2: "KR", dial: "82" },
  { name: "South Sudan", iso2: "SS", dial: "211" },
  { name: "Spain", iso2: "ES", dial: "34" },
  { name: "Sri Lanka", iso2: "LK", dial: "94" },
  { name: "Sudan", iso2: "SD", dial: "249" },
  { name: "Suriname", iso2: "SR", dial: "597" },
  { name: "Sweden", iso2: "SE", dial: "46" },
  { name: "Switzerland", iso2: "CH", dial: "41" },
  { name: "Syria", iso2: "SY", dial: "963" },
  { name: "Taiwan", iso2: "TW", dial: "886" },
  { name: "Tajikistan", iso2: "TJ", dial: "992" },
  { name: "Tanzania", iso2: "TZ", dial: "255" },
  { name: "Thailand", iso2: "TH", dial: "66" },
  { name: "Timor-Leste", iso2: "TL", dial: "670" },
  { name: "Togo", iso2: "TG", dial: "228" },
  { name: "Tonga", iso2: "TO", dial: "676" },
  { name: "Trinidad and Tobago", iso2: "TT", dial: "1868" },
  { name: "Tunisia", iso2: "TN", dial: "216" },
  { name: "Turkey", iso2: "TR", dial: "90" },
  { name: "Turkmenistan", iso2: "TM", dial: "993" },
  { name: "Turks and Caicos Islands", iso2: "TC", dial: "1649" },
  { name: "Tuvalu", iso2: "TV", dial: "688" },
  { name: "Uganda", iso2: "UG", dial: "256" },
  { name: "Ukraine", iso2: "UA", dial: "380" },
  { name: "United Arab Emirates", iso2: "AE", dial: "971" },
  { name: "United Kingdom", iso2: "GB", dial: "44", primary: true },
  { name: "United States", iso2: "US", dial: "1", primary: true },
  { name: "United States Virgin Islands", iso2: "VI", dial: "1340" },
  { name: "Uruguay", iso2: "UY", dial: "598" },
  { name: "Uzbekistan", iso2: "UZ", dial: "998" },
  { name: "Vanuatu", iso2: "VU", dial: "678" },
  { name: "Vatican City", iso2: "VA", dial: "39" },
  { name: "Venezuela", iso2: "VE", dial: "58" },
  { name: "Vietnam", iso2: "VN", dial: "84" },
  { name: "Yemen", iso2: "YE", dial: "967" },
  { name: "Zambia", iso2: "ZM", dial: "260" },
  { name: "Zimbabwe", iso2: "ZW", dial: "263" },
];

// `phone.js` imports from this module, so this module must not import from it.
// That is why the digit strip is repeated here as a private helper.
function toDigits(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).replace(/[^0-9]/g, "") : "";
}

/**
 * Drop accents and lowercase, so a plain-ASCII query matches "Réunion".
 * @param {string} text
 * @returns {string}
 */
function fold(text) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const BY_ISO2 = new Map(COUNTRIES.map((country) => [country.iso2, country]));

// One entry per dial code, pointing at the country a pasted number resolves to.
const BY_DIAL = new Map();
for (const country of COUNTRIES) {
  if (!BY_DIAL.has(country.dial) || country.primary === true) BY_DIAL.set(country.dial, country);
}

const DIAL_CODES = new Set(COUNTRIES.map((country) => country.dial));
const LONGEST_DIAL = Math.max(...[...DIAL_CODES].map((dial) => dial.length));

// Precomputed once, because the search runs on every keystroke.
const SEARCH_INDEX = COUNTRIES.map((country) => ({ country, name: fold(country.name) }));

/**
 * Build the flag emoji from the ISO code, so no flag images are needed.
 * @param {string} iso2 ISO 3166-1 alpha-2 code
 * @returns {string} the flag emoji, or "" when the code is not two letters
 */
export function flagEmoji(iso2) {
  if (typeof iso2 !== "string") return "";
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  const REGIONAL_INDICATOR_A = 0x1f1e6;
  const points = [...code].map((letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - "A".charCodeAt(0));
  return String.fromCodePoint(...points);
}

/**
 * @param {string} iso2 ISO 3166-1 alpha-2 code, in any case
 * @returns {object|null} the country, or null when none matches
 */
export function findByIso2(iso2) {
  if (typeof iso2 !== "string") return null;
  return BY_ISO2.get(iso2.trim().toUpperCase()) ?? null;
}

/**
 * Find the country a dial code belongs to. Where several countries share the
 * code, the one marked `primary` wins.
 * @param {string} dial dial code, with or without a plus sign
 * @returns {object|null} the country, or null when the code is unassigned
 */
export function findByDial(dial) {
  const digits = toDigits(dial);
  return digits === "" ? null : (BY_DIAL.get(digits) ?? null);
}

/**
 * Filter the country list for the selector's search box. Results are ranked:
 * an exact ISO code first, then a name that starts with the query, then a
 * dial code that starts with the query, then a name that contains it.
 * @param {string} query free text: a name, a dial code, or an ISO code
 * @returns {object[]} matching countries, best match first
 */
export function searchCountries(query) {
  const raw = typeof query === "string" ? query.trim() : "";
  if (raw === "") return COUNTRIES.slice();

  const text = fold(raw);
  const digits = toDigits(raw);
  const ranked = [];

  for (const entry of SEARCH_INDEX) {
    let rank = -1;
    if (text.length === 2 && text === entry.country.iso2.toLowerCase()) rank = 0;
    else if (entry.name.startsWith(text)) rank = 1;
    else if (digits !== "" && entry.country.dial.startsWith(digits)) rank = 2;
    else if (entry.name.includes(text)) rank = 3;
    if (rank !== -1) ranked.push({ rank, country: entry.country });
  }

  // Array.prototype.sort is stable, so countries keep their alphabetical order
  // inside each rank.
  ranked.sort((a, b) => a.rank - b.rank);
  return ranked.map((item) => item.country);
}

/**
 * Split an international number into its dial code and the rest. The longest
 * matching dial code wins, so "+1 876" resolves to Jamaica, not the bare "+1".
 * A leading plus sign, exit zeros and separators are all ignored.
 * @param {string} input an international number in any common writing
 * @returns {{dial: string, national: string}|null} null when no code matches
 */
export function splitDialCode(input) {
  const digits = toDigits(input).replace(/^0+/, "");
  if (digits === "") return null;
  for (let length = Math.min(LONGEST_DIAL, digits.length); length >= 1; length--) {
    const candidate = digits.slice(0, length);
    if (DIAL_CODES.has(candidate)) return { dial: candidate, national: digits.slice(length) };
  }
  return null;
}

/**
 * Read the country out of a browser locale, to preselect the visitor's own
 * country. When the locale carries no region, the likely one is inferred.
 * @param {string} locale a BCP 47 language tag, e.g. "es-ES"
 * @returns {string|null} an ISO 3166-1 alpha-2 code, or null
 */
export function regionFromLocale(locale) {
  if (typeof locale !== "string" || locale.trim() === "") return null;
  const tag = locale.trim();
  try {
    const parsed = new Intl.Locale(tag);
    const region = parsed.region ?? parsed.maximize().region;
    return region ? region.toUpperCase() : null;
  } catch {
    const match = /^[a-z]{2,3}[-_]([a-z]{2})(?:[-_]|$)/i.exec(tag);
    return match ? match[1].toUpperCase() : null;
  }
}
