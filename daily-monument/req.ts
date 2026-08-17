import fs from "fs";
import { fetchRandomMonument } from "./fetch-monument";
import { dataPath } from "../data-dir";

type queryType = {
  username: string;
  timeWindow: string;
};

export async function monumentRequest(query: queryType, body: any = null) {
  // read file
  const data = fs.readFileSync(dataPath("monument.json"), "utf-8");
  const monument = JSON.parse(data);
  return monument;
}
