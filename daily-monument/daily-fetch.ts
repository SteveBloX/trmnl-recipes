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

writeMonumentJSON();
