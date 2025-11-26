import "dotenv/config";

const FORTNITE_API_KEY = process.env.FORTNITE_API_KEY || "";
/* EXAMPLE RESPONSE:
{
	"status": 200,
	"data": {
		"account": {
			"id": "6b8c1546582c4b4785ac30eedabd374a",
			"name": "Rᴀɴᴀ ʟᴏᴠᴇ ᴜ ღ"
		},
		"battlePass": {
			"level": 40,
			"progress": 3
		},
		"stats": {
			"all": {
				"overall": {
					"score": 1296053,
					"scorePerMin": 22.274,
					"scorePerMatch": 225.44,
					"wins": 318,
					"top3": 87,
					"top5": 627,
					"top6": 131,
					"top10": 147,
					"top12": 1189,
					"top25": 245,
					"kills": 10544,
					"killsPerMin": 0.181,
					"killsPerMatch": 1.834,
					"deaths": 5431,
					"kd": 1.941,
					"matches": 5749,
					"winRate": 5.531,
					"minutesPlayed": 58187,
					"playersOutlived": 283676,
					"lastModified": "2025-11-24T19:01:24Z"
				},
        ...
*/

const endpoint = "https://fortnite-api.com/v2/stats/br/v2";

type queryType = {
  username: string;
  timeWindow: string;
};

export async function statsRequest(query: queryType, body: any = null) {
  const { username, timeWindow } = query;
  let ret = {};
  const url = `${endpoint}?name=${encodeURIComponent(
    username
  )}&timeWindow=${timeWindow}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `${FORTNITE_API_KEY}`,
    },
  });
  if (!response.ok) {
    console.log("Error response:", response);
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
    return ret;
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
    matches: stats.matches,
    winRate: stats.winRate,
    timePlayed: stats.minutesPlayed,
    timeWindow: timeWindow === "lifetime" ? "Lifetime" : "Season",
  };
  // convert timePlayed to hours
  d.timePlayed = (d.timePlayed / 60).toFixed(1);
  console.log(d);
  return d;
}
