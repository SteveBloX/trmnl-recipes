import axios from "axios";
import {
  generateUniqueSlug,
  saveToArchive,
  generateUniqueBabySlug,
  saveBabyToArchive,
} from "./archive";
import { getLogger } from "../logger";

const log = getLogger("daily-animal");
const INATURALIST_API_URL = "https://api.inaturalist.org/v1";

// Même domaine que celui déjà utilisé pour polling_url dans settings.yml —
// voir analytics.ts pour la même convention côté hostname des events Umami.
const PUBLIC_ANIMAL_PAGE_BASE = "https://trmnl.bloax.xyz/animal";

// Vertébrés uniquement (oiseaux, mammifères, reptiles, amphibiens, poissons).
// Un tirage 100% aléatoire sur l'ensemble du vivant donne ~60% de plantes et
// d'insectes (mauvaises herbes, mites anonymes...) — peu engageant pour un
// écran glanceable. Ce filtre garde 44k+ espèces reconnaissables, largement
// assez pour ne jamais se répéter.
const ICONIC_TAXA = "Aves,Mammalia,Reptilia,Amphibia,Actinopterygii";

// Mode "bébés uniquement" : mêmes groupes sauf les poissons — vérifié à la
// main sur quelques tirages, une photo de bébé poisson ne se lit pas comme
// "un bébé" à l'oeil (pas de trait juvénile visuellement évident comme un
// duvet, une taille disproportionnée, etc.), contrairement aux autres groupes.
const ICONIC_TAXA_BABIES = "Aves,Mammalia,Reptilia,Amphibia";

// Annotation communautaire iNaturalist "Life Stage" = "Juvenile" (vérifié via
// GET /v1/controlled_terms : term_id 1, value id 8, s'applique à Animalia
// dans son ensemble). Couverture mesurée ~1.36% toutes espèces confondues
// (1-2.6% par groupe, aucun groupe quasi-absent) — assez dense pour que la
// technique de fenêtre d'ID + tri par votes reste fiable (10/10 tirages
// réussis en test, faves 4-21 contre 8-122 sans le filtre).
const BABY_LIFE_STAGE_PARAMS = { term_id: 1, term_value_id: 8 };

// N'accepte que les photos réutilisables : beaucoup d'observations iNaturalist
// sont "all rights reserved" (license_code null), ce qui interdit tout affichage
// public. Avec ce filtre il reste ~160M observations, aucune perte de diversité.
const PHOTO_LICENSES = "cc0,cc-by,cc-by-sa,cc-by-nc,cc-by-nc-sa";

// Même jeu de langues que Monument of the Day, pour rester cohérent entre les
// deux plugins de "pioche du jour".
const LOCALES = ["en", "fr", "es", "ru", "ar", "zh"];

// iNaturalist attribution strings look like "(c) Jane Doe, some rights
// reserved (CC BY-NC)" or, for public-domain photos, "(c) Jane Doe, no
// rights reserved (Public Domain)". Extract just the name; fall back to the
// raw string untouched if the format doesn't match (never seen in practice,
// but a footnote that's merely verbose beats one that silently disappears).
function formatPhotoCredit(attribution: string, licenseCode: string): string {
  const match = /^\(c\)\s*([^,]+),/.exec(attribution ?? "");
  if (!match) return attribution ?? "";
  return `${match[1].trim()} · ${(licenseCode ?? "").toUpperCase()}`;
}

const MIN_OBSERVATION_ID = 38;

// Largeur de la tranche d'ids dans laquelle on cherche la photo la plus
// appréciée. Voir fetchBestObservation pour le raisonnement.
const ID_WINDOW = 2_000_000;

// L'API iNaturalist bloque la pagination profonde (403 au-delà d'un certain
// `page`), donc impossible de faire un offset aléatoire classique comme pour
// UNESCO. À la place : tirer un id aléatoire qui sert de borne basse à une
// tranche d'ids.
function randomWindowStart(maxId: number): number {
  const span = maxId - ID_WINDOW - MIN_OBSERVATION_ID;
  return Math.floor(Math.random() * span) + MIN_OBSERVATION_ID;
}

// Chaque animal nécessite plusieurs appels séquentiels (id max, observation,
// une fiche taxon par langue). L'API renvoie des erreurs de connexion en cas
// de rafale — on espace donc les appels plutôt que de tenter une parallélisation.
const REQUEST_DELAY_MS = 1200;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wikimedia (Wikipedia + Wikidata) demande un User-Agent identifiable pour
// tout usage automatisé — sans ça les requêtes sont plus facilement throttle.
// https://meta.wikimedia.org/wiki/User-Agent_policy
const WIKIMEDIA_USER_AGENT =
  "trmnl-recipes-animal-of-the-day/1.0 (contact@bloax.xyz)";
const WIKI_REQUEST_DELAY_MS = 500;

function buildObservationParams(babiesOnly: boolean) {
  return {
    photos: true,
    quality_grade: "research",
    photo_license: PHOTO_LICENSES,
    iconic_taxa: babiesOnly ? ICONIC_TAXA_BABIES : ICONIC_TAXA,
    ...(babiesOnly ? BABY_LIFE_STAGE_PARAMS : {}),
  };
}

async function getMaxObservationId(
  observationParams: ReturnType<typeof buildObservationParams>
): Promise<number> {
  const { data } = await axios.get(`${INATURALIST_API_URL}/observations`, {
    params: { ...observationParams, order_by: "id", order: "desc", per_page: 1 },
  });
  return data.results[0]?.id ?? MIN_OBSERVATION_ID + 1;
}

// "research grade" ne certifie que l'identification, pas la photo : prendre la
// première observation venue donne souvent un cliché de preuve (sujet minuscule,
// pris au zoom, à moitié dans l'eau). Or les faves de la communauté, elles,
// suivent bien la qualité de l'image — mais elles sont trop rares pour servir
// de simple filtre (0/20 tirages purement aléatoires en avaient une seule).
//
// D'où cette approche : tirer une tranche d'ids au hasard, puis demander à
// l'API la photo la plus appréciée *de cette tranche* (order_by=votes). La
// tranche garde l'aléatoire (donc la diversité des espèces), le tri par votes
// garantit une photo présentable. Mesuré : 15/15 tirages avec 8 à 122 faves.
//
// Trier par votes sans borne haute ferait au contraire remonter en boucle les
// quelques observations les plus likées du site (4 fois le même raton laveur
// sur 10 essais) — la borne haute est ce qui préserve la variété.
async function fetchBestObservation(
  windowStart: number,
  observationParams: ReturnType<typeof buildObservationParams>
) {
  const { data } = await axios.get(`${INATURALIST_API_URL}/observations`, {
    params: {
      ...observationParams,
      id_above: windowStart,
      id_below: windowStart + ID_WINDOW,
      order_by: "votes",
      order: "desc",
      per_page: 1,
    },
  });
  return data.results?.[0] ?? null;
}

// Un seul appel par langue sert à la fois le nom vernaculaire ET (sur le
// premier, "en") le statut de conservation + le lien Wikipedia — pas besoin
// d'un appel séparé pour ces champs.
// iNaturalist ne renvoie pas toujours `status_name` à côté du code IUCN (vu
// sur une espèce en danger critique qui n'avait que "cr"). Le code seul est
// illisible sur un écran, d'où cette table de secours.
const IUCN_STATUS_NAMES: Record<string, string> = {
  ex: "extinct",
  ew: "extinct in the wild",
  cr: "critically endangered",
  en: "endangered",
  vu: "vulnerable",
  nt: "near threatened",
  lc: "least concern",
  dd: "data deficient",
  ne: "not evaluated",
};

async function fetchTaxonDetails(taxonId: number) {
  const names: Record<string, string> = {};
  let wikipediaURL: string | null = null;
  let conservationStatus: { code: string; statusName: string; authority: string } | null = null;

  for (let i = 0; i < LOCALES.length; i++) {
    const locale = LOCALES[i];
    if (i > 0) await sleep(REQUEST_DELAY_MS);

    try {
      const { data } = await axios.get(`${INATURALIST_API_URL}/taxa/${taxonId}`, {
        params: { locale },
      });
      const taxon = data.results?.[0];
      names[locale] = taxon?.preferred_common_name || taxon?.name || "";

      if (i === 0) {
        wikipediaURL = taxon?.wikipedia_url || null;
        const status = taxon?.conservation_status;
        if (status) {
          const code = (status.status ?? "").toLowerCase();
          conservationStatus = {
            code: code.toUpperCase(),
            statusName: status.status_name || IUCN_STATUS_NAMES[code] || "",
            authority: status.authority,
          };
        }
      }
    } catch (error: any) {
      log.warn(`Failed to fetch '${locale}' taxon details for #${taxonId}:`, error.message);
      names[locale] = "";
    }
  }

  return { names, wikipediaURL, conservationStatus };
}

// The MediaWiki `langlinks` prop is effectively dead — Wikipedia moved
// interlanguage links to Wikidata years ago and most articles no longer carry
// them. So: resolve the English article (redirects included) to get its
// extract + Wikidata QID, then use the QID's sitelinks to find each other
// language's article title.
async function fetchWikipediaExtract(
  title: string,
  allowFallback = true
): Promise<{ extract: string; qid: string | null } | null> {
  try {
    const { data } = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: {
        action: "query",
        titles: title,
        prop: "extracts|pageprops",
        exintro: 1,
        explaintext: 1,
        redirects: 1,
        format: "json",
      },
      headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
    });

    const page: any = Object.values(data.query.pages)[0];

    if (page.missing !== undefined || !page.extract) {
      // Subspecies-rank taxa (3-word scientific name) rarely have their own
      // article — retry with just genus + species before giving up.
      const words = title.trim().split(/\s+/);
      if (allowFallback && words.length > 2) {
        await sleep(WIKI_REQUEST_DELAY_MS);
        return fetchWikipediaExtract(words.slice(0, 2).join(" "), false);
      }
      return null;
    }

    return {
      extract: page.extract as string,
      qid: page.pageprops?.wikibase_item ?? null,
    };
  } catch (error: any) {
    log.warn(`Failed to fetch Wikipedia extract for '${title}':`, error.message);
    return null;
  }
}

async function fetchWikidataSitelinks(qid: string): Promise<Record<string, string>> {
  try {
    const { data } = await axios.get(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { headers: { "User-Agent": WIKIMEDIA_USER_AGENT } }
    );
    const sitelinks = data.entities?.[qid]?.sitelinks ?? {};
    const titles: Record<string, string> = {};
    for (const locale of LOCALES) {
      if (locale === "en") continue;
      const title = sitelinks[`${locale}wiki`]?.title;
      if (title) titles[locale] = title;
    }
    return titles;
  } catch (error: any) {
    log.warn(`Failed to fetch Wikidata sitelinks for ${qid}:`, error.message);
    return {};
  }
}

async function fetchLocalizedSummary(locale: string, title: string): Promise<string | null> {
  try {
    const { data } = await axios.get(
      `https://${locale}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { "User-Agent": WIKIMEDIA_USER_AGENT } }
    );
    return data.extract || null;
  } catch (error: any) {
    log.warn(`Failed to fetch '${locale}' summary for '${title}':`, error.message);
    return null;
  }
}

// Missing everywhere (no Wikipedia article for this taxon at all) is a
// legitimate outcome for obscure species, not an error — the description is
// simply left absent for that language rather than retried.
async function fetchDescriptions(scientificName: string): Promise<Record<string, string>> {
  const descriptions: Record<string, string> = {};

  const enResult = await fetchWikipediaExtract(scientificName);
  if (!enResult) return descriptions;
  descriptions.en = enResult.extract;

  if (!enResult.qid) return descriptions;

  await sleep(WIKI_REQUEST_DELAY_MS);
  const otherTitles = await fetchWikidataSitelinks(enResult.qid);

  for (const [locale, title] of Object.entries(otherTitles)) {
    await sleep(WIKI_REQUEST_DELAY_MS);
    const extract = await fetchLocalizedSummary(locale, title);
    if (extract) descriptions[locale] = extract;
  }

  return descriptions;
}

/**
 * Retrieves one random wild vertebrate (bird, mammal, reptile, amphibian or,
 * outside "babies only" mode, fish) from a research-grade, appropriately-
 * licensed iNaturalist observation.
 * @param babiesOnly when true, restricts to observations annotated "Juvenile"
 * (iNaturalist Life Stage), excluding fish (see ICONIC_TAXA_BABIES).
 * @returns {Promise<Object|null>} Animal data, or null if this draw missed
 * (caller is expected to retry, same convention as fetchRandomMonument).
 */
export async function fetchRandomAnimal(babiesOnly = false) {
  log.info(
    `Querying iNaturalist API for a random${babiesOnly ? " baby" : ""} animal...`
  );

  try {
    const observationParams = buildObservationParams(babiesOnly);
    const maxId = await getMaxObservationId(observationParams);
    await sleep(REQUEST_DELAY_MS);

    const observation = await fetchBestObservation(
      randomWindowStart(maxId),
      observationParams
    );

    if (!observation || !observation.taxon) {
      log.warn("No observation found in the random id window — will retry.");
      return null;
    }

    const photo = observation.photos?.[0];
    if (!photo) {
      log.warn("Observation had no usable photo — will retry.");
      return null;
    }

    // Les observations les plus likées sont parfois des GIF animés, qui n'ont
    // aucun sens sur e-ink (le rendu ne capture qu'une image figée).
    if (/\.gif(\?|$)/i.test(photo.url ?? "")) {
      log.warn("Top-voted photo is an animated GIF — will retry.");
      return null;
    }

    const taxon = observation.taxon;
    await sleep(REQUEST_DELAY_MS);
    const { names, wikipediaURL, conservationStatus } = await fetchTaxonDetails(taxon.id);

    await sleep(WIKI_REQUEST_DELAY_MS);
    const description = await fetchDescriptions(taxon.name);

    // English is the guaranteed fallback the markup relies on when the
    // user's chosen language has no description (measured ~53% chance of
    // missing at least one language, but 100% coverage for English alone
    // over 15 real draws) — so a draw with no English text at all is
    // treated as a miss and retried, same as a missing photo above.
    if (!description.en) {
      log.warn(
        `No English description found for '${taxon.name}' — will retry.`
      );
      return null;
    }

    // Un slug par tirage, archivé séparément du cache "aujourd'hui" (voir
    // archive.ts) : le QR code du layout full pointe vers cette URL, qui doit
    // rester valide indéfiniment — contrairement à animal.json, écrasé chaque
    // jour par le prochain tirage. Archive distincte en mode bébés (voir
    // archive.ts) mais même schéma d'URL /animal/<slug> — la route côté
    // serveur cherche dans les deux archives.
    const slug = babiesOnly ? await generateUniqueBabySlug() : await generateUniqueSlug();

    const animalData = {
      scientificName: taxon.name,
      rank: taxon.rank,
      taxonGroup: taxon.iconic_taxon_name,
      name: names,
      description,
      // iNaturalist photo URLs end in a size suffix (square/small/medium/large/original)
      imageURL: (photo.url as string)?.replace(/square\.(\w+)$/, "medium.$1"),
      attribution: photo.attribution,
      // Condensed for display: the raw attribution ("(c) NAME, some rights
      // reserved (LICENSE)") is verbose for what should read as a discreet
      // footnote. Computed here rather than with Liquid string filters in the
      // template — no guarantee TRMNL's Liquid runtime supports the filters
      // (remove_first/split) that would take to do this safely there.
      photoCredit: formatPhotoCredit(photo.attribution, photo.license_code),
      licenseCode: photo.license_code,
      observationURL: `https://www.inaturalist.org/observations/${observation.id}`,
      wikipediaURL,
      placeGuess: observation.place_guess || null,
      conservationStatus,
      slug,
      animalPageURL: `${PUBLIC_ANIMAL_PAGE_BASE}/${slug}`,
    };

    if (babiesOnly) {
      await saveBabyToArchive(slug, animalData);
    } else {
      await saveToArchive(slug, animalData);
    }

    return animalData;
  } catch (error: any) {
    if (error.response) {
      log.error("API Error Data:", error.response.data);
    }
    log.error("Error retrieving random animal:", error.message);
    return null;
  }
}
