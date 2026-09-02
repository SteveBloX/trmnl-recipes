import { fetchRandomNaturalWonder } from "./fetch-natural-wonder.ts";
import fs from "fs/promises";
import { dataPath } from "../data-dir";
import { getLogger } from "../logger";
import { deleteEntriesForToday } from "./archive";
import { retryWithAlert } from "../retry-with-alert";

const log = getLogger("daily-natural-wonder");
const fileName = dataPath("natural-wonder.json");

export async function writeNaturalWonderJSON() {
  const data = await retryWithAlert("Natural Wonder of the Day", () =>
    fetchRandomNaturalWonder()
  );
  if (data === null) return; // toutes les tentatives ont échoué, déjà alerté — on garde l'ancien fichier

  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  log.success(`Natural wonder data written to ${fileName}`);
}

/**
 * Reroll manuel : même principe que rerollAnimalJSON/rerollMonumentJSON.
 */
export async function rerollNaturalWonderJSON() {
  const deleted = await deleteEntriesForToday();
  log.info(`Reroll: removed ${deleted} entr${deleted === 1 ? "y" : "ies"} from today's archive.`);
  await writeNaturalWonderJSON();
}

// Garde-fou dès le départ (bug déjà rencontré et corrigé côté Animal et
// Monument) : sans lui, un simple `import` de ce fichier par index.ts
// déclencherait un vrai appel à l'API UNESCO à chaque démarrage du serveur.
if (require.main === module) {
  writeNaturalWonderJSON();
}
