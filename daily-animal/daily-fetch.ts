import { fetchRandomAnimal } from "./fetch-animal.ts";
import fs from "fs/promises";
import { dataPath } from "../data-dir";
import { getLogger } from "../logger";

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

// Seulement quand ce fichier est exécuté directement (npx tsx
// daily-animal/daily-fetch.ts) — pas quand index.ts l'importe juste pour
// récupérer writeAnimalJSON. Sans ce garde-fou, un simple `import` déclenchait
// un tirage à chaque démarrage, avant même que la garde de démarrage dans
// index.ts (qui vérifie l'archive du jour) ait pu s'exécuter.
if (require.main === module) {
  writeAnimalJSON();
  writeBabyAnimalJSON();
}
