// Tests for the Wiktionary reader.
//
// One module decides two things: which words go in the list (at build time,
// over the whole dump) and which senses the page shows (at run time, over one
// page). The fixtures are trimmed copies of real es.wiktionary.org pages.

import { describe, expect, test } from "bun:test";
import {
  cleanDefinition,
  isCandidate,
  isEligibleWord,
  isFormOfCommonerVerb,
  isUsableInSpain,
  parseEntries,
  spainEntries,
  spanishSection,
  verbFormsOf,
} from "./wikitext.js";

const CARRO = `== {{lengua|es}} ==
{{pron-graf}}

=== Etimología ===
{{etimología|la|carrus}}.<ref>{{DRAE2001}}</ref>

==== {{sustantivo masculino|es}} ====
{{es.sust}}
;1 {{csem|vehículos}}: {{plm|vehículo}} de uno o dos ejes impulsado por [[bestia]]s de [[tiro]].
{{sinónimo|carruaje|coche}}
;2 {{csem|vehículos}}: Vehículo de cuatro [[rueda]]s, propulsado por un [[motor]].
{{ámbito|América Central|Caribe|México}}
{{sinónimo|auto|nota1=Argentina}}
;3 {{csem|vehículos}}: {{plm|bus}} usado en el transporte público.
{{ámbito|Perú}}
{{uso|informal}}
;4: Parte móvil de una [[máquina de escribir]] donde se coloca el [[papel]].

==== Locuciones ====
*[[carro de combate]]: Vehículo de ataque.

== {{lengua|gl}} ==
==== {{sustantivo masculino|gl}} ====
;1: Carro en gallego.
`;

const EMPERO = `== {{lengua|es}} ==
=== Etimología 1 ===
==== {{conjunción|es|adversativa}} ====
;1: {{plm|conjunción}} [[adversativo|adversativa]] que se usa pospuesta.
{{uso|anticuado|literario|culto|formal}}

==== {{adverbio|es|conjuntivo}} ====
;2: {{plm|sin embargo}}.
{{uso|anticuado|literario|culto|formal}}
`;

const COMIENDO = `== {{lengua|es}} ==
{{pron-graf}}

=== Forma verbal ===

;1: {{gerundio|comer}}.
`;

const GUAGUA = `== {{lengua|es}} ==
=== Etimología 1 ===
==== {{sustantivo femenino|es}} ====
;1: {{plm|niño}} [[recién nacido]] o de muy corta [[edad]].
{{ámbito|Argentina|nota=Cuyo|Bolivia|Chile}}

=== Etimología 2 ===
==== {{sustantivo femenino|es}} ====
;1 {{csem|transporte}}: {{plm|vehículo}} con ruedas destinado al transporte colectivo.
{{ámbito|Cuba|Canarias|Puerto Rico}}
`;

describe("spanishSection", () => {
  test("keeps the Spanish section and stops at the next language", () => {
    const section = spanishSection(CARRO);
    expect(section).toContain("bestia");
    expect(section).not.toContain("gallego");
  });

  test("returns null for a page with no Spanish section", () => {
    expect(spanishSection("== {{lengua|gl}} ==\n;1: Algo.")).toBeNull();
  });
});

describe("cleanDefinition", () => {
  test("turns links into their shown text", () => {
    expect(cleanDefinition("tirado por [[bestia]]s de [[tiro]]")).toBe("tirado por bestias de tiro");
    expect(cleanDefinition("[[adversativo|adversativa]]")).toBe("adversativa");
  });

  test("capitalises the word a plm template holds", () => {
    expect(cleanDefinition("{{plm|vehículo}} de uno o dos ejes")).toBe("Vehículo de uno o dos ejes");
  });

  test("keeps the word of an l or l+ template", () => {
    expect(cleanDefinition("Parecido a {{l|es|perro}} y {{l+|es|lobo}}")).toBe("Parecido a perro y lobo");
  });

  test("drops references, other templates, bold and italics", () => {
    expect(cleanDefinition("Uno ''dos'' '''tres'''<ref>{{DRAE2001}}</ref>{{ampliable}}.")).toBe("Uno dos tres.");
  });

  test("decodes the entities a dump carries", () => {
    expect(cleanDefinition("A &amp; B &lt;br&gt; C")).toBe("A & B C");
  });
});

describe("parseEntries", () => {
  test("reads each part of speech and each numbered sense", () => {
    const [noun] = parseEntries(CARRO);
    expect(noun.pos).toBe("sustantivo masculino");
    expect(noun.senses.map((s) => s.number)).toEqual([1, 2, 3, 4]);
    expect(noun.senses[0].text).toBe("Vehículo de uno o dos ejes impulsado por bestias de tiro.");
    expect(noun.senses[0].topic).toBe("vehículos");
  });

  test("reads the region and the usage labels under a sense", () => {
    const [noun] = parseEntries(CARRO);
    expect(noun.senses[1].regions).toEqual(["América Central", "Caribe", "México"]);
    expect(noun.senses[2].uses).toEqual(["informal"]);
    expect(noun.senses[3].regions).toEqual([]);
  });

  test("ignores the named notes inside a region label", () => {
    const [first] = parseEntries(GUAGUA);
    expect(first.senses[0].regions).toEqual(["Argentina", "Bolivia", "Chile"]);
  });

  test("leaves out the phrase lists after the senses", () => {
    const [noun] = parseEntries(CARRO);
    expect(noun.senses.some((s) => s.text.includes("ataque"))).toBe(false);
  });

  test("marks an inflected form as a form, not a lemma", () => {
    const [form] = parseEntries(COMIENDO);
    expect(form.pos).toBe("forma verbal");
    expect(form.lemma).toBe(false);
  });

  test("reads the part of speech of a template with extra words", () => {
    expect(parseEntries(EMPERO).map((e) => e.pos)).toEqual(["conjunción", "adverbio"]);
  });
});

describe("isUsableInSpain", () => {
  const sense = (regions = [], uses = []) => ({ number: 1, text: "x", topic: "", regions, uses });

  test("accepts a sense with no region", () => {
    expect(isUsableInSpain(sense())).toBe(true);
  });

  test("accepts a sense whose regions include Spain", () => {
    expect(isUsableInSpain(sense(["España", "México"]))).toBe(true);
  });

  test("rejects a sense used only outside Spain", () => {
    expect(isUsableInSpain(sense(["México"]))).toBe(false);
    expect(isUsableInSpain(sense(["Cuba", "Canarias"]))).toBe(false);
  });

  test("rejects old, rare and cultured senses", () => {
    for (const label of ["anticuado", "desusado", "obsoleto", "poco usado", "raro", "culto", "literario", "poético"]) {
      expect(isUsableInSpain(sense([], [label]))).toBe(false);
    }
  });

  test("accepts everyday usage labels", () => {
    expect(isUsableInSpain(sense([], ["coloquial", "figurado"]))).toBe(true);
  });
});

describe("spainEntries", () => {
  test("keeps only the senses usable in Spain", () => {
    const [noun] = spainEntries(CARRO);
    expect(noun.senses.map((s) => s.number)).toEqual([1, 4]);
  });

  test("drops a part of speech with no sense left", () => {
    expect(spainEntries(GUAGUA)).toEqual([]);
  });
});

describe("isEligibleWord", () => {
  test("takes a noun with a sense usable in Spain", () => {
    expect(isEligibleWord(CARRO)).toBe(true);
  });

  test("rejects a word whose every sense is old or cultured", () => {
    expect(isEligibleWord(EMPERO)).toBe(false);
  });

  test("rejects a page that is only an inflected form", () => {
    expect(isEligibleWord(COMIENDO)).toBe(false);
  });

  test("rejects a word used only outside Spain", () => {
    expect(isEligibleWord(GUAGUA)).toBe(false);
  });

  test("rejects a word whose only senses are vulgar", () => {
    const page = "== {{lengua|es}} ==\n==== {{sustantivo masculino|es}} ====\n;1: Algo feo.\n{{uso|vulgar}}\n";
    expect(isEligibleWord(page)).toBe(false);
  });

  test("rejects a word that is only a grammar word, like a conjunction", () => {
    const page = "== {{lengua|es}} ==\n==== {{conjunción|es}} ====\n;1: Une frases.\n";
    expect(isEligibleWord(page)).toBe(false);
  });

  // "partes" has its own noun entry, but people say it as the plural of "parte".
  test("rejects a plural or a feminine form, even with an entry of its own", () => {
    const page = `== {{lengua|es}} ==
==== {{sustantivo masculino|es}} ====
;1: Órganos sexuales.
=== Forma flexiva ===
==== Forma sustantiva femenina ====
;1: {{inflect.es.sust.reg|parte}}.
`;
    expect(isEligibleWord(page)).toBe(false);
  });

  // "casa" is also a form of the verb "casar"; that must not remove the noun.
  test("keeps a lemma that is also a verb form", () => {
    const page = `== {{lengua|es}} ==
==== {{sustantivo femenino|es}} ====
;1: Edificación destinada a vivienda.
=== Forma flexiva ===
==== Forma verbal ====
;1: {{f.v|casar}}.
`;
    expect(isEligibleWord(page)).toBe(true);
  });

  test("rejects a word whose only sense has no text once the markup is gone", () => {
    const page = "== {{lengua|es}} ==\n==== {{adjetivo|es}} ====\n;1: {{gentilicio|Tailandia}}.\n";
    expect(isEligibleWord(page)).toBe(false);
  });
});

describe("verbFormsOf", () => {
  test("names the verbs a page is a form of, from each template kind", () => {
    const page = `== {{lengua|es}} ==
=== Forma flexiva ===
==== Forma verbal ====
;1: {{forma verbo|poner|p=1s|t=presente|m=indicativo}}.
;2: {{f.v|ponerse|yo}}.
;3: {{participio|poner}}.
;4: {{gerundio|poner}}.
`;
    expect(verbFormsOf(page)).toEqual(["poner", "ponerse"]);
  });

  test("returns nothing for a page with no verb form", () => {
    expect(verbFormsOf(CARRO)).toEqual([]);
  });
});

describe("isFormOfCommonerVerb", () => {
  const PONGO = `== {{lengua|es}} ==
==== {{sustantivo masculino|es}} ====
;1: Simio de Borneo.
=== Forma flexiva ===
==== Forma verbal ====
;1: {{forma verbo|poner|p=1s}}.
`;
  const CASA = `== {{lengua|es}} ==
==== {{sustantivo femenino|es}} ====
;1: Edificación destinada a vivienda.
=== Forma flexiva ===
==== Forma verbal ====
;1: {{f.v|casar|yo}}.
`;
  const rank = new Map([["poner", 150], ["pongo", 400], ["casa", 120], ["casar", 3000]]);
  const rankOf = (word) => rank.get(word) ?? Infinity;

  // People say "pongo" as a form of "poner", not as the ape.
  test("is true when the verb is said more often than the word", () => {
    expect(isFormOfCommonerVerb("pongo", PONGO, rankOf)).toBe(true);
  });

  test("is false when the word is said more often than the verb", () => {
    expect(isFormOfCommonerVerb("casa", CASA, rankOf)).toBe(false);
  });

  test("is false for a page with no verb form", () => {
    expect(isFormOfCommonerVerb("carro", CARRO, rankOf)).toBe(false);
  });
});

describe("isCandidate", () => {
  test("takes a plain lower-case word of three letters or more", () => {
    expect(isCandidate("casa")).toBe(true);
    expect(isCandidate("pingüino")).toBe(true);
  });

  test("rejects short words, numbers and apostrophes", () => {
    expect(isCandidate("de")).toBe(false);
    expect(isCandidate("100")).toBe(false);
    expect(isCandidate("o'clock")).toBe(false);
  });

  test("rejects adverbs made with -mente, which only restate their adjective", () => {
    expect(isCandidate("rápidamente")).toBe(false);
    expect(isCandidate("mente")).toBe(true);
  });
});
