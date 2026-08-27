// Fabrique d'archive réutilisée par tous les plugins "pioche du jour" avec
// permalien (Animal of the Day, Natural Wonder of the Day, ...). Un seul
// endroit pour cette logique — notamment le calcul "actif le plus longtemps
// par jour", facile à se tromper à la main (vérifié : ça m'est arrivé une
// fois) — plutôt que de la dupliquer et risquer une divergence entre plugins.
import fs from "fs/promises";
import crypto from "crypto";
import { dataPath } from "./data-dir";
import { getLogger } from "./logger";

export type DailyHistoryEntry = { date: string; entry: any };

export function createArchive(filename: string) {
  const ARCHIVE_PATH = dataPath(filename);
  const log = getLogger(`archive:${filename}`);

  async function readArchive(): Promise<Record<string, any>> {
    try {
      const raw = await fs.readFile(ARCHIVE_PATH, "utf-8");
      return JSON.parse(raw);
    } catch (error: any) {
      if (error?.code === "ENOENT") return {};
      // Un fichier corrompu ne doit pas empêcher le tirage du jour de
      // fonctionner — mieux vaut perdre l'archive que le plugin.
      log.error(`Failed to parse, starting fresh:`, error.message);
      return {};
    }
  }

  /**
   * Génère un slug purement aléatoire et l'assure unique dans l'archive.
   *
   * Pas de nom dedans (ex. pas "grand-canyon-a3f9") : ça allongerait l'URL
   * encodée dans le QR, la faisant passer à une version supérieure (plus de
   * modules, donc plus dur à scanner à la petite taille où `qr_code: 2`
   * rend) — voir daily-animal/archive.ts historique pour la mesure précise.
   */
  async function generateUniqueSlug(): Promise<string> {
    const archive = await readArchive();

    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = crypto.randomBytes(4).toString("hex");
      if (!(slug in archive)) return slug;
    }
    // Improbable, mais un slug qui existe déjà vaut mieux qu'un crash.
    return crypto.randomBytes(6).toString("hex");
  }

  async function saveToArchive(slug: string, data: any): Promise<void> {
    const archive = await readArchive();
    archive[slug] = { ...data, slug, createdAt: new Date().toISOString() };
    await fs.writeFile(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
  }

  async function getFromArchive(slug: string): Promise<any | null> {
    const archive = await readArchive();
    return archive[slug] ?? null;
  }

  /**
   * Un tirage par jour dans le cas normal (cron quotidien), mais un
   * redémarrage avec un volume de données manquant (ou un test manuel) peut
   * en produire plusieurs le même jour. Pour chacun, on calcule combien de
   * temps il est resté "actif" — celui réellement servi par l'API — en le
   * mesurant jusqu'au tirage suivant (ou jusqu'à maintenant pour le tout
   * dernier). Par jour, on ne garde que celui resté actif le plus longtemps.
   */
  async function getDailyHistory(): Promise<DailyHistoryEntry[]> {
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

  /**
   * Le tirage le plus récent déjà fait aujourd'hui, s'il y en a un — utilisé
   * au démarrage pour éviter de re-tirer (et donc de gaspiller une entrée
   * d'archive) quand le fichier "aujourd'hui" a disparu mais qu'un tirage du
   * jour existe déjà dans l'archive.
   */
  async function getLatestForToday(): Promise<any | null> {
    const archive = await readArchive();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const todaysEntries = (Object.values(archive) as any[]).filter(
      (entry) => String(entry.createdAt).slice(0, 10) === today
    );
    if (todaysEntries.length === 0) return null;

    todaysEntries.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return todaysEntries[0];
  }

  /**
   * Supprime toutes les entrées d'aujourd'hui de l'archive — utilisé par le
   * reroll manuel (voir index.ts, /api/admin/reroll-*) : contrairement à un
   * simple nouveau tirage, qui ajouterait une entrée concurrente à celle du
   * jour (et perdrait potentiellement face à elle dans getDailyHistory selon
   * la durée "active" de chacune), ceci retire explicitement l'ancien choix
   * de l'historique avant de tirer le remplaçant.
   * @returns le nombre d'entrées supprimées.
   */
  async function deleteEntriesForToday(): Promise<number> {
    const archive = await readArchive();
    const today = new Date().toISOString().slice(0, 10);
    let deleted = 0;
    for (const [slug, entry] of Object.entries(archive)) {
      if (String((entry as any).createdAt).slice(0, 10) === today) {
        delete archive[slug];
        deleted++;
      }
    }
    if (deleted > 0) {
      await fs.writeFile(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
    }
    return deleted;
  }

  return {
    generateUniqueSlug,
    saveToArchive,
    getFromArchive,
    getDailyHistory,
    getLatestForToday,
    deleteEntriesForToday,
  };
}
