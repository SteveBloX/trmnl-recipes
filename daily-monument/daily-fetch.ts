import { fetchRandomMonument } from "./fetch-monument.ts";
import fs from "fs/promises";
import { dataPath } from "../data-dir";

const fileName = dataPath("monument.json");

export async function writeMonumentJSON() {
  let data = null;
  while (data === null) data = await fetchRandomMonument();

  // file may not exist yet
  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  console.log(`Monument data written to ${fileName}`);
}

// Seulement quand ce fichier est exécuté directement (npx tsx
// daily-monument/daily-fetch.ts) — pas quand index.ts l'importe juste pour
// récupérer writeMonumentJSON. Même bug que celui corrigé côté
// daily-animal/daily-fetch.ts : sans ce garde-fou, un simple `import`
// déclenchait un vrai appel à l'API UNESCO à chaque démarrage du serveur.
if (require.main === module) {
  writeMonumentJSON();
}
