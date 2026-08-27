import "dotenv/config";
import { getLogger } from "../logger";

const log = getLogger("fortnite-stats");
const FORTNITE_API_KEY = process.env.FORTNITE_API_KEY || "";
const testUserData = {
  username: "playerzz",
  level: 83,
  wins: 242,
  kd: 2.13,
  kills: 8034,
  deaths: 3768,
  matches: 4375,
  winRate: 8.46,
  timePlayed: 737.2,
  timeWindow: "Lifetime",
  playersOutlived: 215907,
  top3: 105,
  top5: 398,
  top6: 121,
  top10: 245,
  top12: 912,
  top25: 129,
};

const endpoint = "https://fortnite-api.com/v2/stats/br/v2";

type queryType = {
  username: string;
  timeWindow: string;
};

export async function statsRequest(query: queryType, body: any = null) {
  const { username, timeWindow } = query;
  if (username === "testplayer123456789") {
    return testUserData;
  }
  let ret = {};
  const url = `${endpoint}?name=${encodeURIComponent(
    username,
  )}&timeWindow=${timeWindow}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `${FORTNITE_API_KEY}`,
    },
  });
  const prettyTimeWindow = timeWindow === "lifetime" ? "Lifetime" : "Season";
  if (!response.ok) {
    log.warn(`Fortnite API error response: ${response.status} ${response.statusText}`);
    const statusCode = response.status;
    try {
      const errorData = await response.json();
      ret = {
        status: statusCode,
        error: errorData.error || `Error getting stats for "${username}".`,
      };
    } catch (e) {
      // If parsing fails, use default messages
      if (statusCode === 404) {
        ret = { error: `Player "${username}" not found.` };
      } else if (statusCode === 403) {
        ret = { error: `Stats for "${username}" are private.` };
      } else {
        ret = { error: `Error getting stats for "${username}".` };
      }
    }
    return {
      username,
      timeWindow: prettyTimeWindow,
      ...ret,
    };
  }
  const data = await response.json();
  const stats = data.data.stats.all.overall;
  // only get interesting fields
  const d = {
    username: data.data.account.name,
    level: data.data.battlePass.level,
    wins: stats.wins,
    kd: stats.kd,
    kills: stats.kills,
    deaths: stats.deaths,
    matches: stats.matches,
    winRate: stats.winRate,
    timePlayed: stats.minutesPlayed,
    timeWindow: prettyTimeWindow,
    playersOutlived: stats.playersOutlived,
    top3: stats.top3,
    top5: stats.top5,
    top6: stats.top6,
    top10: stats.top10,
    top12: stats.top12,
    top25: stats.top25,
  };
  // convert timePlayed to hours
  d.timePlayed = (d.timePlayed / 60).toFixed(1);
  return d;
}
