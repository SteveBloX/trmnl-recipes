import fs from "fs/promises";
import { fetchAstrobinData } from "./fetch-astrobin.ts";
import { dataPath } from "../data-dir";
import { getLogger } from "../logger";
import { retryWithAlert } from "../retry-with-alert";

const log = getLogger("astrobin");
const fileName = dataPath("astrobin.json");

export async function writeAstrobinJSON() {
  const data = await retryWithAlert("AstroBin", () => fetchAstrobinData());
  if (data === null) return; // toutes les tentatives ont échoué, déjà alerté — on garde l'ancien fichier

  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  log.success(`AstroBin data written to ${fileName}`);
}
