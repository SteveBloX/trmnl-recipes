// Fine couche sur la logique générique — voir shared-archive.ts pour le détail
// (partagé avec daily-natural-wonder et tout futur plugin "pioche du jour").
import { createArchive } from "../shared-archive";

export type { DailyHistoryEntry } from "../shared-archive";

export const {
  generateUniqueSlug,
  saveToArchive,
  getFromArchive,
  getDailyHistory,
  getLatestForToday,
} = createArchive("animal-archive.json");

// Archive séparée pour le mode "bébés uniquement" (voir fetch-animal.ts) —
// pas un simple filtre sur la même archive : les deux modes tirent une fois
// par jour chacun, et la logique "un par jour" de shared-archive.ts suppose
// un seul tirage par jour par archive. Les mélanger ferait qu'un des deux
// tirages du jour écraserait l'autre dans l'historique.
export const {
  generateUniqueSlug: generateUniqueBabySlug,
  saveToArchive: saveBabyToArchive,
  getFromArchive: getBabyFromArchive,
  getDailyHistory: getBabyDailyHistory,
  getLatestForToday: getLatestBabyForToday,
} = createArchive("animal-babies-archive.json");
