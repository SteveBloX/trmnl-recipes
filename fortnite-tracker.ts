import { FortniteAPI } from "@yaelouuu/fortnite-api";

// get api key from environment variables
export const FORTNITE_API_KEY =
  "fe873b9857a2433ebec374eb9ad62140befd2f31196b1bbcc08e54fb7f144903";

const client = new FortniteAPI({
  apiKey: FORTNITE_API_KEY,
});

async function fetchFortniteStats(username: string) {
  const stats = await client.profiles.getStats("Rᴀɴᴀ ʟᴏᴠᴇ ᴜ ღ");
  return stats;
}

fetchFortniteStats("SomeUsername").then((stats) => {
  console.log(stats);
});
