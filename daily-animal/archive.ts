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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritics left by NFD decomposition
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Génère un slug lisible ("red-tailed-hawk-a3f9") et l'assure unique dans
 * l'archive existante — collision quasi impossible (4 octets aléatoires),
 * mais on vérifie quand même plutôt que de le supposer.
 */
export async function generateUniqueSlug(commonName: string): Promise<string> {
  const archive = await readArchive();
  const base = slugify(commonName) || "animal";

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = crypto.randomBytes(4).toString("hex");
    const slug = `${base}-${suffix}`;
    if (!(slug in archive)) return slug;
  }
  // Improbable, mais un slug qui existe déjà vaut mieux qu'un crash.
  return `${base}-${crypto.randomBytes(6).toString("hex")}`;
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
