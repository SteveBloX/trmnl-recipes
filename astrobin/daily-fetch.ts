import fs from "fs/promises";
import { fetchAstrobinData } from "./fetch-astrobin.ts";
import { dataPath } from "../data-dir";

const fileName = dataPath("astrobin.json");

export async function writeAstrobinJSON() {
  let data = null;
  while (data === null) data = await fetchAstrobinData();

  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  console.log(`AstroBin data written to ${fileName}`);
}
