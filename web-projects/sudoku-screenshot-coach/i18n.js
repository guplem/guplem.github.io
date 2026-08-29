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
  "category.chain": { en: "Chain", es: "Cadena" },
  "category.uniqueness": { en: "One answer only", es: "Solución única" },

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

  "technique.hidden-quad.name": { en: "Hidden Quad", es: "Cuarteto escondido" },
  "technique.hidden-quad.summary": {
    en: "Four digits that fit in only four cells of a house.",
    es: "Cuatro cifras que solo caben en cuatro celdas de una casa.",
  },
  "technique.hidden-quad.how": {
    en: "Find four digits that have no place left in a house outside the same four cells. Those cells take those four digits, so every other candidate leaves them.",
    es: "Busca cuatro cifras que no tengan sitio en una casa fuera de las mismas cuatro celdas. Esas celdas llevan esas cuatro cifras, así que cualquier otro candidato sale de ellas.",
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

  "technique.skyscraper.name": { en: "Skyscraper", es: "Rascacielos" },
  "technique.skyscraper.summary": {
    en: "Two short lines for one digit, joined at one end.",
    es: "Dos líneas cortas para una cifra, unidas por un extremo.",
  },
  "technique.skyscraper.how": {
    en: "Find two rows in which a digit has only two places each, with one place of each row in the same column. Those two places cannot both hold the digit, so one of the two remaining places must. The digit leaves every cell that sees both of them. It also works with rows and columns swapped.",
    es: "Busca dos filas en las que una cifra tenga solo dos sitios cada una, con un sitio de cada fila en la misma columna. Esos dos sitios no pueden llevar los dos la cifra, así que uno de los dos sitios restantes tiene que llevarla. La cifra sale de toda celda que vea a los dos. También sirve cambiando filas por columnas.",
  },

  "technique.two-string-kite.name": { en: "Two-String Kite", es: "Cometa de dos cuerdas" },
  "technique.two-string-kite.summary": {
    en: "A row and a column for one digit, joined inside a box.",
    es: "Una fila y una columna para una cifra, unidas dentro de una caja.",
  },
  "technique.two-string-kite.how": {
    en: "Find a row and a column in which a digit has only two places each, with one place of the row and one place of the column in the same box. Those two cannot both hold the digit, so one of the two far ends must. The digit leaves every cell that sees both ends.",
    es: "Busca una fila y una columna en las que una cifra tenga solo dos sitios cada una, con un sitio de la fila y un sitio de la columna en la misma caja. Esos dos no pueden llevar los dos la cifra, así que uno de los dos extremos lejanos tiene que llevarla. La cifra sale de toda celda que vea a los dos extremos.",
  },

  "technique.w-wing.name": { en: "W-Wing", es: "W-Wing" },
  "technique.w-wing.summary": {
    en: "Two cells with the same pair, joined by a strong link.",
    es: "Dos celdas con el mismo par, unidas por un enlace fuerte.",
  },
  "technique.w-wing.how": {
    en: "Find two cells that hold the same two candidates {a,b} and do not see each other. Then find a house where b has only two places, one seen by each cell. One of those places is b, so the cell that sees it must be a. Either way one of the two cells is a, so a leaves every cell that sees both.",
    es: "Busca dos celdas con los mismos dos candidatos {a,b} que no se vean entre sí. Luego busca una casa donde b solo tenga dos sitios, cada uno visto por una de las celdas. Uno de esos sitios es b, así que la celda que lo ve tiene que ser a. En cualquier caso una de las dos celdas es a, así que a sale de toda celda que vea a las dos.",
  },

  "technique.jellyfish.name": { en: "Jellyfish", es: "Medusa" },
  "technique.jellyfish.summary": {
    en: "The same fish idea, on four rows and four columns.",
    es: "La misma idea del pez, en cuatro filas y cuatro columnas.",
  },
  "technique.jellyfish.how": {
    en: "Find four rows in which a digit has only two, three or four possible cells, and all of them fall inside the same four columns. The digit takes one cell per row and fills all four columns, so it leaves every other cell of those columns. It also works with rows and columns swapped.",
    es: "Busca cuatro filas en las que una cifra tenga solo dos, tres o cuatro celdas posibles, y que todas caigan dentro de las mismas cuatro columnas. La cifra ocupa una celda por fila y llena las cuatro columnas, así que sale de las demás celdas de esas columnas. También sirve cambiando filas por columnas.",
  },

  "technique.remote-pairs.name": { en: "Remote Pairs", es: "Pares remotos" },
  "technique.remote-pairs.summary": {
    en: "A run of cells that all hold the same two digits.",
    es: "Una cadena de celdas que llevan las mismas dos cifras.",
  },
  "technique.remote-pairs.how": {
    en: "Find a run of cells that all hold the same pair {a,b}, where each cell sees the next one. The two digits swap along the run, so two cells an odd number of steps apart always differ. A cell that sees both of those ends loses a and b.",
    es: "Busca una cadena de celdas con el mismo par {a,b}, donde cada celda ve a la siguiente. Las dos cifras se alternan a lo largo de la cadena, así que dos celdas separadas por un número impar de pasos siempre son distintas. Una celda que vea a esos dos extremos pierde a y b.",
  },

  "technique.simple-coloring.name": { en: "Simple Coloring", es: "Coloreado simple" },
  "technique.simple-coloring.summary": {
    en: "Paint one digit in two colours and follow the chain.",
    es: "Pinta una cifra en dos colores y sigue la cadena.",
  },
  "technique.simple-coloring.how": {
    en: "Take a digit and find the houses where it has only two places left. Paint the two places of each house in opposite colours and join the chains. One colour is true and the other is false. A cell that sees both colours cannot hold the digit. If two cells of one colour see each other, that whole colour is false.",
    es: "Coge una cifra y busca las casas donde solo le quedan dos sitios. Pinta los dos sitios de cada casa con colores opuestos y une las cadenas. Un color es verdadero y el otro es falso. Una celda que ve los dos colores no puede llevar la cifra. Si dos celdas del mismo color se ven entre sí, ese color entero es falso.",
  },

  "technique.unique-rectangle.name": { en: "Unique Rectangle", es: "Rectángulo único" },
  "technique.unique-rectangle.summary": {
    en: "A shape that would give the puzzle two answers.",
    es: "Una forma que daría dos soluciones al pasatiempo.",
  },
  "technique.unique-rectangle.how": {
    en: "Find four cells in two rows, two columns and two boxes that all still allow the same two digits. If those cells held only those two digits, the digits could be swapped around the rectangle and the puzzle would have two answers. A puzzle with one answer cannot allow that, so whatever prevents the shape must be true.",
    es: "Busca cuatro celdas en dos filas, dos columnas y dos cajas que sigan admitiendo las mismas dos cifras. Si esas celdas llevaran solo esas dos cifras, se podrían intercambiar alrededor del rectángulo y el pasatiempo tendría dos soluciones. Un pasatiempo con una sola solución no lo permite, así que lo que impide esa forma tiene que ser cierto.",
  },

  "technique.bug-plus-one.name": { en: "BUG+1", es: "BUG+1" },
  "technique.bug-plus-one.summary": {
    en: "One cell with three candidates, and all the rest with two.",
    es: "Una celda con tres candidatos y todas las demás con dos.",
  },
  "technique.bug-plus-one.how": {
    en: "Check that every empty cell holds two candidates except one, which holds three. A grid where every digit has an even number of places in every house always has two answers. This puzzle has one, so the odd cell takes the digit that appears an odd number of times in its row, its column and its box.",
    es: "Comprueba que todas las celdas vacías tienen dos candidatos menos una, que tiene tres. Una cuadrícula donde cada cifra tiene un número par de sitios en cada casa siempre tiene dos soluciones. Este pasatiempo tiene una, así que la celda impar lleva la cifra que aparece un número impar de veces en su fila, su columna y su caja.",
  },

  "technique.xy-chain.name": { en: "XY-Chain", es: "Cadena XY" },
  "technique.xy-chain.summary": {
    en: "A run of two-candidate cells with the same digit at both ends.",
    es: "Una cadena de celdas de dos candidatos con la misma cifra en los dos extremos.",
  },
  "technique.xy-chain.how": {
    en: "Find a run of cells that each hold two candidates, where each cell shares a digit with the next one. Both ends must still allow the same digit z. Follow the run either way and one end comes out as z, so z leaves every cell that sees both ends.",
    es: "Busca una cadena de celdas con dos candidatos cada una, donde cada celda comparte una cifra con la siguiente. Los dos extremos tienen que admitir la misma cifra z. Recorre la cadena en cualquier sentido y un extremo acaba siendo z, así que z sale de toda celda que vea a los dos extremos.",
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

  "explain.chain.conclusion": {
    en: "So no cell that sees both of them can be {digit}.",
    es: "Así que ninguna celda que vea a las dos puede ser {digit}.",
  },

  "explain.skyscraper.1": {
    en: "In {first} and in {second}, the digit {digit} has only two places left: {cells}.",
    es: "En {first} y en {second}, la cifra {digit} solo tiene dos sitios: {cells}.",
  },
  "explain.skyscraper.2": {
    en: "{cells} share {house}, so at most one of them holds the {digit}.",
    es: "{cells} comparten {house}, así que como mucho una de ellas lleva el {digit}.",
  },
  "explain.skyscraper.3": {
    en: "That leaves {first} and {second}, and at least one of those two must be the {digit}.",
    es: "Quedan {first} y {second}, y al menos una de esas dos tiene que ser el {digit}.",
  },

  "explain.two-string-kite.1": {
    en: "In {first} and in {second}, the digit {digit} has only two places left: {cells}.",
    es: "En {first} y en {second}, la cifra {digit} solo tiene dos sitios: {cells}.",
  },
  "explain.two-string-kite.2": {
    en: "{cells} share {house}, so at most one of them holds the {digit}.",
    es: "{cells} comparten {house}, así que como mucho una de ellas lleva el {digit}.",
  },
  "explain.two-string-kite.3": {
    en: "The far ends are {first} and {second}, and at least one of those two must be the {digit}.",
    es: "Los extremos lejanos son {first} y {second}, y al menos uno de esos dos tiene que ser el {digit}.",
  },

  "explain.w-wing.1": {
    en: "{first} and {second} both hold only {a} and {b}, and they do not see each other.",
    es: "{first} y {second} llevan solo {a} y {b}, y no se ven entre sí.",
  },
  "explain.w-wing.2": {
    en: "In {house}, the digit {link} has only two places left: {first} and {second}.",
    es: "En {house}, la cifra {link} solo tiene dos sitios: {first} y {second}.",
  },
  "explain.w-wing.3": {
    en: "If the {link} sits in {linkFirst}, then {first} cannot be {link} and must be {digit}. If it sits in {linkSecond}, then {second} must be {digit}.",
    es: "Si el {link} está en {linkFirst}, entonces {first} no puede ser {link} y tiene que ser {digit}. Si está en {linkSecond}, entonces {second} tiene que ser {digit}.",
  },

  "explain.remote-pairs.1": {
    en: "{cells} all hold only {a} and {b}, and each one sees the next.",
    es: "{cells} llevan solo {a} y {b}, y cada una ve a la siguiente.",
  },
  "explain.remote-pairs.2": {
    en: "The two digits swap along the run, so {first} and {second} can never hold the same digit.",
    es: "Las dos cifras se alternan a lo largo de la cadena, así que {first} y {second} nunca llevan la misma cifra.",
  },
  "explain.remote-pairs.3": {
    en: "Between them those two cells use both {a} and {b}, so a cell that sees both loses the two digits.",
    es: "Entre las dos, esas celdas usan {a} y {b}, así que una celda que vea a las dos pierde las dos cifras.",
  },

  "explain.simple-coloring.1": {
    en: "Follow the digit {digit} through the houses where it has only two places left: {cells}.",
    es: "Sigue la cifra {digit} por las casas donde solo le quedan dos sitios: {cells}.",
  },
  "explain.simple-coloring.2": {
    en: "The chain splits into two groups, {first} and {second}. One group holds the {digit}, the other does not.",
    es: "La cadena se parte en dos grupos, {first} y {second}. Un grupo lleva el {digit} y el otro no.",
  },
  "explain.simple-coloring.trap": {
    en: "Each cell below sees a cell of both groups, so one of the two groups puts a {digit} next to it either way.",
    es: "Cada celda de abajo ve una celda de los dos grupos, así que uno de los dos grupos le pone un {digit} al lado en cualquier caso.",
  },
  "explain.simple-coloring.wrap": {
    en: "{first} and {second} belong to the same group and see each other, so that group cannot be the one that holds the {digit}.",
    es: "{first} y {second} son del mismo grupo y se ven entre sí, así que ese grupo no puede ser el que lleva el {digit}.",
  },

  "explain.xy-chain.1": {
    en: "Each of these cells holds only two candidates and shares a digit with the next one: {cells}.",
    es: "Cada una de estas celdas lleva solo dos candidatos y comparte una cifra con la siguiente: {cells}.",
  },
  "explain.xy-chain.2": {
    en: "The two ends are {first} and {second}, and both still allow {digit}.",
    es: "Los dos extremos son {first} y {second}, y los dos siguen admitiendo el {digit}.",
  },
  "explain.xy-chain.3": {
    en: "Follow the run from either end and one of those two cells comes out as {digit}.",
    es: "Recorre la cadena desde cualquier extremo y una de esas dos celdas acaba siendo {digit}.",
  },

  "explain.unique-rectangle.1": {
    en: "{cells} form a rectangle across two rows, two columns and two boxes, and all four still allow {a} and {b}.",
    es: "{cells} forman un rectángulo en dos filas, dos columnas y dos cajas, y las cuatro siguen admitiendo {a} y {b}.",
  },
  "explain.unique-rectangle.2": {
    en: "If those four cells held only {a} and {b}, the two digits could be swapped around the rectangle and this puzzle would have two answers. It has one, so that cannot happen.",
    es: "Si esas cuatro celdas llevaran solo {a} y {b}, las dos cifras se podrían intercambiar alrededor del rectángulo y este pasatiempo tendría dos soluciones. Solo tiene una, así que eso no puede pasar.",
  },
  "explain.unique-rectangle.type1": {
    en: "{cell} is the only corner with other candidates, so it has to take one of them. It can be neither {a} nor {b}.",
    es: "{cell} es la única esquina con otros candidatos, así que tiene que llevar uno de ellos. No puede ser ni {a} ni {b}.",
  },
  "explain.unique-rectangle.type2": {
    en: "{first} and {second} both carry the same extra digit {digit}, and one of the two has to take it.",
    es: "{first} y {second} llevan la misma cifra extra {digit}, y una de las dos tiene que cogerla.",
  },
  "explain.unique-rectangle.type3": {
    en: "{first} and {second} take their extra digits between them. With {cells} that gives the digits {digits} their own cells inside {house}, so no other cell of {house} can hold them.",
    es: "{first} y {second} se reparten sus cifras extra. Junto con {cells}, eso da a las cifras {digits} sus propias celdas dentro de {house}, así que ninguna otra celda de {house} puede llevarlas.",
  },
  "explain.unique-rectangle.type4": {
    en: "In {house}, the digit {keep} has no place left outside {first} and {second}, so one of them is {keep}. If the other were {drop}, the rectangle would close, so {drop} leaves both cells.",
    es: "En {house}, la cifra {keep} no tiene sitio fuera de {first} y {second}, así que una de las dos es {keep}. Si la otra fuera {drop}, el rectángulo se cerraría, así que el {drop} sale de las dos celdas.",
  },

  "explain.bug-plus-one.1": {
    en: "Every empty cell holds exactly two candidates, except {cell}, which holds three.",
    es: "Todas las celdas vacías tienen exactamente dos candidatos, menos {cell}, que tiene tres.",
  },
  "explain.bug-plus-one.2": {
    en: "A grid where every digit has an even number of places in every house always has two answers. This puzzle has one, so the odd cell has to break that shape.",
    es: "Una cuadrícula donde cada cifra tiene un número par de sitios en cada casa siempre tiene dos soluciones. Este pasatiempo tiene una, así que la celda impar tiene que romper esa forma.",
  },
  "explain.bug-plus-one.3": {
    en: "{digit} is the one digit that appears an odd number of times in the row, the column and the box of {cell}, so {cell} takes it.",
    es: "El {digit} es la única cifra que aparece un número impar de veces en la fila, la columna y la caja de {cell}, así que {cell} lo lleva.",
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
  "coach.next.one": {
    en: "One cell left. Easiest move available: {technique}.",
    es: "Queda una celda. El movimiento más fácil disponible es: {technique}.",
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
  "difficulty.expert.blurb": {
    en: "Needs a fish, a wing or a single-digit pattern.",
    es: "Necesita un patrón de pez, de ala o de una sola cifra.",
  },
  "difficulty.master": { en: "Master", es: "Maestra" },
  "difficulty.master.blurb": {
    en: "Needs a chain, or the fact that the puzzle has one answer.",
    es: "Necesita una cadena, o el hecho de que el pasatiempo tiene una sola solución.",
  },
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
  "read.count.one": { en: "Read one digit.", es: "Leída una cifra." },
  "read.repaired": {
    en: "The rules of sudoku showed some readings were wrong, so it corrected {list}.",
    es: "Las reglas del sudoku mostraron que algunas lecturas eran incorrectas, así que se han corregido {list}.",
  },
  "read.repaired.one": {
    en: "The rules of sudoku showed a reading was wrong, so it corrected {list}.",
    es: "Las reglas del sudoku mostraron que una lectura era incorrecta, así que se ha corregido {list}.",
  },
  "read.repair.item": { en: "{cell} ({from} to {to})", es: "{cell} ({from} a {to})" },
  "read.repair.empty": { en: "empty", es: "vacía" },
  "read.uncertain": {
    en: "{count} cells are marked as doubtful. Check them before you trust the advice.",
    es: "{count} celdas están marcadas como dudosas. Revísalas antes de fiarte del consejo.",
  },
  "read.uncertain.one": {
    en: "One cell is marked as doubtful. Check it before you trust the advice.",
    es: "Una celda está marcada como dudosa. Revísala antes de fiarte del consejo.",
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
  "ui.copyLink": { en: "Copy a link to this grid", es: "Copiar un enlace a esta cuadrícula" },
  "ui.showCandidates": {
    en: "Show the notes the coach works out for each empty cell",
    es: "Mostrar las notas que el entrenador deduce para cada celda vacía",
  },
  "ui.showCandidates.note": {
    en: "The tool never reads the pencil marks in your picture. It works these notes out from the grid, and it applies every elimination it can prove, so its list is often shorter than the one your sudoku app shows.",
    es: "La herramienta nunca lee las anotaciones a lápiz de tu imagen. Deduce estas notas de la cuadrícula y aplica cada descarte que puede demostrar, así que su lista suele ser más corta que la de tu aplicación de sudoku.",
  },
  "ui.cellNotes": { en: "Notes in {cell}", es: "Notas en {cell}" },
  "ui.cellNotes.filled": {
    en: "{cell} holds {digit}. Notes are kept for empty cells only.",
    es: "{cell} contiene {digit}. Las notas solo se guardan para las celdas vacías.",
  },
  "ui.cellNotes.left": { en: "Still possible: {list}.", es: "Todavía posibles: {list}." },
  "ui.cellNotes.none": {
    en: "No digit fits here. A digit somewhere else in the grid must be wrong.",
    es: "Aquí no cabe ninguna cifra. Alguna cifra en otro punto de la cuadrícula tiene que estar mal.",
  },
  "ui.cellNotes.plain": { en: "The rules alone allow {list}.", es: "Solo con las reglas caben {list}." },
  "ui.cellNotes.ruledOut": {
    en: "The coach ruled the rest out. Select one to see the technique that did it:",
    es: "El entrenador descartó el resto. Selecciona uno para ver la técnica que lo hizo:",
  },
  "ui.cellNotes.kept": {
    en: "The coach could rule none of them out.",
    es: "El entrenador no pudo descartar ninguna.",
  },
  "ui.narrowing": {
    en: "How the candidates were narrowed ({count} steps)",
    es: "Cómo se han reducido los candidatos ({count} pasos)",
  },
  "ui.narrowing.note": {
    en: "These are already applied: they are why the grid shows what it shows. Select one to see the technique that ruled those candidates out.",
    es: "Ya están aplicados: son la razón de lo que muestra la cuadrícula. Selecciona uno para ver la técnica que descartó esos candidatos.",
  },
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
    en: "The puzzle is read in your browser. Your picture never leaves your device and is never uploaded.",
    es: "El pasatiempo se lee en tu navegador. Tu imagen nunca sale de tu dispositivo y nunca se sube.",
  },
  "ui.deployed": { en: "Deployed {date} by pull request {pr}.", es: "Desplegado el {date} por la pull request {pr}." },
  "ui.deployedNoPull": { en: "Deployed {date}, commit {commit}.", es: "Desplegado el {date}, commit {commit}." },
  // Shown when GitHub does not answer. The date still comes from this page's own
  // headers, so the line says what it knows instead of going blank.
  "ui.deployedDateOnly": { en: "Deployed {date}. See {history}.", es: "Desplegado el {date}. Ver {history}." },
  "ui.deployedUnknown": { en: "Published from the main branch. See {history}.", es: "Publicado desde la rama main. Ver {history}." },
  "ui.deployHistory": { en: "what changed", es: "qué cambió" },
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
