import fs from "fs/promises";
import { fetchRandomNaturalWonder } from "./fetch-natural-wonder";
import { dataPath } from "../data-dir";

type queryType = Record<string, never>;

export async function naturalWonderRequest(query: queryType, body: any = null) {
  const filePath = dataPath("natural-wonder.json");

  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;

    let wonder = null;
    while (wonder === null) wonder = await fetchRandomNaturalWonder();

    await fs.writeFile(filePath, JSON.stringify(wonder, null, 2));
    return wonder;
  }
}
