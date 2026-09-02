import { fetchRandomMonument } from "./fetch-monument.ts";
import fs from "fs/promises";
import { dataPath } from "../data-dir";
import { getLogger } from "../logger";
import { deleteEntriesForToday } from "./archive";
import { retryWithAlert } from "../retry-with-alert";

const log = getLogger("daily-monument");
const fileName = dataPath("monument.json");

export async function writeMonumentJSON() {
  const data = await retryWithAlert("Monument of the Day", () => fetchRandomMonument());
  if (data === null) return; // toutes les tentatives ont échoué, déjà alerté — on garde l'ancien fichier

  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  log.success(`Monument data written to ${fileName}`);
}

/**
 * Reroll manuel : même principe que rerollAnimalJSON (daily-animal) — retire
 * d'abord le tirage du jour de l'archive pour que le remplaçant prenne
 * vraiment sa place dans l'historique, plutôt que de coexister avec lui.
 */
export async function rerollMonumentJSON() {
  const deleted = await deleteEntriesForToday();
  log.info(`Reroll: removed ${deleted} entr${deleted === 1 ? "y" : "ies"} from today's archive.`);
  await writeMonumentJSON();
}

// Seulement quand ce fichier est exécuté directement (npx tsx
// daily-monument/daily-fetch.ts) — pas quand index.ts l'importe juste pour
// récupérer writeMonumentJSON. Même bug que celui corrigé côté
// daily-animal/daily-fetch.ts : sans ce garde-fou, un simple `import`
// déclenchait un vrai appel à l'API UNESCO à chaque démarrage du serveur.
if (require.main === module) {
  writeMonumentJSON();
}
