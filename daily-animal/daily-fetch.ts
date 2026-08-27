import { fetchRandomAnimal } from "./fetch-animal.ts";
import fs from "fs/promises";
import { dataPath } from "../data-dir";
import { getLogger } from "../logger";
import { deleteEntriesForToday, deleteBabyEntriesForToday } from "./archive";

const log = getLogger("daily-animal");

async function write(babiesOnly: boolean) {
  const fileName = dataPath(babiesOnly ? "animal-babies.json" : "animal.json");
  let data = null;
  while (data === null) data = await fetchRandomAnimal(babiesOnly);

  // file may not exist yet
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
