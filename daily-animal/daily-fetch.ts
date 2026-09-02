import { fetchRandomAnimal } from "./fetch-animal.ts";
import fs from "fs/promises";
import { dataPath } from "../data-dir";
import { getLogger } from "../logger";
import { deleteEntriesForToday, deleteBabyEntriesForToday } from "./archive";
import { retryWithAlert } from "../retry-with-alert";

const log = getLogger("daily-animal");

// Boucle interne : ne fait QUE re-tirer sur un "raté" volontaire de qualité
// (pas de photo, GIF, pas de description anglaise — fetchRandomAnimal renvoie
// alors null). Une vraie erreur réseau/API est levée par fetchRandomAnimal,
// pas renvoyée ici — elle remonte donc à retryWithAlert ci-dessous, qui est
// seul responsable de compter les tentatives et d'alerter.
async function attemptDraw(babiesOnly: boolean) {
  let data = null;
  while (data === null) data = await fetchRandomAnimal(babiesOnly);
  return data;
}

async function write(babiesOnly: boolean) {
  const fileName = dataPath(babiesOnly ? "animal-babies.json" : "animal.json");
  const label = babiesOnly ? "Animal of the Day (Babies)" : "Animal of the Day";

  const data = await retryWithAlert(label, () => attemptDraw(babiesOnly));
  if (data === null) return; // toutes les tentatives ont échoué, déjà alerté — on garde l'ancien fichier

  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  log.success(`Animal data (${babiesOnly ? "babies" : "normal"}) written to ${fileName}`);
}

export async function writeAnimalJSON() {
  await write(false);
}

export async function writeBabyAnimalJSON() {
  await write(true);
}

/**
 * Reroll manuel : quand l'animal tiré ne rend pas bien à l'écran, plutôt que
 * d'attendre le lendemain. Contrairement à un simple nouveau tirage, retire
 * d'abord le tirage du jour de l'archive — sinon les deux coexisteraient et
 * la logique "actif le plus longtemps" de shared-archive.ts pourrait garder
 * l'ancien dans l'historique plutôt que le remplaçant.
 */
export async function rerollAnimalJSON(babiesOnly: boolean) {
  const deleted = babiesOnly
    ? await deleteBabyEntriesForToday()
    : await deleteEntriesForToday();
  log.info(
    `Reroll: removed ${deleted} ${babiesOnly ? "baby " : ""}entr${deleted === 1 ? "y" : "ies"} from today's archive.`
  );
  await write(babiesOnly);
}

// Seulement quand ce fichier est exécuté directement (npx tsx
// daily-animal/daily-fetch.ts) — pas quand index.ts l'importe juste pour
// récupérer writeAnimalJSON. Sans ce garde-fou, un simple `import` déclenchait
// un tirage à chaque démarrage, avant même que la garde de démarrage dans
// index.ts (qui vérifie l'archive du jour) ait pu s'exécuter.
if (require.main === module) {
  writeAnimalJSON();
  writeBabyAnimalJSON();
}
