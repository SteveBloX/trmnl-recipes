import axios from "axios";
import { cacheRemoteImage } from "../image-cache";
import { generateUniqueSlug, saveToArchive } from "./archive";
import { getLogger } from "../logger";

const log = getLogger("daily-monument");

// UNESCO OpenDataSoft API URL
const UNESCO_API_URL =
  "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/records";

// Le QR du markup pointe ici plutôt que directement vers officialURL, pour
// qu'un scan passe par notre serveur (event Umami "qr_scan") avant d'être
// redirigé vers la vraie page UNESCO — voir la route /monument/:slug.
const PUBLIC_MONUMENT_REDIRECT_BASE = "https://trmnl.bloax.xyz/monument";

/**
 * Retrieves a random World Heritage Site that has an image, with details in English.
 * @returns {Promise<Object|null>} An object containing the name and image URL, or null upon error.
 */
export async function fetchRandomMonument() {
  // Common filter: ensures the element has an image URL
  const baseParams = {
    where: "main_image_url IS NOT NULL AND category = 'Cultural'",
    lang: "en",
  };

  log.info("Querying UNESCO API for a random monument...");

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
        "name_en, name_fr, name_es, name_ru, name_ar, name_zh, main_image_url, id_no, coordinates, iso_codes, short_description_en, short_description_fr, short_description_es, short_description_ru, short_description_ar, short_description_zh",
      limit: 1,
      offset: randomOffset,
    };

    const response = await axios.get(UNESCO_API_URL, {
      params: params,
    });

    const results = response.data.results;

    if (results && results.length > 0) {
      const record = results[0];

      // 3. Extracting Data
      const rawImageURL =
        typeof record.main_image_url === "string"
          ? record.main_image_url
          : record.main_image_url?.url;

      // whc.unesco.org bloque les clients non-navigateurs derrière un
      // challenge Cloudflare (incident du 26/08/2026 sur Natural Wonder of
      // the Day, un rendu qui avait pourtant marché la veille sur ce même
      // pattern d'URL) — on met l'image en cache sur notre domaine plutôt
      // que de laisser le moteur de rendu TRMNL parler directement à
      // l'UNESCO. id_no (l'identifiant du site) sert de clé, pas le tirage,
      // pour réutiliser le cache si le même monument est retiré plus tard.
      const imageURL = await cacheRemoteImage(
        "monument",
        record.id_no,
        rawImageURL
      );

      // Le slug indexe l'entrée dans l'archive ET sert de cible au QR : pas
      // de permalien affichant le contenu comme pour Animal/Natural Wonder
      // (officialURL est déjà une vraie page UNESCO stable), juste une
      // redirection qui laisse une trace dans Umami avant de renvoyer vers
      // officialURL — voir /monument/:slug dans index.ts.
      const slug = await generateUniqueSlug();

      const monumentData = {
        // Accessing the English name field
        name: {
          en: record.name_en,
          fr: record.name_fr,
          es: record.name_es,
          ru: record.name_ru,
          ar: record.name_ar,
          zh: record.name_zh,
        },
        imageURL,
        officialURL: `https://whc.unesco.org/en/list/${record.id_no}`,
        monumentPageURL: `${PUBLIC_MONUMENT_REDIRECT_BASE}/${slug}`,
        coordinates: {
          lat: record.coordinates?.lat,
          lon: record.coordinates?.lon,
        },
        country_code: record.iso_codes,
        description: {
          en: record.short_description_en,
          fr: record.short_description_fr,
          es: record.short_description_es,
          ru: record.short_description_ru,
          ar: record.short_description_ar,
          zh: record.short_description_zh,
        },
      };

      await saveToArchive(slug, monumentData);

      return monumentData;
    } else {
      log.warn("API returned a valid response, but no record was found.");
      return null;
    }
  } catch (error: any) {
    if (error.response) {
      log.error("API Error Data:", error.response.data);
    }
    log.error("Error retrieving UNESCO monument:", error.message);
    return null;
  }
}
