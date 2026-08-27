import { fetchRandomNaturalWonder } from "./fetch-natural-wonder.ts";
import fs from "fs/promises";
import { dataPath } from "../data-dir";
import { getLogger } from "../logger";

const log = getLogger("daily-natural-wonder");
const fileName = dataPath("natural-wonder.json");

export async function writeNaturalWonderJSON() {
  let data = null;
  while (data === null) data = await fetchRandomNaturalWonder();

  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  log.success(`Natural wonder data written to ${fileName}`);
}

// Garde-fou dès le départ (bug déjà rencontré et corrigé côté Animal et
// Monument) : sans lui, un simple `import` de ce fichier par index.ts
// déclencherait un vrai appel à l'API UNESCO à chaque démarrage du serveur.
if (require.main === module) {
  writeNaturalWonderJSON();
}
