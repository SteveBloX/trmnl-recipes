import fs from "fs/promises";
import { fetchAstrobinData } from "./fetch-astrobin.ts";
import { dataPath } from "../data-dir";
import { getLogger } from "../logger";

const log = getLogger("astrobin");
const fileName = dataPath("astrobin.json");

export async function writeAstrobinJSON() {
  let data = null;
  while (data === null) data = await fetchAstrobinData();

  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  log.success(`AstroBin data written to ${fileName}`);
}
