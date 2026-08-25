// Petite "base de données" qui grandit un tirage à la fois. `animal.json`
// (voir req.ts / daily-fetch.ts) est écrasé chaque jour — il ne peut donc pas
// servir de cible pour un lien permanent. Ce fichier-ci n'est lui jamais
// écrasé : chaque tirage y est ajouté sous son slug, pour que le QR code
// scanné aujourd'hui pointe toujours vers la bonne fiche demain, l'an
// prochain, etc.
import fs from "fs/promises";
import crypto from "crypto";
import { dataPath } from "../data-dir";

const ARCHIVE_PATH = dataPath("animal-archive.json");

type Archive = Record<string, any>;

async function readArchive(): Promise<Archive> {
  try {
    const raw = await fs.readFile(ARCHIVE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (error: any) {
    if (error?.code === "ENOENT") return {};
    // Un fichier corrompu ne doit pas empêcher le tirage du jour de
    // fonctionner — mieux vaut perdre l'archive que le plugin.
    console.error("Failed to parse animal-archive.json, starting fresh:", error.message);
    return {};
  }
}

/**
 * Génère un slug purement aléatoire et l'assure unique dans l'archive.
 *
 * Pas de nom d'espèce dedans (ex. pas "red-tailed-hawk-a3f9") : ça allongeait
 * l'URL encodée dans le QR du layout full de 39 à 58 caractères, ce qui la
 * faisait passer en version 4 (33x33 modules) au lieu de la version 3
 * (29x29) — un cran de densité en plus, donc plus dur à scanner à la petite
 * taille où `qr_code: 2` rend. Le nom reste affiché sur la page elle-même,
 * juste pas dans l'URL.
 */
export async function generateUniqueSlug(): Promise<string> {
  const archive = await readArchive();

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = crypto.randomBytes(4).toString("hex");
    if (!(slug in archive)) return slug;
  }
  // Improbable, mais un slug qui existe déjà vaut mieux qu'un crash.
  return crypto.randomBytes(6).toString("hex");
}

export async function saveToArchive(slug: string, animalData: any): Promise<void> {
  const archive = await readArchive();
  archive[slug] = { ...animalData, slug, createdAt: new Date().toISOString() };
  await fs.writeFile(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
}

export async function getFromArchive(slug: string): Promise<any | null> {
  const archive = await readArchive();
  return archive[slug] ?? null;
}

export type DailyHistoryEntry = { date: string; entry: any };

/**
 * Un tirage par jour dans le cas normal (cron quotidien), mais un redémarrage
 * avec un volume de données manquant (ou un test manuel) peut en produire
 * plusieurs le même jour. Pour chacun, on calcule combien de temps il est
 * resté "actif" — c'est-à-dire celui réellement servi par /api/daily-animal —
 * en le mesurant jusqu'au tirage suivant (ou jusqu'à maintenant pour le tout
 * dernier). Par jour, on ne garde que celui resté actif le plus longtemps.
 */
export async function getDailyHistory(): Promise<DailyHistoryEntry[]> {
  const archive = await readArchive();
  const entries = Object.values(archive) as any[];
  if (entries.length === 0) return [];

  entries.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const now = Date.now();
  const bestPerDay = new Map<string, { entry: any; durationMs: number }>();

  entries.forEach((entry, i) => {
    const start = new Date(entry.createdAt).getTime();
    const end =
      i + 1 < entries.length
        ? new Date(entries[i + 1].createdAt).getTime()
        : now;
    const durationMs = Math.max(0, end - start);
    const day = String(entry.createdAt).slice(0, 10); // YYYY-MM-DD

    const current = bestPerDay.get(day);
    if (!current || durationMs > current.durationMs) {
      bestPerDay.set(day, { entry, durationMs });
    }
  });

  return [...bestPerDay.entries()]
    .map(([date, { entry }]) => ({ date, entry }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // plus récent en premier
}
