import fs from "fs";

type queryType = {
  username: string;
  timeWindow: string;
};

export async function monumentRequest(query: queryType, body: any = null) {
  const monumentData = fs.readFileSync("monument.json", "utf-8");
  console.log("Monument data read from monument.json");
  const monument = JSON.parse(monumentData);
  return monument;
}
