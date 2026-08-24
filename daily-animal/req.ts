import fs from "fs/promises";
import { fetchRandomAnimal } from "./fetch-animal";
import { dataPath } from "../data-dir";

type queryType = Record<string, never>;

export async function animalRequest(query: queryType, body: any = null) {
  const filePath = dataPath("animal.json");

  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;

    let animal = null;
    while (animal === null) animal = await fetchRandomAnimal();

    await fs.writeFile(filePath, JSON.stringify(animal, null, 2));
    return animal;
  }
}
