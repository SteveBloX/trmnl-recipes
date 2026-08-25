import { fetchRandomAnimal } from "./fetch-animal.ts";
import fs from "fs/promises";
import { dataPath } from "../data-dir";

const fileName = dataPath("animal.json");

export async function writeAnimalJSON() {
  let data = null;
  while (data === null) data = await fetchRandomAnimal();

  // file may not exist yet
  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  console.log(`Animal data written to ${fileName}`);
}

// Seulement quand ce fichier est exécuté directement (npx tsx
// daily-animal/daily-fetch.ts) — pas quand index.ts l'importe juste pour
// récupérer writeAnimalJSON. Sans ce garde-fou, un simple `import` déclenchait
// un tirage à chaque démarrage, avant même que la garde de démarrage dans
// index.ts (qui vérifie l'archive du jour) ait pu s'exécuter.
if (require.main === module) {
  writeAnimalJSON();
}
