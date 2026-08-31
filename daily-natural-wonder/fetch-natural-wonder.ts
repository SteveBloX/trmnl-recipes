import axios from "axios";
import { generateUniqueSlug, saveToArchive } from "./archive";
import { cacheRemoteImage } from "../image-cache";
import { getLogger } from "../logger";

const log = getLogger("daily-natural-wonder");

// UNESCO OpenDataSoft API URL — même dataset que Monument of the Day, filtré
// différemment (Natural + Mixed au lieu de Cultural).
const UNESCO_API_URL =
  "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/records";

// Même domaine et même convention que animalPageURL (fetch-animal.ts) — le
// QR code du layout full pointe vers cette URL, stable indéfiniment.
const PUBLIC_WONDER_PAGE_BASE = "https://trmnl.bloax.xyz/natural-wonder";

// Même jeu de langues que name/description ci-dessous. Node fournit
// Intl.DisplayNames nativement (vérifié : couvre les 6 langues du plugin,
// gère les sites transfrontaliers en joignant plusieurs codes, et retombe
// silencieusement sur le code brut pour un code inconnu plutôt que de
// planter) — pas besoin de script côté client ni de dépendance externe.
const LOCALES = ["en", "fr", "es", "ru", "ar", "zh"];

function localizedCountryNames(isoCodes: unknown): Record<string, string> {
  const codes = String(isoCodes ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (codes.length === 0) return {};

  const names: Record<string, string> = {};
  for (const locale of LOCALES) {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    names[locale] = codes.map((c) => displayNames.of(c.toUpperCase()) ?? c).join(", ");
  }
  return names;
}

/**
 * Retrieves a random Natural or Mixed World Heritage Site that has an image,
 * with details in English (and 5 other languages, like Monument of the Day).
 * @returns {Promise<Object|null>} Natural wonder data, or null upon error —
 * caller is expected to retry, same convention as fetchRandomMonument.
 */
export async function fetchRandomNaturalWonder() {
  // "Mixed" sites (culturally AND naturally significant, e.g. Machu Picchu)
  // are included alongside "Natural" — excluding them would drop compelling
  // sites like the Ngorongoro Conservation Area over an administrative
  // technicality of the UNESCO category system.
  const baseParams = {
    where: "main_image_url IS NOT NULL AND category IN ('Natural','Mixed')",
    lang: "en",
  };

  log.info("Querying UNESCO API for a random natural wonder...");

  try {
    // 1. Get total count of matching records
    const countResponse = await axios.get(UNESCO_API_URL, {
      params: { ...baseParams, limit: 0 },
    });
    const totalCount = countResponse.data.total_count;

    if (!totalCount) {
      log.warn("No records found.");
      return null;
    }

    // 2. Fetch a random record using offset
    const randomOffset = Math.floor(Math.random() * totalCount);

    const params = {
      ...baseParams,
      select:
        "name_en, name_fr, name_es, name_ru, name_ar, name_zh, main_image_url, id_no, category, coordinates, iso_codes, short_description_en, short_description_fr, short_description_es, short_description_ru, short_description_ar, short_description_zh",
      limit: 1,
      offset: randomOffset,
    };

    const response = await axios.get(UNESCO_API_URL, { params });
    const results = response.data.results;

    if (!results || results.length === 0) {
      log.warn("API returned a valid response, but no record was found.");
      return null;
    }

    const record = results[0];

    const rawImageURL =
      typeof record.main_image_url === "string"
        ? record.main_image_url
        : record.main_image_url?.url;

    // whc.unesco.org bloque les clients non-navigateurs derrière un
    // challenge Cloudflare (incident du 26/08/2026 : ce plugin a un jour
    // cessé de charger l'image en rendu TRMNL après avoir marché la veille)
    // — on met l'image en cache sur notre domaine plutôt que de laisser le
    // moteur de rendu TRMNL parler directement à l'UNESCO. id_no (le site)
    // sert de clé, pas le tirage, pour réutiliser le cache si le même site
    // est retiré plus tard.
    const imageURL = await cacheRemoteImage(
      "natural-wonder",
      record.id_no,
      rawImageURL
    );

    // Un slug par tirage, comme pour Animal of the Day — le lien du QR doit
    // rester valide indéfiniment, contrairement à natural-wonder.json qui est
    // écrasé chaque jour par le prochain tirage.
    const slug = await generateUniqueSlug();

    const wonderData = {
      name: {
        en: record.name_en,
        fr: record.name_fr,
        es: record.name_es,
        ru: record.name_ru,
        ar: record.name_ar,
        zh: record.name_zh,
      },
      imageURL,
      category: record.category, // "Natural" ou "Mixed"
      officialURL: `https://whc.unesco.org/en/list/${record.id_no}`,
      coordinates: {
        lat: record.coordinates?.lat,
        lon: record.coordinates?.lon,
      },
      country_code: record.iso_codes,
      countryNames: localizedCountryNames(record.iso_codes),
      description: {
        en: record.short_description_en,
        fr: record.short_description_fr,
        es: record.short_description_es,
        ru: record.short_description_ru,
        ar: record.short_description_ar,
        zh: record.short_description_zh,
      },
      slug,
      wonderPageURL: `${PUBLIC_WONDER_PAGE_BASE}/${slug}`,
    };

    await saveToArchive(slug, wonderData);

    return wonderData;
  } catch (error: any) {
    if (error.response) {
      log.error("API Error Data:", error.response.data);
    }
    log.error("Error retrieving UNESCO natural wonder:", error.message);
    return null;
  }
}
