// Every word the page says, in Catalan, Spanish and English.
//
// The catalogue is one flat table of keys. Each key holds one entry per
// language, so a translation sits next to the text it translates.
// `i18n.test.js` fails when a key misses a language or a placeholder.
//
// Placeholders are written `{name}` and filled by `translate`.

export const DEFAULT_LANGUAGE = "en";

/** The languages the page offers, in the order the picker shows them. */
export const LANGUAGES = [
  { code: "ca", label: "CA", name: "Català" },
  { code: "es", label: "ES", name: "Español" },
  { code: "en", label: "EN", name: "English" },
];

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code);

export const MESSAGES = {
  // --- the page ----------------------------------------------------------------
  "app.name": { ca: "Amic invisible", es: "Amigo invisible", en: "Secret Santa" },
  "app.documentTitle": {
    ca: "Amic invisible · Sorteig amb enllaç",
    es: "Amigo invisible · Sorteo con enlace",
    en: "Secret Santa · Draw names with one link",
  },
  "app.about": {
    ca: "Fes el sorteig de l'amic invisible amb restriccions i comparteix un sol enllaç. Cadascú tria qui és i descobreix només a qui li fa el regal.",
    es: "Haz el sorteo del amigo invisible con restricciones y comparte un solo enlace. Cada persona elige quién es y descubre solo a quién le hace el regalo.",
    en: "Draw Secret Santa names with exclusions and share one link. Each person picks who they are and sees only who they give a present to.",
  },
  "app.language": { ca: "Idioma", es: "Idioma", en: "Language" },
  "mode.label": { ca: "Mode", es: "Modo", en: "Mode" },
  "mode.create": { ca: "Crear", es: "Crear", en: "Create" },
  "mode.receive": { ca: "Rebre sorpresa", es: "Recibir sorpresa", en: "Get my surprise" },

  // --- create ------------------------------------------------------------------
  "create.heading": { ca: "Organitza el sorteig", es: "Organiza el sorteo", en: "Set up the draw" },
  "create.intro": {
    ca: "Afegeix les persones, marca qui no pot regalar a qui i comparteix l'enllaç.",
    es: "Añade a las personas, marca quién no puede regalar a quién y comparte el enlace.",
    en: "Add the people, mark who may not give to whom, and share the link.",
  },
  "create.titleLabel": { ca: "Nom de l'esdeveniment (opcional)", es: "Nombre del evento (opcional)", en: "Event name (optional)" },
  "create.titlePlaceholder": { ca: "Amic invisible de Nadal", es: "Amigo invisible de Navidad", en: "Christmas Secret Santa" },
  "create.peopleLabel": { ca: "Qui hi participa?", es: "¿Quién participa?", en: "Who is taking part?" },
  "create.namePlaceholder": {
    ca: "Escriu un nom i prem Intro",
    es: "Escribe un nombre y pulsa Intro",
    en: "Type a name and press Enter",
  },
  "create.nameHint": {
    ca: "També pots enganxar una llista separada per comes o salts de línia.",
    es: "También puedes pegar una lista separada por comas o saltos de línea.",
    en: "You can also paste a list separated by commas or new lines.",
  },
  "create.add": { ca: "Afegir", es: "Añadir", en: "Add" },
  "create.empty": {
    ca: "Encara no hi ha ningú. Comença per tu!",
    es: "Todavía no hay nadie. ¡Empieza por ti!",
    en: "Nobody yet. Start with yourself!",
  },
  "create.countOne": { ca: "1 persona", es: "1 persona", en: "1 person" },
  "create.count": { ca: "{count} persones", es: "{count} personas", en: "{count} people" },
  "create.remove": { ca: "Treure {name}", es: "Quitar a {name}", en: "Remove {name}" },
  "create.noRules": { ca: "Pot regalar a tothom", es: "Puede regalar a cualquiera", en: "Can give to anyone" },
  "create.rulesSummary": { ca: "No pot regalar a: {list}", es: "No puede regalar a: {list}", en: "Can't give to: {list}" },
  "create.editRules": { ca: "Restriccions", es: "Restricciones", en: "Exclusions" },
  "create.rulesHelp": {
    ca: "Toca les persones a qui {name} no pot fer el regal:",
    es: "Toca a las personas a las que {name} no puede hacer el regalo:",
    en: "Tap the people {name} must not give a present to:",
  },
  "create.mutual": {
    ca: "Restriccions en les dues direccions (ideal per a parelles)",
    es: "Restricciones en las dos direcciones (ideal para parejas)",
    en: "Exclusions work both ways (handy for couples)",
  },
  "create.draw": { ca: "Fer el sorteig", es: "Hacer el sorteo", en: "Draw names" },
  "create.needMore": {
    ca: "Calen almenys 3 persones.",
    es: "Hacen falta al menos 3 personas.",
    en: "You need at least 3 people.",
  },
  "create.blockedGiver": {
    ca: "{list} no pot regalar a ningú. Treu alguna restricció.",
    es: "{list} no puede regalar a nadie. Quita alguna restricción.",
    en: "{list} has nobody left to give to. Remove an exclusion.",
  },
  "create.blockedReceiver": {
    ca: "Ningú pot regalar a {list}. Treu alguna restricció.",
    es: "Nadie puede regalar a {list}. Quita alguna restricción.",
    en: "Nobody may give to {list}. Remove an exclusion.",
  },
  "create.impossible": {
    ca: "Amb aquestes restriccions no hi ha cap sorteig possible. Prova de treure'n alguna.",
    es: "Con estas restricciones no hay ningún sorteo posible. Prueba a quitar alguna.",
    en: "No draw fits these exclusions. Try removing some.",
  },
  "create.doneTitle": { ca: "Sorteig fet!", es: "¡Sorteo hecho!", en: "Names drawn!" },
  "create.doneBody": {
    ca: "Envia aquest enllaç al grup. Cadascú triarà qui és i veurà només el seu destinatari.",
    es: "Envía este enlace al grupo. Cada persona elegirá quién es y verá solo a su destinatario.",
    en: "Send this link to the group. Each person picks who they are and sees only their own match.",
  },
  "create.linkLabel": { ca: "Enllaç per compartir", es: "Enlace para compartir", en: "Link to share" },
  "create.copy": { ca: "Copiar", es: "Copiar", en: "Copy" },
  "create.copied": { ca: "Copiat!", es: "¡Copiado!", en: "Copied!" },
  "create.share": { ca: "Compartir", es: "Compartir", en: "Share" },
  "create.shareText": {
    ca: "Obre l'enllaç, tria qui ets i descobreix a qui fas el regal 🎁",
    es: "Abre el enlace, elige quién eres y descubre a quién haces el regalo 🎁",
    en: "Open the link, pick who you are and find out who you give a present to 🎁",
  },
  "create.redraw": { ca: "Tornar a sortejar", es: "Volver a sortear", en: "Draw again" },
  "create.redrawNote": {
    ca: "Cada sorteig fa servir una llavor nova, així que el resultat canvia i l'enllaç antic deixa de valer.",
    es: "Cada sorteo usa una semilla nueva, así que el resultado cambia y el enlace antiguo deja de valer.",
    en: "Each draw uses a new seed, so the result changes and the old link no longer matches.",
  },
  "create.open": { ca: "Obrir com a participant", es: "Abrir como participante", en: "Open as a participant" },
  "create.stale": {
    ca: "Has canviat la llista. Torna a fer el sorteig per obtenir un enllaç nou.",
    es: "Has cambiado la lista. Vuelve a hacer el sorteo para obtener un enlace nuevo.",
    en: "You changed the list. Draw again to get a new link.",
  },
  "create.seed": { ca: "Llavor: {seed}", es: "Semilla: {seed}", en: "Seed: {seed}" },

  // --- receive -----------------------------------------------------------------
  "receive.whoAreYou": { ca: "Qui ets?", es: "¿Quién eres?", en: "Who are you?" },
  "receive.pickHint": {
    ca: "Toca el teu nom. Només el teu, eh? 🤫",
    es: "Toca tu nombre. Solo el tuyo, ¿eh? 🤫",
    en: "Tap your own name. Only yours! 🤫",
  },
  "receive.warningTitle": { ca: "Ets {name}?", es: "¿Eres {name}?", en: "Are you {name}?" },
  "receive.warningBody": {
    ca: "Ara veuràs a qui fa el regal {name}. Continua només si ets {name}: si no, pots espatllar la sorpresa de tothom.",
    es: "Ahora verás a quién le hace el regalo {name}. Sigue solo si eres {name}: si no, puedes arruinar la sorpresa de todos.",
    en: "You are about to see who {name} gives a present to. Go on only if you are {name}: otherwise you may ruin the surprise for everyone.",
  },
  "receive.confirm": { ca: "Sí, soc {name}", es: "Sí, soy {name}", en: "Yes, I am {name}" },
  "receive.cancel": { ca: "No, tornar", es: "No, volver", en: "No, go back" },
  "receive.hello": { ca: "Hola, {name}!", es: "¡Hola, {name}!", en: "Hi, {name}!" },
  "receive.tapGift": { ca: "Toca el regal per obrir-lo", es: "Toca el regalo para abrirlo", en: "Tap the present to open it" },
  "receive.giftLabel": { ca: "Obrir el regal", es: "Abrir el regalo", en: "Open the present" },
  "receive.youGiveTo": { ca: "Fas el regal a…", es: "Le haces el regalo a…", en: "You give a present to…" },
  "receive.keepSecret": {
    ca: "Guarda el secret! Amaga'l abans de deixar el mòbil a ningú. Si tornes a obrir l'enllaç, et portarà directament aquí.",
    es: "¡Guarda el secreto! Ocúltalo antes de dejarle el móvil a nadie. Si vuelves a abrir el enlace, te traerá directamente aquí.",
    en: "Keep it secret! Hide it before you hand your phone to anyone. Open the link again and it brings you straight back here.",
  },
  "receive.hide": { ca: "Amagar-ho", es: "Ocultarlo", en: "Hide it" },
  "receive.remembered": {
    ca: "Aquest dispositiu recorda que ets {name}.",
    es: "Este dispositivo recuerda que eres {name}.",
    en: "This device remembers that you are {name}.",
  },
  "receive.notMe": {
    ca: "Ho sento molt, m'he equivocat i no tornarà a passar. Deixa'm canviar qui soc",
    es: "Lo siento mucho, me he equivocado y no volverá a ocurrir. Déjame cambiar quién soy",
    en: "I'm so sorry, I picked the wrong name and it won't happen again. Let me change who I am",
  },
  "receive.noEvent": {
    ca: "Obre l'enllaç que t'ha enviat qui organitza el sorteig, o enganxa'l aquí.",
    es: "Abre el enlace que te ha enviado quien organiza el sorteo, o pégalo aquí.",
    en: "Open the link the organiser sent you, or paste it here.",
  },
  "receive.pastePlaceholder": { ca: "Enganxa l'enllaç aquí", es: "Pega el enlace aquí", en: "Paste the link here" },
  "receive.go": { ca: "Obrir", es: "Abrir", en: "Open" },
  "receive.badLink": {
    ca: "Aquest enllaç no és d'un sorteig vàlid. Demana'n un de nou.",
    es: "Este enlace no es de un sorteo válido. Pide uno nuevo.",
    en: "This link is not a valid draw. Ask for a new one.",
  },
  "receive.impossible": {
    ca: "Aquest sorteig no té cap resultat possible. Demana a qui l'organitza que el refaci.",
    es: "Este sorteo no tiene ningún resultado posible. Pide a quien lo organiza que lo rehaga.",
    en: "This draw has no possible result. Ask the organiser to redo it.",
  },
  "receive.edit": {
    ca: "Organitzes tu? Edita la llista i fes un sorteig nou",
    es: "¿Organizas tú? Edita la lista y haz un sorteo nuevo",
    en: "Organising? Edit the list and make a new draw",
  },

  // --- footer ------------------------------------------------------------------
  "footer.report": { ca: "Informar d'un problema", es: "Informar de un problema", en: "Report a problem" },
  "footer.reportNote": {
    ca: "(cal un compte de GitHub i l'informe és públic)",
    es: "(hace falta una cuenta de GitHub y el informe es público)",
    en: "(needs a GitHub account, and the report is public)",
  },
  "ui.deployed": {
    ca: "Publicat el {date} per la pull request {pr}.",
    es: "Publicado el {date} por la pull request {pr}.",
    en: "Deployed on {date} by pull request {pr}.",
  },
  "ui.deployedUnknown": {
    ca: "Aquesta còpia no porta segell de publicació. Mira l'{history}.",
    es: "Esta copia no lleva sello de publicación. Mira el {history}.",
    en: "This copy carries no deploy stamp. See the {history}.",
  },
  "ui.deployHistory": { ca: "historial de canvis", es: "historial de cambios", en: "change history" },
};

/**
 * Pick the page language from the system languages (`navigator.languages`).
 * Valencian (`ca-ES-valencia`) is Catalan. Falls back to English.
 */
export function detectLanguage(systemLanguages) {
  for (const tag of systemLanguages ?? []) {
    const base = String(tag).toLowerCase().split("-")[0];
    if (LANGUAGE_CODES.includes(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

/** Look up a text and fill its `{placeholders}`. */
export function translate(lang, key, params = {}) {
  const entry = MESSAGES[key];
  const text = entry?.[lang] ?? entry?.[DEFAULT_LANGUAGE] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
