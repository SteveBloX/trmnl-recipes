import fs from "fs";
import { fetchRandomMonument } from "./fetch-monument";

type queryType = {
  username: string;
  timeWindow: string;
};

export async function monumentRequest(query: queryType, body: any = null) {
  console.log("New monument query");
  const monument = await fetchRandomMonument();
  return monument;
}
