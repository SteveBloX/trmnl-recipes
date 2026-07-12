import wordsFr from "./words-fr.json" assert { type: "json" };
import wordsEn from "./words-en.json" assert { type: "json" };
import wordsEs from "./words-es.json" assert { type: "json" };
import wordsDe from "./words-de.json" assert { type: "json" };
import wordsPl from "./words-pl.json" assert { type: "json" };

type dataType = {
  lang?: string; // fr | en | es | de | pl
  random?: string; // "1" = mot aléatoire au lieu du mot du jour
  types?: string; // filtre optionnel: "noun,adj,verb,adv" (clés génériques)
  translangs?: string; // langues de traduction prioritaires pour l'affichage, ex: "en,it"
};

export type wordType = {
  word: string;
  pos: string;
  definition: string;
  tags: string[];
  gender?: string;
  ipa?: string;
  definition2?: string;
  example?: { text: string; ref?: string };
  etymology?: string;
  synonyms?: string[];
  translations?: Record<string, string>;
};

const WORDS: Record<string, wordType[]> = {
  fr: wordsFr as wordType[],
  en: wordsEn as wordType[],
  es: wordsEs as wordType[],
  de: wordsDe as wordType[],
  pl: wordsPl as wordType[],
};

// libellés de POS localisés dans chaque fichier → clés génériques pour le filtre
const POS_LABELS: Record<string, Record<string, string>> = {
  fr: { noun: "nom", adj: "adjectif", verb: "verbe", adv: "adverbe" },
  en: { noun: "noun", adj: "adjective", verb: "verb", adv: "adverb" },
  es: { noun: "sustantivo", adj: "adjetivo", verb: "verbo", adv: "adverbio" },
  de: { noun: "Substantiv", adj: "Adjektiv", verb: "Verb", adv: "Adverb" },
  pl: { noun: "rzeczownik", adj: "przymiotnik", verb: "czasownik", adv: "przysłówek" },
};

const LANG_NAMES: Record<string, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  pl: "Polski",
};

// FNV-1a : hash stable de la date pour que le mot ne change qu'une fois par jour
// et que deux langues n'affichent pas le même index
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function wordRequest(data: dataType, _body: any = null) {
  const lang = data.lang && WORDS[data.lang] ? data.lang : "en";
  let words = WORDS[lang];

  if (data.types) {
    const labels = data.types
      .split(",")
      .map((t) => POS_LABELS[lang][t.trim().toLowerCase()])
      .filter(Boolean);
    if (labels.length > 0) {
      const filtered = words.filter((w) => labels.includes(w.pos));
      if (filtered.length > 0) words = filtered;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const index =
    data.random === "1"
      ? Math.floor(Math.random() * words.length)
      : hash(`${lang}-${today}`) % words.length;

  const entry = { ...words[index] };
  // langues prioritaires en tête (l'objet garde l'ordre d'insertion,
  // le template Liquid affiche donc les préférées d'abord)
  if (entry.translations && data.translangs) {
    const pref = data.translangs
      .split(",")
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    const ordered: Record<string, string> = {};
    for (const l of pref) {
      if (entry.translations[l] !== undefined) ordered[l] = entry.translations[l];
    }
    for (const [l, w] of Object.entries(entry.translations)) {
      if (!(l in ordered)) ordered[l] = w;
    }
    entry.translations = ordered;
  }

  return {
    ...entry,
    lang,
    langName: LANG_NAMES[lang],
    date: today,
  };
}
