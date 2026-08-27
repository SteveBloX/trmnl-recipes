import fs from "fs/promises";
import { fetchRandomAnimal } from "./fetch-animal";
import { dataPath } from "../data-dir";

type queryType = { babies?: string };

export async function animalRequest(query: queryType, body: any = null) {
  // `babies` vient du custom field interpolé dans polling_url (settings.yml)
  // — cf. le compte-rendu qui a précédé cette implémentation : une seule
  // instance ne peut pas influencer les autres, donc les deux variantes sont
  // tirées et cachées séparément chaque jour, et cet endpoint sert la bonne
  // selon ce paramètre plutôt que de personnaliser le tirage lui-même.
  const babiesOnly = query?.babies === "yes";
  const filePath = dataPath(babiesOnly ? "animal-babies.json" : "animal.json");

  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;

    let animal = null;
    while (animal === null) animal = await fetchRandomAnimal(babiesOnly);

    await fs.writeFile(filePath, JSON.stringify(animal, null, 2));
    return animal;
  }
}
