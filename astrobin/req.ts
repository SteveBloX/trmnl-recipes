import fs from "fs/promises";
import { fetchAstrobinData } from "./fetch-astrobin";
import { dataPath } from "../data-dir";

type queryType = {
  username: string;
  timeWindow: string;
};

export async function astrobinRequest(query: queryType, body: any = null) {
  const filePath = dataPath("astrobin.json");

  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;

    const astrobin = await fetchAstrobinData();
    if (!astrobin) {
      return {
        error: "AstroBin cache is missing and feed fetch failed.",
      };
    }

    await fs.writeFile(filePath, JSON.stringify(astrobin, null, 2));
    return astrobin;
  }
}
