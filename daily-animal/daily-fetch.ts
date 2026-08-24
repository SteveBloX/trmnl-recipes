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

writeAnimalJSON();
