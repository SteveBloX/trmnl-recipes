// Fine couche sur la logique générique — voir ../shared-archive.ts pour le
// détail (partagée avec daily-animal et daily-natural-wonder).
import { createArchive } from "../shared-archive";

export type { DailyHistoryEntry } from "../shared-archive";

export const {
  generateUniqueSlug,
  saveToArchive,
  getFromArchive,
  getDailyHistory,
  getLatestForToday,
  deleteEntriesForToday,
} = createArchive("monument-archive.json");
