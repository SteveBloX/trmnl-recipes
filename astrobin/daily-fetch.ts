import fs from "fs/promises";
import { fetchAstrobinData } from "./fetch-astrobin.ts";

const fileName = "astrobin.json";

export async function writeAstrobinJSON() {
  let data = null;
  while (data === null) data = await fetchAstrobinData();

  await fs.writeFile(fileName, JSON.stringify(data, null, 2));
  console.log(`AstroBin data written to ${fileName}`);
}
