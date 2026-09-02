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

    // fetchAstrobinData lance une exception en cas d'échec réel — laissée
    // remonter telle quelle (voir index.ts, la route générique /api/:appName
    // la transforme automatiquement en 500 via Express 5).
    const astrobin = await fetchAstrobinData();

    await fs.writeFile(filePath, JSON.stringify(astrobin, null, 2));
    return astrobin;
  }
}
