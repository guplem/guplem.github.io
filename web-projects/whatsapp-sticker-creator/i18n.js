// Every word the page says, in English and Spanish.
//
// One catalogue, one key per string. Nothing else in the project holds a
// sentence, which is what makes the tool speak both languages rather than
// English with a translated shell.
//
// That matters most for the rule messages. `spec.js` reports a broken rule as
// a name and its numbers, never as a sentence, so "this sticker is 140KB and
// the limit is 100KB" is written here, in both languages, from those numbers.
// The alternative, building the sentence where the rule is checked, is what
// leaves a tool half translated. sudoku-screenshot-coach ADR 0004 records the
// same decision for the same reason.
//
// A missing key renders as the key itself, so it shows up at a glance instead
// of leaving a blank space on the page.

export const DEFAULT_LANGUAGE = "en";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code);

export const MESSAGES = {
  // The page itself.
  "ui.title": {
    en: "Sticker Studio for WhatsApp",
    es: "Estudio de stickers para WhatsApp",
  },
  "ui.tagline": {
    en: "Turn a photo into a WhatsApp sticker. Everything happens on your device.",
    es: "Convierte una foto en un sticker de WhatsApp. Todo ocurre en tu dispositivo.",
  },
  "ui.language": { en: "Language", es: "Idioma" },
  "ui.privacy": {
    en: "Your pictures never leave your device. This page makes no network requests at all.",
    es: "Tus imágenes nunca salen de tu dispositivo. Esta página no hace ninguna petición de red.",
  },
  "ui.back": { en: "All web projects", es: "Todos los proyectos web" },
  "ui.deployed": {
    en: "Deployed on {date} by pull request {pr}.",
    es: "Publicado el {date} por la pull request {pr}.",
  },
  "ui.deployedUnknown": {
    en: "Built from the main branch. See the {history}.",
    es: "Creado desde la rama main. Consulta el {history}.",
  },
  "ui.deployHistory": { en: "change history", es: "historial de cambios" },

  // Steps.
  "step.pick": { en: "1. Pick a picture", es: "1. Elige una imagen" },
  "step.edit": { en: "2. Make the sticker", es: "2. Crea el sticker" },
  "step.details": { en: "3. Tag it", es: "3. Etiquétalo" },
  "step.check": { en: "4. Check it", es: "4. Compruébalo" },
  "step.pack": { en: "5. Build a pack", es: "5. Crea un paquete" },

  // Picking a picture.
  "pick.button": { en: "Choose a picture", es: "Elegir una imagen" },
  "pick.drop": {
    en: "Drop a picture here, paste one, or choose a file.",
    es: "Suelta una imagen aquí, pégala o elige un archivo.",
  },
  "pick.hint": {
    en: "A picture with the subject well away from the edges works best.",
    es: "Funciona mejor una imagen con el motivo lejos de los bordes.",
  },
  "pick.another": { en: "Use another picture", es: "Usar otra imagen" },

  // Tools.
  "tool.cutout": { en: "Cut out", es: "Recortar" },
  "tool.crop": { en: "Frame", es: "Encuadrar" },
  "tool.colour": { en: "Colour", es: "Color" },
  "tool.text": { en: "Text", es: "Texto" },
  "tool.frames": { en: "Animate", es: "Animar" },
  "tool.finish": { en: "Finish", es: "Acabado" },

  // Cutting out the background.
  "cutout.auto": { en: "Find the background", es: "Buscar el fondo" },
  "cutout.autoHint": {
    en: "Looks for the background at the edges of the picture, then follows it inwards.",
    es: "Busca el fondo en los bordes de la imagen y lo sigue hacia dentro.",
  },
  "cutout.tolerance": { en: "How similar", es: "Similitud" },
  "cutout.toleranceHint": {
    en: "How close in colour two pixels must be to count as the same background.",
    es: "Cuánto se deben parecer dos píxeles para contar como el mismo fondo.",
  },
  "cutout.edgeTolerance": { en: "How far", es: "Alcance" },
  "cutout.edgeToleranceHint": {
    en: "How far the background may drift from the colours at the edges.",
    es: "Cuánto puede alejarse el fondo de los colores de los bordes.",
  },
  "cutout.feather": { en: "Soft edge", es: "Borde suave" },
  "cutout.brush": { en: "Brush", es: "Pincel" },
  "cutout.erase": { en: "Erase", es: "Borrar" },
  "cutout.restore": { en: "Bring back", es: "Recuperar" },
  "cutout.wand": { en: "Pick a colour", es: "Elegir un color" },
  "cutout.brushSize": { en: "Brush size", es: "Tamaño del pincel" },
  "cutout.softness": { en: "Brush softness", es: "Suavidad del pincel" },
  "cutout.brushHint": {
    en: "Paint on the picture to erase or bring back part of it.",
    es: "Pinta sobre la imagen para borrar o recuperar una parte.",
  },
  "cutout.wandHint": {
    en: "Tap a colour to erase everything like it.",
    es: "Toca un color para borrar todo lo que se le parezca.",
  },
  "cutout.refine": { en: "Tidy the edge", es: "Afinar el borde" },
  "cutout.refineHint": {
    en: "Reads the blurred pixels at the edge, so no ring of background colour is left behind.",
    es: "Lee los píxeles difusos del borde para no dejar un halo del color del fondo.",
  },
  "cutout.undo": { en: "Undo", es: "Deshacer" },
  "cutout.redo": { en: "Redo", es: "Rehacer" },
  "cutout.reset": { en: "Start again", es: "Empezar de nuevo" },
  "cutout.keepAll": { en: "Keep the whole picture", es: "Mantener toda la imagen" },

  // Framing.
  "crop.fitContent": { en: "Fit the sticker to the drawing", es: "Ajustar el sticker al dibujo" },
  "crop.fitContentHint": {
    en: "Makes what is left as large as the sticker allows, and keeps a clear margin.",
    es: "Hace lo que queda tan grande como permite el sticker y deja un margen libre.",
  },
  "crop.fitWhole": { en: "Fit the whole picture", es: "Ajustar toda la imagen" },
  "crop.fillSquare": { en: "Fill the square", es: "Rellenar el cuadrado" },
  "crop.padding": { en: "Margin", es: "Margen" },
  "crop.paddingHint": {
    en: "Clear space around the drawing. WhatsApp suggests room for an 8 pixel outline.",
    es: "Espacio libre alrededor del dibujo. WhatsApp sugiere sitio para un contorno de 8 píxeles.",
  },
  "crop.zoom": { en: "Zoom", es: "Zoom" },
  "crop.flip": { en: "Flip", es: "Voltear" },
  "crop.rotate": { en: "Turn", es: "Girar" },

  // Colour.
  "colour.preset": { en: "Look", es: "Estilo" },
  "colour.brightness": { en: "Brightness", es: "Brillo" },
  "colour.contrast": { en: "Contrast", es: "Contraste" },
  "colour.saturation": { en: "Colour strength", es: "Intensidad del color" },
  "colour.temperature": { en: "Warmth", es: "Calidez" },
  "colour.reset": { en: "Back to normal", es: "Volver a lo normal" },
  "filter.none": { en: "None", es: "Ninguno" },
  "filter.punch": { en: "Punch", es: "Fuerza" },
  "filter.soft": { en: "Soft", es: "Suave" },
  "filter.mono": { en: "Grey", es: "Gris" },
  "filter.noir": { en: "Noir", es: "Negro" },
  "filter.sunny": { en: "Sunny", es: "Soleado" },
  "filter.cool": { en: "Cool", es: "Frío" },
  "filter.fade": { en: "Faded", es: "Desvaído" },
  "filter.poster": { en: "Poster", es: "Cartel" },

  // Text.
  "text.add": { en: "Add text", es: "Añadir texto" },
  "text.remove": { en: "Remove this text", es: "Quitar este texto" },
  "text.placeholder": { en: "Type here", es: "Escribe aquí" },
  "text.none": { en: "No text yet.", es: "Todavía no hay texto." },
  "text.style": { en: "Style", es: "Estilo" },
  "text.size": { en: "Size", es: "Tamaño" },
  "text.colour": { en: "Text colour", es: "Color del texto" },
  "text.backgroundColour": { en: "Background colour", es: "Color del fondo" },
  "text.align": { en: "Line up", es: "Alinear" },
  "text.alignLeft": { en: "Left", es: "Izquierda" },
  "text.alignCentre": { en: "Middle", es: "Centro" },
  "text.alignRight": { en: "Right", es: "Derecha" },
  "text.rotation": { en: "Tilt", es: "Inclinación" },
  "text.layer": { en: "Text {number}", es: "Texto {number}" },
  "text.dragHint": {
    en: "Drag the text on the sticker to move it.",
    es: "Arrastra el texto sobre el sticker para moverlo.",
  },
  "text.plain": { en: "Plain", es: "Simple" },
  "text.outlined": { en: "Outlined", es: "Contorno" },
  "text.shadow": { en: "Shadow", es: "Sombra" },
  "text.highlight": { en: "Highlight", es: "Resaltado" },
  "text.marker": { en: "Marker", es: "Rotulador" },
  "text.card": { en: "Card", es: "Tarjeta" },
  "text.night": { en: "Night", es: "Noche" },

  // Animation.
  "frames.add": { en: "Add a frame", es: "Añadir un fotograma" },
  "frames.addHint": {
    en: "Every frame is edited on its own. Add pictures to build the animation.",
    es: "Cada fotograma se edita por separado. Añade imágenes para crear la animación.",
  },
  "frames.remove": { en: "Remove this frame", es: "Quitar este fotograma" },
  "frames.duplicate": { en: "Copy this frame", es: "Copiar este fotograma" },
  "frames.frame": { en: "Frame {number}", es: "Fotograma {number}" },
  "frames.duration": { en: "Time on screen", es: "Tiempo en pantalla" },
  "frames.durationValue": { en: "{ms} ms", es: "{ms} ms" },
  "frames.sameForAll": { en: "Same time for every frame", es: "El mismo tiempo para todos" },
  "frames.speed": { en: "Speed", es: "Velocidad" },
  "frames.play": { en: "Play", es: "Reproducir" },
  "frames.pause": { en: "Pause", es: "Pausar" },
  "frames.pingPong": { en: "Play back and forth", es: "Reproducir de ida y vuelta" },
  "frames.total": {
    en: "{seconds} s in total, of the 10 s WhatsApp allows.",
    es: "{seconds} s en total, de los 10 s que permite WhatsApp.",
  },
  "frames.count": { en: "{count} of {max} frames", es: "{count} de {max} fotogramas" },
  "frames.firstFrameHint": {
    en: "WhatsApp shows the first frame when the animation stops, so put the whole picture there.",
    es: "WhatsApp muestra el primer fotograma cuando la animación se detiene, así que pon ahí la imagen completa.",
  },
  "frames.single": {
    en: "One frame is a still sticker. Add another to animate it.",
    es: "Un fotograma es un sticker fijo. Añade otro para animarlo.",
  },

  // Finish.
  "finish.outline": { en: "White outline", es: "Contorno blanco" },
  "finish.outlineHint": {
    en: "WhatsApp recommends an 8 pixel white outline, so a sticker reads on any chat background.",
    es: "WhatsApp recomienda un contorno blanco de 8 píxeles para que el sticker se vea en cualquier fondo.",
  },
  "finish.outlineWidth": { en: "Outline width", es: "Grosor del contorno" },
  "finish.outlineColour": { en: "Outline colour", es: "Color del contorno" },
  "finish.quality": { en: "File size", es: "Tamaño del archivo" },
  "finish.qualityValue": { en: "{kb} KB of {max} KB", es: "{kb} KB de {max} KB" },
  "finish.encoding": { en: "Working…", es: "Trabajando…" },

  // Tagging a sticker.
  "details.emoji": { en: "Emoji", es: "Emoji" },
  "details.emojiHint": {
    en: "One to three emoji. WhatsApp needs at least one, and uses them to help people find the sticker.",
    es: "De uno a tres emoji. WhatsApp necesita al menos uno y los usa para que la gente encuentre el sticker.",
  },
  "details.emojiCount": { en: "{count} of {max}", es: "{count} de {max}" },
  "details.accessibility": { en: "Description", es: "Descripción" },
  "details.accessibilityHint": {
    en: "Optional. A screen reader reads this out. Say what the sticker shows.",
    es: "Opcional. Un lector de pantalla lo leerá en voz alta. Describe qué muestra el sticker.",
  },
  "details.accessibilityCount": { en: "{count} of {max} characters", es: "{count} de {max} caracteres" },

  // Checking against the rules.
  "check.pass": { en: "This sticker follows every WhatsApp rule.", es: "Este sticker cumple todas las reglas de WhatsApp." },
  "check.errors": { en: "{count} problem must be fixed", es: "{count} problema por corregir" },
  "check.errorsPlural": { en: "{count} problems must be fixed", es: "{count} problemas por corregir" },
  "check.warnings": { en: "{count} suggestion", es: "{count} sugerencia" },
  "check.warningsPlural": { en: "{count} suggestions", es: "{count} sugerencias" },
  "check.forSticker": { en: "Sticker {number}: {message}", es: "Sticker {number}: {message}" },
  "check.rules": { en: "What WhatsApp requires", es: "Qué exige WhatsApp" },

  // The pack.
  "packUi.name": { en: "Pack name", es: "Nombre del paquete" },
  "packUi.publisher": { en: "Your name", es: "Tu nombre" },
  "packUi.identifier": { en: "Identifier", es: "Identificador" },
  "packUi.identifierHint": {
    en: "Built from the pack name. WhatsApp allows only letters, digits and _ - . in it.",
    es: "Se crea a partir del nombre. WhatsApp solo permite letras, dígitos y _ - . aquí.",
  },
  "packUi.add": { en: "Add this sticker to the pack", es: "Añadir este sticker al paquete" },
  "packUi.count": { en: "{count} of {max} stickers", es: "{count} de {max} stickers" },
  "packUi.need": {
    en: "A pack needs at least {min} stickers.",
    es: "Un paquete necesita al menos {min} stickers.",
  },
  "packUi.empty": { en: "No stickers in the pack yet.", es: "Todavía no hay stickers en el paquete." },
  "packUi.remove": { en: "Remove from the pack", es: "Quitar del paquete" },
  "packUi.moveLeft": { en: "Move earlier", es: "Mover antes" },
  "packUi.moveRight": { en: "Move later", es: "Mover después" },
  "packUi.edit": { en: "Open in the editor", es: "Abrir en el editor" },
  "packUi.tray": { en: "Pack icon", es: "Icono del paquete" },
  "packUi.trayHint": {
    en: "The 96 by 96 icon WhatsApp shows for the pack. Made from the first sticker unless you pick another.",
    es: "El icono de 96 por 96 que WhatsApp muestra para el paquete. Se crea con el primer sticker si no eliges otro.",
  },
  "packUi.trayFrom": { en: "Use this sticker as the icon", es: "Usar este sticker como icono" },
  "packUi.animated": { en: "Animated pack", es: "Paquete animado" },
  "packUi.still": { en: "Still pack", es: "Paquete fijo" },
  "packUi.mixedWarning": {
    en: "A pack holds either still or animated stickers, never both.",
    es: "Un paquete tiene stickers fijos o animados, nunca los dos.",
  },
  "packUi.clear": { en: "Empty the pack", es: "Vaciar el paquete" },

  // Saving files.
  "export.sticker": { en: "Save this sticker", es: "Guardar este sticker" },
  "export.wastickers": { en: "Save the pack for a phone", es: "Guardar el paquete para el móvil" },
  "export.contents": { en: "Save the pack for developers", es: "Guardar el paquete para desarrolladores" },
  "export.wastickersHint": {
    en: "A .wastickers file. Open it with a sticker app on your phone to add the pack to WhatsApp.",
    es: "Un archivo .wastickers. Ábrelo con una app de stickers en tu móvil para añadir el paquete a WhatsApp.",
  },
  "export.contentsHint": {
    en: "A zip with contents.json, ready for WhatsApp's own sample app.",
    es: "Un zip con contents.json, listo para la app de ejemplo de WhatsApp.",
  },
  "export.howTo": { en: "How to get a pack into WhatsApp", es: "Cómo llevar un paquete a WhatsApp" },
  "export.howToBody": {
    en: "WhatsApp only reads packs from an installed app, so a web page cannot add one directly. Save the .wastickers file, then open it with a sticker app on your phone. A single sticker can also be sent straight into a chat as an image.",
    es: "WhatsApp solo lee paquetes desde una app instalada, así que una página web no puede añadirlo directamente. Guarda el archivo .wastickers y ábrelo con una app de stickers en tu móvil. Un sticker suelto también se puede enviar a un chat como imagen.",
  },

  // Things that go wrong.
  "error.notImage": { en: "That file is not a picture.", es: "Ese archivo no es una imagen." },
  "error.decodeFailed": {
    en: "That picture could not be opened. Try another one.",
    es: "No se pudo abrir esa imagen. Prueba con otra.",
  },
  "error.noWebp": {
    en: "This browser cannot save WebP pictures, which every WhatsApp sticker must be. Try Chrome, Edge, Firefox or Safari 16 or newer.",
    es: "Este navegador no puede guardar imágenes WebP, que es lo que debe ser todo sticker de WhatsApp. Prueba Chrome, Edge, Firefox o Safari 16 o posterior.",
  },
  "error.tooBigToFit": {
    en: "This sticker will not fit in {max} KB, even at the lowest quality. Try a simpler picture or fewer frames.",
    es: "Este sticker no cabe en {max} KB ni con la calidad más baja. Prueba una imagen más simple o menos fotogramas.",
  },
  "error.saveFailed": {
    en: "Your work could not be saved on this device. It will be lost when you close the page.",
    es: "No se pudo guardar tu trabajo en este dispositivo. Se perderá al cerrar la página.",
  },

  // The rules, written out from the numbers `spec.js` reports.
  "rule.sticker.dimensions": {
    en: "A sticker must be exactly {expected} by {expected} pixels. This one is {width} by {height}.",
    es: "Un sticker debe medir exactamente {expected} por {expected} píxeles. Este mide {width} por {height}.",
  },
  "rule.sticker.tooBig": {
    en: "This sticker is {kb} KB. The limit is {maxKb} KB.",
    es: "Este sticker pesa {kb} KB. El límite es {maxKb} KB.",
  },
  "rule.sticker.oneFrame": {
    en: "An animation needs more than one frame. WhatsApp refuses a pack whose animated sticker holds only one.",
    es: "Una animación necesita más de un fotograma. WhatsApp rechaza un paquete cuyo sticker animado tiene solo uno.",
  },
  "rule.sticker.frameTooShort": {
    en: "Every frame must last at least {min} ms.",
    es: "Cada fotograma debe durar al menos {min} ms.",
  },
  "rule.sticker.tooLong": {
    en: "This animation runs {seconds} s. The limit is 10 s.",
    es: "Esta animación dura {seconds} s. El límite es 10 s.",
  },
  "rule.sticker.noEmoji": {
    en: "Add at least one emoji. WhatsApp requires it.",
    es: "Añade al menos un emoji. WhatsApp lo exige.",
  },
  "rule.sticker.tooManyEmojis": {
    en: "A sticker carries at most {max} emoji.",
    es: "Un sticker lleva como máximo {max} emoji.",
  },
  "rule.sticker.accessibilityTooLong": {
    en: "The description is {length} characters. The limit is {max}.",
    es: "La descripción tiene {length} caracteres. El límite es {max}.",
  },
  "rule.sticker.opaque": {
    en: "This sticker has no transparent background, so it will show as a square.",
    es: "Este sticker no tiene fondo transparente, así que se verá como un cuadrado.",
  },
  "rule.sticker.touchesEdge": {
    en: "The drawing reaches the edge, so there is no room for the outline WhatsApp recommends.",
    es: "El dibujo llega al borde, así que no hay sitio para el contorno que recomienda WhatsApp.",
  },
  "rule.pack.tooFewStickers": {
    en: "A pack needs at least {min} stickers. This one has {count}.",
    es: "Un paquete necesita al menos {min} stickers. Este tiene {count}.",
  },
  "rule.pack.tooManyStickers": {
    en: "A pack holds at most {max} stickers. This one has {count}.",
    es: "Un paquete lleva como máximo {max} stickers. Este tiene {count}.",
  },
  "rule.pack.mixed": {
    en: "A pack holds either still or animated stickers, never both. {animated} of {total} animate.",
    es: "Un paquete tiene stickers fijos o animados, nunca los dos. {animated} de {total} se animan.",
  },
  "rule.pack.nameMissing": { en: "The pack needs a name.", es: "El paquete necesita un nombre." },
  "rule.pack.nameTooLong": {
    en: "The pack name is {length} characters. The limit is {max}.",
    es: "El nombre del paquete tiene {length} caracteres. El límite es {max}.",
  },
  "rule.pack.publisherMissing": {
    en: "The pack needs a publisher name.",
    es: "El paquete necesita un nombre de autor.",
  },
  "rule.pack.publisherTooLong": {
    en: "The publisher name is {length} characters. The limit is {max}.",
    es: "El nombre del autor tiene {length} caracteres. El límite es {max}.",
  },
  "rule.pack.identifierMissing": {
    en: "The pack needs an identifier.",
    es: "El paquete necesita un identificador.",
  },
  "rule.pack.identifierTooLong": {
    en: "The identifier is {length} characters. The limit is {max}.",
    es: "El identificador tiene {length} caracteres. El límite es {max}.",
  },
  "rule.pack.identifierChars": {
    en: "The identifier may hold only letters, digits, and _ - . or a space.",
    es: "El identificador solo puede tener letras, dígitos y _ - . o un espacio.",
  },
  "rule.pack.trayMissing": {
    en: "The pack needs an icon.",
    es: "El paquete necesita un icono.",
  },
  "rule.pack.trayNotPng": {
    en: "The pack icon must be a PNG file.",
    es: "El icono del paquete debe ser un archivo PNG.",
  },
  "rule.pack.trayTooBig": {
    en: "The pack icon is {kb} KB. The limit is {maxKb} KB.",
    es: "El icono del paquete pesa {kb} KB. El límite es {maxKb} KB.",
  },
  "rule.pack.trayDimensions": {
    en: "The pack icon must be between {min} and {max} pixels on a side. This one is {width} by {height}.",
    es: "El icono del paquete debe medir entre {min} y {max} píxeles por lado. Este mide {width} por {height}.",
  },
  "rule.pack.trayNotRecommended": {
    en: "The pack icon is {width} by {height}. WhatsApp recommends {recommended} by {recommended}.",
    es: "El icono del paquete mide {width} por {height}. WhatsApp recomienda {recommended} por {recommended}.",
  },
  "rule.pack.emailInvalid": {
    en: "That does not look like an email address.",
    es: "Eso no parece una dirección de correo.",
  },
  "rule.pack.websiteInvalid": {
    en: "A website must start with http:// or https://.",
    es: "Una web debe empezar por http:// o https://.",
  },
};

/**
 * The sentence for a key, in a language, with its numbers filled in.
 *
 * @param {string} key
 * @param {string} [lang]
 * @param {object} [params] Values for the `{name}` slots.
 * @returns {string} The key itself when there is no such message, so a gap
 *   shows on the page instead of an empty space.
 */
export function t(key, lang = DEFAULT_LANGUAGE, params = {}) {
  const entry = MESSAGES[key];
  const text = entry?.[lang] ?? entry?.[DEFAULT_LANGUAGE] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * A `t` bound to one language, so callers do not repeat it on every line.
 *
 * @param {string} lang
 * @returns {(key: string, params?: object) => string}
 */
export const sayIn = (lang) => (key, params) => t(key, lang, params);

/**
 * Which language to speak: the one asked for, else one the reader's browser
 * lists, else English.
 *
 * @param {string} [asked] From the address bar or from a previous visit.
 * @param {string[]} [browserLanguages] `navigator.languages`.
 * @returns {string}
 */
export function pickLanguage(asked, browserLanguages = []) {
  if (LANGUAGE_CODES.includes(asked)) return asked;
  for (const candidate of browserLanguages) {
    const code = String(candidate).slice(0, 2).toLowerCase();
    if (LANGUAGE_CODES.includes(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Turn a finding from `spec.js` into a sentence.
 *
 * The numbers arrive in the units the rule is written in, and some of them
 * need converting before they read well: a limit of 102400 bytes is "100 KB"
 * to a person, and 10000 ms is "10 s".
 *
 * @param {import("./spec.js").Finding} finding
 * @param {string} [lang]
 * @returns {string}
 */
export function sayFinding(finding, lang = DEFAULT_LANGUAGE) {
  const params = { ...finding.params };
  // A person reads kilobytes and seconds, not bytes and milliseconds.
  if (typeof params.byteLength === "number") params.kb = Math.round(params.byteLength / 1024);
  if (typeof params.maxBytes === "number") params.maxKb = Math.round(params.maxBytes / 1024);
  if (typeof params.totalMs === "number") params.seconds = (params.totalMs / 1000).toFixed(1);
  return t(`rule.${finding.rule}`, lang, params);
}
