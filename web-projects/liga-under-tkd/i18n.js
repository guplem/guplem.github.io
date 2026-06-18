// Internationalization: pure functions + the translations table. No DOM access here.
//
// Three languages: Catalan (ca), Spanish (es), English (en).
// `detectLanguage` picks the browser language among the supported ones, falling back to Spanish.
// `t` looks up a dotted key for a language, falling back to the default language, then the key.
//
// GLOSSARY NOTE (needs organizer confirmation, see SETUP.md):
//   tatami / round (asalto·assalt) / combat — current values are safe guesses.

export const TRANSLATIONS = Object.freeze({
  ca: {
    "lang.name": "Català",
    "brand.title": "Liga UNDER",
    "brand.tagline": "Més experiència. Més combat. Més taekwondo.",

    "nav.home": "Inici",
    "nav.fields": "Per tatami",
    "nav.groups": "Per grup",
    "nav.athletes": "Esportistes",

    "status.live": "En directe",
    "status.demo": "Mode demostració (dades de prova)",
    "status.loading": "Carregant…",
    "status.error": "No s'han pogut carregar les dades. Reintentant…",

    "home.eventTitle": "Taekwondo · Cadet i Júnior",
    "home.date": "27 de juny de 2026",
    "home.place": "Camí del Mig, 62 · Premià de Mar",
    "home.freeEntry": "Entrada al pavelló gratuïta",
    "home.limited": "Places limitades",
    "home.guaranteed": "Mínim 3 combats garantits",
    "home.cta": "Veure els combats",
    "home.followUs": "Segueix-nos",
    "home.sponsorsTitle": "Amb el suport de",
    "home.countdownTitle": "Compte enrere",
    "home.started": "La competició ja ha començat!",
    "countdown.days": "dies",
    "countdown.hours": "h",
    "countdown.minutes": "min",
    "countdown.seconds": "s",

    "fields.title": "Combats per tatami",
    "fields.tatami": "Tatami {n}",
    "fields.all": "Tots",
    "fields.current": "En joc ara",
    "fields.next": "Següent",
    "fields.empty": "Encara no hi ha combats en aquest tatami.",
    "fields.emptyAll": "Encara no s'ha publicat cap combat.",
    "combat.label": "Combat {n}",
    "combat.vs": "vs",
    "combat.round": "Assalt {n}",
    "combat.winner": "Guanyador",

    "groups.title": "Combats per grup",
    "groups.select": "Tria un grup",
    "groups.standings": "Classificació",
    "groups.matrix": "Graella de combats",
    "groups.rows": "Files",
    "groups.columns": "Columnes",
    "groups.empty": "Encara no s'ha sortejat cap grup.",
    "groups.noFinished": "Encara no hi ha combats acabats en aquest grup.",
    "groups.pool": "Pool {n}",

    "standings.pos": "Pos",
    "standings.athlete": "Esportista",
    "standings.played": "PJ",
    "standings.won": "G",
    "standings.drawn": "E",
    "standings.lost": "P",
    "standings.pointsFor": "PF",
    "standings.pointsAgainst": "PC",
    "standings.diff": "Dif",
    "standings.points": "Punts",
    "standings.playedFull": "Jugats",
    "standings.wonFull": "Guanyats",
    "standings.drawnFull": "Empatats",
    "standings.lostFull": "Perduts",
    "standings.pointsForFull": "Punts a favor",
    "standings.pointsAgainstFull": "Punts en contra",

    "athlete.title": "Esportistes",
    "athlete.search": "Cerca per nom o ID (ex: P001)…",
    "athlete.noResults": "Cap esportista trobat.",
    "athlete.searchHint": "Escriu un nom per buscar un esportista.",
    "athlete.group": "Grup",
    "athlete.noGroup": "Encara sense grup assignat.",
    "athlete.rank": "Posició al grup",
    "athlete.record": "Balanç",
    "athlete.nextCombat": "Pròxim combat",
    "athlete.pastCombats": "Combats jugats",
    "athlete.noNext": "Sense combats pendents.",
    "athlete.noPast": "Encara no ha jugat cap combat.",
    "athlete.viewGroup": "Veure el grup",
    "athlete.result.won": "Guanyat",
    "athlete.result.lost": "Perdut",
    "athlete.result.drawn": "Empatat",

    "token.sex.Masculino": "Masculí",
    "token.sex.Femenino": "Femení",
    "token.age.Cadete": "Cadet",
    "token.age.Junior": "Júnior",
    "token.status.Scheduled": "Programat",
    "token.status.Ongoing": "En joc",
    "token.status.Finished": "Acabat",
    "token.status.Cancelled": "Cancel·lat",
    "token.side.Red": "Vermell",
    "token.side.Blue": "Blau",
  },

  es: {
    "lang.name": "Español",
    "brand.title": "Liga UNDER",
    "brand.tagline": "Más experiencia. Más combate. Más taekwondo.",

    "nav.home": "Inicio",
    "nav.fields": "Por tatami",
    "nav.groups": "Por grupo",
    "nav.athletes": "Deportistas",

    "status.live": "En directo",
    "status.demo": "Modo demostración (datos de prueba)",
    "status.loading": "Cargando…",
    "status.error": "No se pudieron cargar los datos. Reintentando…",

    "home.eventTitle": "Taekwondo · Cadete y Junior",
    "home.date": "27 de junio de 2026",
    "home.place": "Camí del Mig, 62 · Premià de Mar",
    "home.freeEntry": "Entrada al pabellón gratuita",
    "home.limited": "Plazas limitadas",
    "home.guaranteed": "Mínimo 3 combates garantizados",
    "home.cta": "Ver los combates",
    "home.followUs": "Síguenos",
    "home.sponsorsTitle": "Con el apoyo de",
    "home.countdownTitle": "Cuenta atrás",
    "home.started": "¡La competición ya ha empezado!",
    "countdown.days": "días",
    "countdown.hours": "h",
    "countdown.minutes": "min",
    "countdown.seconds": "s",

    "fields.title": "Combates por tatami",
    "fields.tatami": "Tatami {n}",
    "fields.all": "Todos",
    "fields.current": "En juego ahora",
    "fields.next": "Siguiente",
    "fields.empty": "Todavía no hay combates en este tatami.",
    "fields.emptyAll": "Todavía no se ha publicado ningún combate.",
    "combat.label": "Combate {n}",
    "combat.vs": "vs",
    "combat.round": "Asalto {n}",
    "combat.winner": "Ganador",

    "groups.title": "Combates por grupo",
    "groups.select": "Elige un grupo",
    "groups.standings": "Clasificación",
    "groups.matrix": "Cuadro de combates",
    "groups.rows": "Filas",
    "groups.columns": "Columnas",
    "groups.empty": "Todavía no se ha sorteado ningún grupo.",
    "groups.noFinished": "Todavía no hay combates terminados en este grupo.",
    "groups.pool": "Pool {n}",

    "standings.pos": "Pos",
    "standings.athlete": "Deportista",
    "standings.played": "PJ",
    "standings.won": "G",
    "standings.drawn": "E",
    "standings.lost": "P",
    "standings.pointsFor": "PF",
    "standings.pointsAgainst": "PC",
    "standings.diff": "Dif",
    "standings.points": "Puntos",
    "standings.playedFull": "Jugados",
    "standings.wonFull": "Ganados",
    "standings.drawnFull": "Empatados",
    "standings.lostFull": "Perdidos",
    "standings.pointsForFull": "Puntos a favor",
    "standings.pointsAgainstFull": "Puntos en contra",

    "athlete.title": "Deportistas",
    "athlete.search": "Busca por nombre o ID (ej: P001)…",
    "athlete.noResults": "Ningún deportista encontrado.",
    "athlete.searchHint": "Escribe un nombre para buscar un deportista.",
    "athlete.group": "Grupo",
    "athlete.noGroup": "Todavía sin grupo asignado.",
    "athlete.rank": "Posición en el grupo",
    "athlete.record": "Balance",
    "athlete.nextCombat": "Próximo combate",
    "athlete.pastCombats": "Combates jugados",
    "athlete.noNext": "Sin combates pendientes.",
    "athlete.noPast": "Todavía no ha jugado ningún combate.",
    "athlete.viewGroup": "Ver el grupo",
    "athlete.result.won": "Ganado",
    "athlete.result.lost": "Perdido",
    "athlete.result.drawn": "Empatado",

    "token.sex.Masculino": "Masculino",
    "token.sex.Femenino": "Femenino",
    "token.age.Cadete": "Cadete",
    "token.age.Junior": "Junior",
    "token.status.Scheduled": "Programado",
    "token.status.Ongoing": "En juego",
    "token.status.Finished": "Terminado",
    "token.status.Cancelled": "Cancelado",
    "token.side.Red": "Rojo",
    "token.side.Blue": "Azul",
  },

  en: {
    "lang.name": "English",
    "brand.title": "Liga UNDER",
    "brand.tagline": "More experience. More fighting. More taekwondo.",

    "nav.home": "Home",
    "nav.fields": "By tatami",
    "nav.groups": "By group",
    "nav.athletes": "Athletes",

    "status.live": "Live",
    "status.demo": "Demo mode (sample data)",
    "status.loading": "Loading…",
    "status.error": "Could not load data. Retrying…",

    "home.eventTitle": "Taekwondo · Cadet and Junior",
    "home.date": "27 June 2026",
    "home.place": "Camí del Mig, 62 · Premià de Mar",
    "home.freeEntry": "Free entry to the venue",
    "home.limited": "Limited spots",
    "home.guaranteed": "At least 3 combats guaranteed",
    "home.cta": "See the combats",
    "home.followUs": "Follow us",
    "home.sponsorsTitle": "Supported by",
    "home.countdownTitle": "Countdown",
    "home.started": "The competition has started!",
    "countdown.days": "days",
    "countdown.hours": "h",
    "countdown.minutes": "min",
    "countdown.seconds": "s",

    "fields.title": "Combats by tatami",
    "fields.tatami": "Tatami {n}",
    "fields.all": "All",
    "fields.current": "On now",
    "fields.next": "Next",
    "fields.empty": "No combats on this tatami yet.",
    "fields.emptyAll": "No combats published yet.",
    "combat.label": "Combat {n}",
    "combat.vs": "vs",
    "combat.round": "Round {n}",
    "combat.winner": "Winner",

    "groups.title": "Combats by group",
    "groups.select": "Choose a group",
    "groups.standings": "Standings",
    "groups.matrix": "Combat grid",
    "groups.rows": "Rows",
    "groups.columns": "Columns",
    "groups.empty": "No group has been drawn yet.",
    "groups.noFinished": "No finished combats in this group yet.",
    "groups.pool": "Pool {n}",

    "standings.pos": "Pos",
    "standings.athlete": "Athlete",
    "standings.played": "P",
    "standings.won": "W",
    "standings.drawn": "D",
    "standings.lost": "L",
    "standings.pointsFor": "PF",
    "standings.pointsAgainst": "PA",
    "standings.diff": "Diff",
    "standings.points": "Pts",
    "standings.playedFull": "Played",
    "standings.wonFull": "Won",
    "standings.drawnFull": "Drawn",
    "standings.lostFull": "Lost",
    "standings.pointsForFull": "Points for",
    "standings.pointsAgainstFull": "Points against",

    "athlete.title": "Athletes",
    "athlete.search": "Search by name or ID (e.g. P001)…",
    "athlete.noResults": "No athlete found.",
    "athlete.searchHint": "Type a name to find an athlete.",
    "athlete.group": "Group",
    "athlete.noGroup": "No group assigned yet.",
    "athlete.rank": "Group position",
    "athlete.record": "Record",
    "athlete.nextCombat": "Next combat",
    "athlete.pastCombats": "Past combats",
    "athlete.noNext": "No upcoming combats.",
    "athlete.noPast": "No combats played yet.",
    "athlete.viewGroup": "View the group",
    "athlete.result.won": "Won",
    "athlete.result.lost": "Lost",
    "athlete.result.drawn": "Drawn",

    "token.sex.Masculino": "Male",
    "token.sex.Femenino": "Female",
    "token.age.Cadete": "Cadet",
    "token.age.Junior": "Junior",
    "token.status.Scheduled": "Scheduled",
    "token.status.Ongoing": "Ongoing",
    "token.status.Finished": "Finished",
    "token.status.Cancelled": "Cancelled",
    "token.side.Red": "Red",
    "token.side.Blue": "Blue",
  },
});

// Pick the best language code among `supported`, given the browser's preference list.
// Matches by primary subtag, so "es-ES" matches "es". Falls back to `fallback`.
export function detectLanguage(navigatorLanguages, supported = ["ca", "es", "en"], fallback = "es") {
  const prefs = Array.isArray(navigatorLanguages) ? navigatorLanguages : [];
  for (const pref of prefs) {
    if (typeof pref !== "string") continue;
    const primary = pref.toLowerCase().split("-")[0];
    if (supported.includes(primary)) return primary;
  }
  return fallback;
}

// Look up a translation key for a language. Falls back to Spanish, then the raw key.
// Optional `params` fills "{name}" placeholders in the string.
export function t(lang, key, params = null) {
  const table = TRANSLATIONS[lang] || TRANSLATIONS.es;
  let value = table[key];
  if (value === undefined) value = TRANSLATIONS.es[key];
  if (value === undefined) return key;
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      value = value.split("{" + name + "}").join(String(replacement));
    }
  }
  return value;
}

// Translate a stored data token (e.g. Sex "Masculino", Status "Finished", Side "Red").
// Unknown tokens are returned unchanged so the UI never shows a blank.
export function translateToken(lang, kind, token) {
  if (token === null || token === undefined || token === "") return "";
  const translated = t(lang, "token." + kind + "." + token);
  return translated === "token." + kind + "." + token ? String(token) : translated;
}
