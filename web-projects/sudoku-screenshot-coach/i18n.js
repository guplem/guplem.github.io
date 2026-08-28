// Every word the tool says, in each language it speaks.
//
// The catalogue is one flat table of keys. Each key holds one entry per
// language, so a translation sits next to the text it translates and a missing
// one is easy to spot. `i18n.test.js` fails when a key is missing in any
// language, so the two can never drift apart.
//
// Placeholders are written `{name}` and filled by `t`. The sentences are built
// so that no translation needs a different order of arguments than the English
// one, which keeps the explanation code free of language rules.

export const DEFAULT_LANGUAGE = "en";

/** The languages the page offers, in the order the picker shows them. */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code);

export const MESSAGES = {
  // --- names of things on the board -----------------------------------------
  "house.row": { en: "row {n}", es: "la fila {n}" },
  "house.col": { en: "column {n}", es: "la columna {n}" },
  "house.box": { en: "box {n}", es: "la caja {n}" },
  "houseWord.row": { en: "row", es: "fila" },
  "houseWord.col": { en: "column", es: "columna" },
  "houseWord.rows": { en: "rows", es: "filas" },
  "houseWord.cols": { en: "columns", es: "columnas" },
  "relation.row": { en: "same row", es: "misma fila" },
  "relation.col": { en: "same column", es: "misma columna" },
  "relation.box": { en: "same box", es: "misma caja" },
  "list.and": { en: "and", es: "y" },
  "count.2": { en: "two cells", es: "dos celdas" },
  "count.3": { en: "three cells", es: "tres celdas" },
  "count.4": { en: "four cells", es: "cuatro celdas" },

  // --- technique catalogue ---------------------------------------------------
  "category.single": { en: "Single", es: "Única" },
  "category.locked": { en: "Locked candidates", es: "Candidatos bloqueados" },
  "category.subset": { en: "Subset", es: "Subconjunto" },
  "category.fish": { en: "Fish", es: "Pez" },
  "category.wing": { en: "Wing", es: "Ala" },

  "technique.naked-single.name": { en: "Naked Single", es: "Única candidata" },
  "technique.naked-single.summary": {
    en: "A cell that has only one digit left.",
    es: "Una celda a la que solo le queda una cifra.",
  },
  "technique.naked-single.how": {
    en: "Look at one empty cell and cross off every digit that already appears in its row, its column or its box. When only one digit survives, that cell must take it.",
    es: "Mira una celda vacía y tacha cada cifra que ya aparece en su fila, en su columna o en su caja. Cuando solo sobrevive una cifra, esa celda tiene que llevarla.",
  },

  "technique.hidden-single.name": { en: "Hidden Single", es: "Única escondida" },
  "technique.hidden-single.summary": {
    en: "A digit that fits in only one cell of a row, column or box.",
    es: "Una cifra que solo cabe en una celda de una fila, columna o caja.",
  },
  "technique.hidden-single.how": {
    en: "Pick a digit and one house (a row, a column or a box). Check where that digit could still go inside the house. When only one cell is left, the digit belongs there, even if that cell still shows other candidates.",
    es: "Elige una cifra y una casa (una fila, una columna o una caja). Mira dónde puede ir todavía esa cifra dentro de la casa. Cuando solo queda una celda, la cifra va ahí, aunque esa celda muestre otros candidatos.",
  },

  "technique.pointing.name": { en: "Pointing Pair or Triple", es: "Par o trío apuntador" },
  "technique.pointing.summary": {
    en: "A digit locked to one row or column inside a box leaves that line elsewhere.",
    es: "Una cifra atrapada en una fila o columna dentro de una caja desaparece del resto de esa línea.",
  },
  "technique.pointing.how": {
    en: "Inside one box, find a digit whose remaining cells all sit on the same row (or the same column). The box must hold that digit somewhere, so it lands on that line. Every other cell of the line, outside the box, loses the digit.",
    es: "Dentro de una caja, busca una cifra cuyas celdas posibles estén todas en la misma fila (o en la misma columna). La caja tiene que llevar esa cifra en alguna parte, así que caerá en esa línea. Las demás celdas de la línea, fuera de la caja, pierden la cifra.",
  },

  "technique.claiming.name": { en: "Claiming (Box-Line Reduction)", es: "Reclamación (línea-caja)" },
  "technique.claiming.summary": {
    en: "A digit locked to one box inside a line leaves the rest of that box.",
    es: "Una cifra atrapada en una caja dentro de una línea desaparece del resto de esa caja.",
  },
  "technique.claiming.how": {
    en: "Inside one row or column, find a digit whose remaining cells all sit in the same box. The line must hold the digit, so it lands inside that box on this line. Every other cell of the box loses the digit.",
    es: "Dentro de una fila o columna, busca una cifra cuyas celdas posibles estén todas en la misma caja. La línea tiene que llevar la cifra, así que caerá dentro de esa caja sobre esta línea. Las demás celdas de la caja pierden la cifra.",
  },

  "technique.naked-pair.name": { en: "Naked Pair", es: "Par desnudo" },
  "technique.naked-pair.summary": {
    en: "Two cells of a house that share the same two candidates.",
    es: "Dos celdas de una casa que comparten los mismos dos candidatos.",
  },
  "technique.naked-pair.how": {
    en: "Find two cells in one house that hold the same two candidates. Between them they use both digits, in one order or the other. No other cell of that house can take either digit.",
    es: "Busca dos celdas de una casa con los mismos dos candidatos. Entre las dos usan ambas cifras, en un orden o en el otro. Ninguna otra celda de esa casa puede llevar ninguna de las dos.",
  },

  "technique.hidden-pair.name": { en: "Hidden Pair", es: "Par escondido" },
  "technique.hidden-pair.summary": {
    en: "Two digits of a house that fit in only two cells.",
    es: "Dos cifras de una casa que solo caben en dos celdas.",
  },
  "technique.hidden-pair.how": {
    en: "Find two digits that can only go in the same two cells of a house. Those two cells take those two digits, so every other candidate leaves both cells.",
    es: "Busca dos cifras que solo puedan ir en las mismas dos celdas de una casa. Esas dos celdas llevan esas dos cifras, así que cualquier otro candidato sale de ambas.",
  },

  "technique.naked-triple.name": { en: "Naked Triple", es: "Trío desnudo" },
  "technique.naked-triple.summary": {
    en: "Three cells of a house that share three candidates between them.",
    es: "Tres celdas de una casa que comparten tres candidatos entre ellas.",
  },
  "technique.naked-triple.how": {
    en: "Find three cells in one house whose candidates together are only three digits. Each cell need not show all three. Those three cells use up the three digits, so no other cell of the house can take them.",
    es: "Busca tres celdas de una casa cuyos candidatos sumen solo tres cifras. No hace falta que cada celda muestre las tres. Esas tres celdas agotan las tres cifras, así que ninguna otra celda de la casa puede llevarlas.",
  },

  "technique.hidden-triple.name": { en: "Hidden Triple", es: "Trío escondido" },
  "technique.hidden-triple.summary": {
    en: "Three digits of a house that fit in only three cells.",
    es: "Tres cifras de una casa que solo caben en tres celdas.",
  },
  "technique.hidden-triple.how": {
    en: "Find three digits whose remaining places in a house fall inside the same three cells. Those cells take those digits, so every other candidate leaves the three cells.",
    es: "Busca tres cifras cuyos sitios posibles en una casa caigan dentro de las mismas tres celdas. Esas celdas llevan esas cifras, así que cualquier otro candidato sale de las tres.",
  },

  "technique.naked-quad.name": { en: "Naked Quad", es: "Cuarteto desnudo" },
  "technique.naked-quad.summary": {
    en: "Four cells of a house that share four candidates between them.",
    es: "Cuatro celdas de una casa que comparten cuatro candidatos entre ellas.",
  },
  "technique.naked-quad.how": {
    en: "The Naked Pair idea with four cells: when four cells of a house hold only four digits between them, those digits are used up there and leave every other cell of the house.",
    es: "La idea del par desnudo con cuatro celdas: cuando cuatro celdas de una casa contienen solo cuatro cifras entre todas, esas cifras se agotan ahí y salen de las demás celdas de la casa.",
  },

  "technique.x-wing.name": { en: "X-Wing", es: "X-Wing" },
  "technique.x-wing.summary": {
    en: "A digit boxed into the same two columns on two rows.",
    es: "Una cifra encerrada en las mismas dos columnas en dos filas.",
  },
  "technique.x-wing.how": {
    en: "Find two rows in which a digit has only two possible cells, and both rows use the same two columns. The digit takes one cell in each row, so it fills both columns. Every other cell of those two columns loses the digit. The pattern also works with rows and columns swapped.",
    es: "Busca dos filas en las que una cifra tenga solo dos celdas posibles, y que ambas filas usen las mismas dos columnas. La cifra ocupa una celda en cada fila, así que llena las dos columnas. Las demás celdas de esas dos columnas pierden la cifra. El patrón también sirve cambiando filas por columnas.",
  },

  "technique.y-wing.name": { en: "Y-Wing", es: "Y-Wing" },
  "technique.y-wing.summary": {
    en: "Three two-candidate cells that force a digit out of what two of them see.",
    es: "Tres celdas de dos candidatos que expulsan una cifra de lo que dos de ellas ven.",
  },
  "technique.y-wing.how": {
    en: "Find a pivot cell with two candidates {a,b}. Find two cells it sees, one with {a,c} and one with {b,c}. Whichever digit the pivot takes, one of the other two becomes c. So c cannot stay in any cell that sees both of them.",
    es: "Busca una celda pivote con dos candidatos {a,b}. Busca dos celdas que el pivote vea, una con {a,c} y otra con {b,c}. Tome la cifra que tome el pivote, una de las otras dos será c. Por eso c no puede quedarse en ninguna celda que vea a las dos.",
  },

  "technique.swordfish.name": { en: "Swordfish", es: "Pez espada" },
  "technique.swordfish.summary": {
    en: "The X-Wing idea on three rows and three columns.",
    es: "La idea del X-Wing con tres filas y tres columnas.",
  },
  "technique.swordfish.how": {
    en: "Find three rows in which a digit has only two or three possible cells, and all of them fall inside the same three columns. The digit takes one cell per row and fills all three columns, so it leaves every other cell of those columns. It also works with rows and columns swapped.",
    es: "Busca tres filas en las que una cifra tenga solo dos o tres celdas posibles, y que todas caigan dentro de las mismas tres columnas. La cifra ocupa una celda por fila y llena las tres columnas, así que sale de las demás celdas de esas columnas. También sirve cambiando filas por columnas.",
  },

  "technique.xyz-wing.name": { en: "XYZ-Wing", es: "XYZ-Wing" },
  "technique.xyz-wing.summary": {
    en: "A three-candidate pivot with two matching pincers.",
    es: "Un pivote de tres candidatos con dos pinzas que encajan.",
  },
  "technique.xyz-wing.how": {
    en: "Find a pivot with three candidates {a,b,c} and two cells it sees holding {a,c} and {b,c}. One of the three cells must be c, so c cannot stay in a cell that sees all three.",
    es: "Busca un pivote con tres candidatos {a,b,c} y dos celdas que vea con {a,c} y {b,c}. Una de las tres celdas tiene que ser c, así que c no puede quedarse en una celda que vea a las tres.",
  },

  // --- explanations ----------------------------------------------------------
  "explain.place.title": { en: "Place {digit} in {cell}", es: "Coloca el {digit} en {cell}" },
  "explain.place.action": { en: "Write {digit} into {cell}.", es: "Escribe el {digit} en {cell}." },
  "explain.rule-out.title": { en: "Rule out {digit} in {cells}", es: "Descarta el {digit} en {cells}" },
  "explain.remove.action": { en: "Remove {list}.", es: "Elimina {list}." },
  "explain.elimination.group": { en: "{digit} from {cells}", es: "el {digit} de {cells}" },
  "explain.cellWithCandidates": { en: "{cell} ({digits})", es: "{cell} ({digits})" },

  "explain.naked-single.1": {
    en: "{cell} has one candidate left, so {digit} is the only digit it can still take.",
    es: "A {cell} solo le queda un candidato, así que el {digit} es la única cifra que puede llevar.",
  },
  "explain.naked-single.2": {
    en: "Each of the other eight digits already sits in a cell that {cell} can see: {list}.",
    es: "Cada una de las otras ocho cifras ya está en una celda que {cell} ve: {list}.",
  },
  "explain.naked-single.2-short": {
    en: "Every other digit is already used in the row, the column or the box of {cell}.",
    es: "Todas las demás cifras ya están usadas en la fila, la columna o la caja de {cell}.",
  },
  "explain.blocker": { en: "{digit} in {cell} ({relation})", es: "el {digit} de {cell} ({relation})" },

  "explain.hidden-single.1": {
    en: "Inside {house}, {digit} has only one place left, and that place is {cell}.",
    es: "Dentro de {house}, el {digit} solo tiene un sitio posible, y ese sitio es {cell}.",
  },
  "explain.hidden-single.2": {
    en: "The other empty cells of {house} cannot take {digit}: {list}.",
    es: "Las otras celdas vacías de {house} no pueden llevar el {digit}: {list}.",
  },
  "explain.hidden-single.3": {
    en: "{cell} may still show other candidates. That does not matter: {house} needs a {digit} somewhere, and this is the only cell left for it.",
    es: "{cell} puede seguir mostrando otros candidatos. Da igual: {house} necesita un {digit} en algún sitio, y esta es la única celda que queda.",
  },
  "explain.witness.one": { en: "{cells} sees the {digit} in {cell}", es: "{cells} ve el {digit} de {cell}" },
  "explain.witness.many": { en: "{cells} see the {digit} in {cell}", es: "{cells} ven el {digit} de {cell}" },

  "explain.pointing.1": {
    en: "Inside {box}, {digit} can only go in {cells}.",
    es: "Dentro de {box}, el {digit} solo puede ir en {cells}.",
  },
  "explain.pointing.2": {
    en: "All of those cells sit on {line}, so {box} must place its {digit} on that {lineWord}.",
    es: "Todas esas celdas están en {line}, así que {box} tiene que poner su {digit} en esa {lineWord}.",
  },
  "explain.pointing.3": {
    en: "That {lineWord} then takes its {digit} from inside {box}, so no cell of {line} outside the box can be {digit}.",
    es: "Esa {lineWord} coge entonces su {digit} de dentro de {box}, así que ninguna celda de {line} fuera de la caja puede ser {digit}.",
  },

  "explain.claiming.1": {
    en: "Inside {line}, {digit} can only go in {cells}.",
    es: "Dentro de {line}, el {digit} solo puede ir en {cells}.",
  },
  "explain.claiming.2": {
    en: "All of those cells sit in {box}, so {line} must place its {digit} inside that box.",
    es: "Todas esas celdas están en {box}, así que {line} tiene que poner su {digit} dentro de esa caja.",
  },
  "explain.claiming.3": {
    en: "{box} needs only one {digit}, and {line} has already claimed it, so the rest of the box loses it.",
    es: "{box} solo necesita un {digit}, y {line} ya lo ha reclamado, así que el resto de la caja lo pierde.",
  },

  "explain.naked-subset.title": {
    en: "Rule out {digits} elsewhere in {house}",
    es: "Descarta {digits} en el resto de {house}",
  },
  "explain.naked-subset.1": {
    en: "In {house}, {cells} hold only the digits {digits} between them.",
    es: "En {house}, {cells} contienen entre todas solo las cifras {digits}.",
  },
  "explain.naked-subset.2": {
    en: "Those {countWord} take those {count} digits in some order, so the digits are used up inside them.",
    es: "Esas {countWord} ocupan esas {count} cifras en algún orden, así que las cifras se agotan ahí.",
  },
  "explain.naked-subset.3": {
    en: "No other cell of {house} can be {digits}.",
    es: "Ninguna otra celda de {house} puede ser {digits}.",
  },

  "explain.hidden-subset.title": {
    en: "Clear the extra candidates from {cells}",
    es: "Quita los candidatos sobrantes de {cells}",
  },
  "explain.hidden-subset.1": {
    en: "In {house}, the digits {digits} fit only in {cells}.",
    es: "En {house}, las cifras {digits} solo caben en {cells}.",
  },
  "explain.hidden-subset.2": {
    en: "That is {count} digits for {count} cells, so those cells take exactly those digits.",
    es: "Son {count} cifras para {count} celdas, así que esas celdas llevan exactamente esas cifras.",
  },
  "explain.hidden-subset.3": {
    en: "Every other candidate in those cells is therefore impossible.",
    es: "Por tanto, cualquier otro candidato de esas celdas es imposible.",
  },

  "explain.fish.1": {
    en: "The digit {digit} has only a few places left in {lines}.",
    es: "La cifra {digit} solo tiene unos pocos sitios en {lines}.",
  },
  "explain.fish.2": {
    en: "Every one of those places falls inside {covers}.",
    es: "Todos esos sitios caen dentro de {covers}.",
  },
  "explain.fish.3": {
    en: "Each {baseWord} needs one {digit}, and there are exactly as many of those {basePlural} as there are {coverPlural} to hold them, so those {coverPlural} take their {digit} from these cells.",
    es: "Cada {baseWord} necesita un {digit}, y hay exactamente tantas {basePlural} como {coverPlural} para alojarlos, así que esas {coverPlural} cogen su {digit} de estas celdas.",
  },
  "explain.fish.4": {
    en: "Any other cell of {covers} loses the {digit}.",
    es: "Cualquier otra celda de {covers} pierde el {digit}.",
  },
  "explain.fish.line": { en: "{house} ({cells})", es: "{house} ({cells})" },

  "explain.y-wing.1": {
    en: "{pivot} is the pivot: it holds only {a} and {b}.",
    es: "{pivot} es el pivote: solo contiene {a} y {b}.",
  },
  "explain.y-wing.2": {
    en: "It sees {pincers}, and both of those share the digit {digit} with it.",
    es: "Ve {pincers}, y las dos comparten con él la cifra {digit}.",
  },
  "explain.y-wing.3": {
    en: "If {pivot} is {a}, then {first} must be {digit}. If it is {b}, then {second} must be {digit}.",
    es: "Si {pivot} es {a}, entonces {first} tiene que ser {digit}. Si es {b}, entonces {second} tiene que ser {digit}.",
  },
  "explain.y-wing.4": {
    en: "Either way one of the two pincers is {digit}, so no cell that sees both of them can be {digit}.",
    es: "En cualquier caso, una de las dos pinzas es {digit}, así que ninguna celda que vea a las dos puede ser {digit}.",
  },

  "explain.xyz-wing.1": {
    en: "{pivot} is the pivot, with three candidates ({digits}).",
    es: "{pivot} es el pivote, con tres candidatos ({digits}).",
  },
  "explain.xyz-wing.2": {
    en: "It sees {pincers}, and all three cells share the digit {digit}.",
    es: "Ve {pincers}, y las tres celdas comparten la cifra {digit}.",
  },
  "explain.xyz-wing.3": {
    en: "Whatever the pivot takes, one of the three cells ends up as {digit}.",
    es: "Tome lo que tome el pivote, una de las tres celdas acaba siendo {digit}.",
  },
  "explain.xyz-wing.4": {
    en: "So a cell that sees all three of them cannot be {digit}.",
    es: "Por eso una celda que vea a las tres no puede ser {digit}.",
  },

  "summary.placement": { en: "{technique}: {cell} = {digit}", es: "{technique}: {cell} = {digit}" },
  "summary.elimination": { en: "{technique}: removes {list}", es: "{technique}: elimina {list}" },

  // --- grid checks -----------------------------------------------------------
  "check.conflict": {
    en: "This grid breaks the rules: {list}.",
    es: "Esta cuadrícula rompe las reglas: {list}.",
  },
  "check.conflict.item": {
    en: "{digit} appears twice in {house} ({cells})",
    es: "el {digit} aparece dos veces en {house} ({cells})",
  },
  "check.conflict.more": { en: ", and {count} more", es: ", y {count} más" },
  "check.unsolvable": {
    en: "No digit arrangement completes this grid. A clue is probably wrong, so check the cells you are unsure about.",
    es: "Ninguna combinación de cifras completa esta cuadrícula. Seguramente hay una pista mal leída, así que revisa las celdas de las que no estés seguro.",
  },
  "check.multiple": {
    en: "This grid has more than one solution, so a clue is probably missing or misread. The hints below follow one of them.",
    es: "Esta cuadrícula tiene más de una solución, así que seguramente falta una pista o se ha leído mal. Las pistas de abajo siguen una de ellas.",
  },
  "check.solved": { en: "The grid is already complete.", es: "La cuadrícula ya está completa." },
  "check.ok": {
    en: "The grid is valid and has exactly one solution.",
    es: "La cuadrícula es válida y tiene exactamente una solución.",
  },

  // --- coach -----------------------------------------------------------------
  "coach.solved": {
    en: "The grid is complete and every row, column and box is correct. Nothing left to do.",
    es: "La cuadrícula está completa y todas las filas, columnas y cajas son correctas. No queda nada por hacer.",
  },
  "coach.next": {
    en: "{count} cells left. Easiest move available: {technique}.",
    es: "Quedan {count} celdas. El movimiento más fácil disponible es: {technique}.",
  },
  "coach.stuck": {
    en: "None of the {count} techniques this coach knows applies here. The verified solution puts {digit} in {cell}. Proving that by hand needs a technique beyond this catalogue, such as a chain or a unique-rectangle pattern.",
    es: "Ninguna de las {count} técnicas que conoce este entrenador sirve aquí. La solución verificada pone un {digit} en {cell}. Demostrarlo a mano necesita una técnica fuera de este catálogo, como una cadena o un rectángulo único.",
  },
  "coach.stuck.short": {
    en: "No known technique applies to this grid.",
    es: "Ninguna técnica conocida sirve para esta cuadrícula.",
  },
  "coach.searchUsed": {
    en: "The known techniques placed {count} digits, then ran out. The rest of the grid comes from the verified solution.",
    es: "Las técnicas conocidas colocaron {count} cifras y se agotaron. El resto de la cuadrícula viene de la solución verificada.",
  },

  "difficulty.easy": { en: "Easy", es: "Fácil" },
  "difficulty.easy.blurb": { en: "Singles carry the whole puzzle.", es: "Las únicas resuelven todo el pasatiempo." },
  "difficulty.medium": { en: "Medium", es: "Media" },
  "difficulty.medium.blurb": {
    en: "Needs locked candidates as well as singles.",
    es: "Necesita candidatos bloqueados además de únicas.",
  },
  "difficulty.hard": { en: "Hard", es: "Difícil" },
  "difficulty.hard.blurb": { en: "Needs pairs, triples or quads.", es: "Necesita pares, tríos o cuartetos." },
  "difficulty.expert": { en: "Expert", es: "Experta" },
  "difficulty.expert.blurb": { en: "Needs a fish or a wing pattern.", es: "Necesita un patrón de pez o de ala." },
  "difficulty.beyond": { en: "Beyond these techniques", es: "Más allá de estas técnicas" },
  "difficulty.beyond.blurb": {
    en: "No technique in the catalogue cracks it, so the rest comes from search.",
    es: "Ninguna técnica del catálogo la resuelve, así que el resto viene de una búsqueda.",
  },

  // --- reading a picture -----------------------------------------------------
  "read.noGrid": {
    en: "No sudoku grid was found in this image. The grid needs to be fully visible and roughly square. Try a tighter crop, or type the puzzle in by hand below.",
    es: "No se ha encontrado ninguna cuadrícula de sudoku en esta imagen. La cuadrícula tiene que verse entera y ser más o menos cuadrada. Prueba a recortar más, o escribe el pasatiempo a mano abajo.",
  },
  "read.working": { en: "Reading the picture…", es: "Leyendo la imagen…" },
  "read.count": { en: "Read {count} digits.", es: "Leídas {count} cifras." },
  "read.repaired": {
    en: "The rules of sudoku showed a reading was wrong, so it corrected {list}.",
    es: "Las reglas del sudoku mostraron que una lectura era incorrecta, así que se ha corregido {list}.",
  },
  "read.repair.item": { en: "{cell} ({from} to {to})", es: "{cell} ({from} a {to})" },
  "read.repair.empty": { en: "empty", es: "vacía" },
  "read.uncertain": {
    en: "{count} cells are marked as doubtful. Check them before you trust the advice.",
    es: "{count} celdas están marcadas como dudosas. Revísalas antes de fiarte del consejo.",
  },
  "read.failed": { en: "That image could not be read: {message}", es: "No se ha podido leer esa imagen: {message}" },
  "read.elimOnly": {
    en: "That step only rules candidates out. The grid does not change until a later step places a digit.",
    es: "Ese paso solo descarta candidatos. La cuadrícula no cambia hasta que un paso posterior coloque una cifra.",
  },

  // --- page text -------------------------------------------------------------
  "ui.title": { en: "Sudoku Screenshot Coach", es: "Entrenador de sudoku por captura" },
  "ui.subtitle": {
    en: "Drop in a screenshot with a sudoku somewhere in it. The tool finds the grid, reads the digits, and tells you the next move to make, and why that move is forced.",
    es: "Suelta una captura que tenga un sudoku en alguna parte. La herramienta encuentra la cuadrícula, lee las cifras y te dice el siguiente movimiento, y por qué ese movimiento es obligado.",
  },
  "ui.step1": { en: "1. Load a puzzle", es: "1. Carga un pasatiempo" },
  "ui.drop.title": {
    en: "Drop a screenshot, paste it, or choose a file",
    es: "Suelta una captura, pégala o elige un archivo",
  },
  "ui.drop.hint": {
    en: "The sudoku can sit anywhere in the picture, next to anything else. Press Ctrl+V (Cmd+V on a Mac) to paste one straight from the clipboard.",
    es: "El sudoku puede estar en cualquier parte de la imagen, junto a cualquier otra cosa. Pulsa Ctrl+V (Cmd+V en un Mac) para pegar una directamente del portapapeles.",
  },
  "ui.example": { en: "Load an example puzzle", es: "Cargar un ejemplo" },
  "ui.clear": { en: "Clear the grid", es: "Vaciar la cuadrícula" },
  "ui.exampleLoaded": {
    en: "Loaded an example puzzle. Ask for the next move below.",
    es: "Ejemplo cargado. Pide el siguiente movimiento abajo.",
  },
  "ui.cleared": {
    en: "Grid cleared. Type a puzzle in, or load a screenshot.",
    es: "Cuadrícula vacía. Escribe un pasatiempo o carga una captura.",
  },
  "ui.fromLink": { en: "Loaded the puzzle from the link.", es: "Pasatiempo cargado desde el enlace." },
  "ui.readerDetails": { en: "What the reader saw", es: "Lo que vio el lector" },
  "ui.readerSource": {
    en: "The picture you gave it, with the grid it found outlined.",
    es: "La imagen que le diste, con la cuadrícula encontrada marcada.",
  },
  "ui.readerWarp": {
    en: "The same grid pulled flat. This is what the digit reader works on.",
    es: "La misma cuadrícula puesta plana. Esto es sobre lo que trabaja el lector de cifras.",
  },
  "ui.step2": { en: "2. Check the grid", es: "2. Revisa la cuadrícula" },
  "ui.step2.note": {
    en: "Select a cell and type a digit to fix anything the reader got wrong. Press Backspace to empty a cell. Cells the reader was unsure about are marked.",
    es: "Selecciona una celda y escribe una cifra para corregir lo que el lector no acertó. Pulsa Retroceso para vaciar una celda. Las celdas dudosas están marcadas.",
  },
  "ui.showCandidates": {
    en: "Show the candidates left in each empty cell",
    es: "Mostrar los candidatos que quedan en cada celda vacía",
  },
  "ui.copyLink": { en: "Copy a link to this grid", es: "Copiar un enlace a esta cuadrícula" },
  "ui.copied": { en: "Link copied.", es: "Enlace copiado." },
  "ui.copyFailed": { en: "Copy failed. Use the address bar instead.", es: "No se pudo copiar. Usa la barra de direcciones." },
  "ui.step3": { en: "3. Get the move", es: "3. Consigue el movimiento" },
  "ui.mode.hint": { en: "Next best move", es: "Mejor movimiento" },
  "ui.mode.solution": { en: "Full solution", es: "Solución completa" },
  "ui.glossary": { en: "The techniques it knows", es: "Las técnicas que conoce" },
  "ui.glossary.note": {
    en: "The coach always offers the easiest technique that works on your grid, the way a teacher would. These are the ones it can find and explain, from the simplest to the hardest.",
    es: "El entrenador siempre ofrece la técnica más fácil que funcione en tu cuadrícula, como haría un profesor. Estas son las que sabe encontrar y explicar, de la más simple a la más difícil.",
  },
  "ui.footer": {
    en: "Everything runs in your browser. The picture never leaves your device, and nothing is uploaded.",
    es: "Todo funciona en tu navegador. La imagen nunca sale de tu dispositivo y no se sube nada.",
  },
  "ui.whyForced": { en: "Why this is forced", es: "Por qué es obligado" },
  "ui.apply.place": { en: "Place it and show the next move", es: "Colocarlo y ver el siguiente movimiento" },
  "ui.apply.eliminate": { en: "Apply it and show the next move", es: "Aplicarlo y ver el siguiente movimiento" },
  "ui.apply.fallback": { en: "Place {digit} in {cell}", es: "Colocar el {digit} en {cell}" },
  "ui.unlocks": { en: "What it opens up:", es: "Lo que abre:" },
  "ui.unlocksBody": {
    en: "once those candidates are gone, {title} becomes a {technique}.",
    es: "una vez fuera esos candidatos, {title} pasa a ser una {technique}.",
  },
  "ui.solvedTitle": { en: "Solved", es: "Resuelto" },
  "ui.steps": { en: "Steps", es: "Pasos" },
  "ui.digitsPlaced": { en: "Digits placed", es: "Cifras colocadas" },
  "ui.hardest": { en: "Hardest technique", es: "Técnica más difícil" },
  "ui.noneNeeded": { en: "None needed", es: "Ninguna necesaria" },
  "ui.techniquesUsed": { en: "Techniques used", es: "Técnicas usadas" },
  "ui.everyStep": {
    en: "Every step, in order. Select one to see why it works.",
    es: "Todos los pasos, en orden. Selecciona uno para ver por qué funciona.",
  },
  "ui.fillSolution": { en: "Fill the grid with the solution", es: "Rellenar con la solución" },
  "ui.step": { en: "Step {n}", es: "Paso {n}" },
  "ui.language": { en: "Language", es: "Idioma" },
  "ui.cellLabel": { en: "{cell}, {digit}", es: "{cell}, {digit}" },
  "ui.cellEmpty": { en: "{cell}, empty", es: "{cell}, vacía" },
  "ui.boardLabel": { en: "Sudoku grid", es: "Cuadrícula de sudoku" },
  "ui.notAnImage": {
    en: "That was not an image. Drop a screenshot or a photo of a puzzle.",
    es: "Eso no era una imagen. Suelta una captura o una foto de un pasatiempo.",
  },
};

/**
 * Choose the language to use.
 * @param {string|null} requested a code asked for, usually from the URL
 * @param {string[]} [preferred] the browser's languages, most wanted first
 * @returns {string} a code this page really has
 */
export function pickLanguage(requested, preferred = []) {
  if (LANGUAGE_CODES.includes(requested)) return requested;
  for (const tag of preferred) {
    const base = String(tag).toLowerCase().split("-")[0];
    if (LANGUAGE_CODES.includes(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Look a message up and fill its placeholders.
 * An unknown language falls back to English, and an unknown key returns itself,
 * so a missing translation shows up instead of blanking the page.
 * @param {string} lang language code
 * @param {string} key catalogue key
 * @param {Record<string, string|number>} [params] values for the `{name}` slots
 */
export function t(lang, key, params = {}) {
  const entry = MESSAGES[key];
  if (!entry) return key;
  const template = entry[lang] ?? entry[DEFAULT_LANGUAGE] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Join names into a phrase: "a, b and c" in English, "a, b y c" in Spanish. */
export function joinList(lang, names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} ${t(lang, "list.and")} ${names[names.length - 1]}`;
}
