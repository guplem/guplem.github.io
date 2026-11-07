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

  // --- create: the editor --------------------------------------------------------
  "create.heading": { ca: "Organitza el teu amic invisible", es: "Organiza tu amigo invisible", en: "Organise your Secret Santa" },
  "create.intro": {
    ca: "Escriu els noms, marca qui no pot regalar a qui i genera l'enllaç per al grup.",
    es: "Escribe los nombres, marca quién no puede regalar a quién y genera el enlace para el grupo.",
    en: "Type the names, mark who may not give to whom, and make the link for the group.",
  },
  "create.clear": { ca: "Començar de zero", es: "Empezar de cero", en: "Start over" },
  "create.clearConfirm": { ca: "Segur? Toca un altre cop", es: "¿Seguro? Toca otra vez", en: "Sure? Tap again" },
  "create.step1": { ca: "1. Qui hi participa?", es: "1. ¿Quién participa?", en: "1. Who is taking part?" },
  "create.namePlaceholder": {
    ca: "Escriu un nom",
    es: "Escribe un nombre",
    en: "Type a name",
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
  "create.step2": { ca: "2. Detalls (opcional)", es: "2. Detalles (opcional)", en: "2. Details (optional)" },
  "create.titleLabel": { ca: "Nom de l'esdeveniment", es: "Nombre del evento", en: "Event name" },
  "create.titlePlaceholder": { ca: "Amic invisible de Nadal", es: "Amigo invisible de Navidad", en: "Christmas Secret Santa" },
  "create.noteLabel": {
    ca: "Nota que es veurà després de descobrir el nom",
    es: "Nota que se verá después de descubrir el nombre",
    en: "Note shown after the name is revealed",
  },
  "create.notePlaceholder": {
    ca: "Pressupost màxim 20 €. Ens veiem el 24 a casa l'Anna!",
    es: "Presupuesto máximo 20 €. ¡Nos vemos el 24 en casa de Anna!",
    en: "Budget up to 20 €. See you on the 24th at Anna's!",
  },
  "create.noteHint": {
    ca: "Idees: pressupost, data, lloc o una broma.",
    es: "Ideas: presupuesto, fecha, lugar o una broma.",
    en: "Ideas: budget, date, place, or a joke.",
  },
  "create.generate": { ca: "Generar l'enllaç", es: "Generar el enlace", en: "Make the link" },
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

  // --- create: the share screen --------------------------------------------------
  "share.title": { ca: "Llest! Aquest és el teu enllaç", es: "¡Listo! Este es tu enlace", en: "Done! Here is your link" },
  "share.intro": {
    ca: "Envia'l al grup. Cadascú triarà qui és i veurà només a qui li fa el regal.",
    es: "Envíalo al grupo. Cada persona elegirá quién es y verá solo a quién le hace el regalo.",
    en: "Send it to the group. Each person picks who they are and sees only who they give to.",
  },
  "share.linkLabel": { ca: "Enllaç del sorteig", es: "Enlace del sorteo", en: "Link to the draw" },
  "share.copyLink": { ca: "Copiar l'enllaç", es: "Copiar el enlace", en: "Copy the link" },
  "share.withText": {
    ca: "O copia'l amb un missatge per al grup",
    es: "O cópialo con un mensaje para el grupo",
    en: "Or copy it with a message for the group",
  },
  "share.messageLanguage": { ca: "Idioma del missatge", es: "Idioma del mensaje", en: "Message language" },
  "share.copyMessage": { ca: "Copiar el missatge", es: "Copiar el mensaje", en: "Copy the message" },
  "share.copied": {
    ca: "Copiat! Ara enganxa'l al xat del grup, o envia'l directament:",
    es: "¡Copiado! Ahora pégalo en el chat del grupo, o envíalo directamente:",
    en: "Copied! Now paste it in the group chat, or send it straight away:",
  },
  "share.copiedShort": { ca: "Copiat!", es: "¡Copiado!", en: "Copied!" },
  "share.whatsapp": { ca: "WhatsApp", es: "WhatsApp", en: "WhatsApp" },
  "share.more": { ca: "Altres apps", es: "Otras apps", en: "Other apps" },
  "share.edit": { ca: "Editar el sorteig", es: "Editar el sorteo", en: "Edit the draw" },
  "share.preview": { ca: "Provar-ho com a participant", es: "Probarlo como participante", en: "Try it as a participant" },
  "share.redraw": { ca: "Tornar a sortejar", es: "Volver a sortear", en: "Draw again" },
  "share.redrawNote": {
    ca: "Tornar a sortejar canvia el resultat, i l'enllaç antic deixa de valer.",
    es: "Volver a sortear cambia el resultado, y el enlace antiguo deja de valer.",
    en: "Drawing again changes the result, and the old link stops matching.",
  },
  "share.message": {
    ca: "🎁 {title}\nJa tenim el sorteig de l'amic invisible! Obre l'enllaç, toca el teu nom i descobreix a qui fas el regal. No miris el de ningú altre 🤫",
    es: "🎁 {title}\n¡Ya tenemos el sorteo del amigo invisible! Abre el enlace, toca tu nombre y descubre a quién le haces el regalo. No mires el de nadie más 🤫",
    en: "🎁 {title}\nThe Secret Santa draw is ready! Open the link, tap your name and find out who you give a present to. Don't peek at anyone else's 🤫",
  },

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
  "receive.remembered": {
    ca: "Aquest dispositiu recorda que ets {name}.",
    es: "Este dispositivo recuerda que eres {name}.",
    en: "This device remembers that you are {name}.",
  },
  "receive.tapGift": { ca: "Toca el regal per obrir-lo", es: "Toca el regalo para abrirlo", en: "Tap the present to open it" },
  "receive.giftLabel": { ca: "Obrir el regal", es: "Abrir el regalo", en: "Open the present" },
  "receive.youGiveTo": { ca: "Fas el regal a…", es: "Le haces el regalo a…", en: "You give a present to…" },
  "receive.noteLabel": { ca: "Nota de l'organització", es: "Nota de la organización", en: "A note from the organiser" },
  "receive.keepSecret": {
    ca: "Guarda el secret! Si tornes a obrir l'enllaç, et portarà directament aquí.",
    es: "¡Guarda el secreto! Si vuelves a abrir el enlace, te traerá directamente aquí.",
    en: "Keep it secret! Open the link again and it brings you straight back here.",
  },
  "receive.hide": { ca: "Amagar-ho", es: "Ocultarlo", en: "Hide it" },
  "receive.notMe": {
    ca: "Ho sento molt, m'he equivocat i no tornarà a passar. Deixa'm canviar qui soc",
    es: "Lo siento mucho, me he equivocado y no volverá a ocurrir. Déjame cambiar quién soy",
    en: "I'm so sorry, I picked the wrong name and it won't happen again. Let me change who I am",
  },
  "receive.badLink": {
    ca: "Aquest enllaç no és d'un sorteig vàlid. Demana'n un de nou a qui l'organitza.",
    es: "Este enlace no es de un sorteo válido. Pide uno nuevo a quien lo organiza.",
    en: "This link is not a valid draw. Ask the organiser for a new one.",
  },
  "receive.impossible": {
    ca: "Aquest sorteig no té cap resultat possible. Demana a qui l'organitza que el refaci.",
    es: "Este sorteo no tiene ningún resultado posible. Pide a quien lo organiza que lo rehaga.",
    en: "This draw has no possible result. Ask the organiser to redo it.",
  },
  "receive.createOwn": {
    ca: "Vols organitzar el teu propi amic invisible? Toca aquí",
    es: "¿Quieres organizar tu propio amigo invisible? Toca aquí",
    en: "Want to organise your own Secret Santa? Tap here",
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
