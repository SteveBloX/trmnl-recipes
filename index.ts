import { urls } from "./links.json";
import express from "express";
import bodyParser from "body-parser";
import { proverbRequest } from "./chinese-proverbs/req";
import { statsRequest } from "./fortnite-stats/req";
import { monumentRequest } from "./daily-monument/req";
import { astrobinRequest } from "./astrobin/req";
import { worldCupRequest } from "./world-cup/req";
import { shakespeareRequest } from "./shakespeare-quotes/req";
import { wordRequest } from "./word/req";
import {
  driverStandingsRequest,
  teamStandingsRequest,
  scheduleRequest,
} from "./motogp/req";
import cron from "node-cron";
import { writeMonumentJSON } from "./daily-monument/daily-fetch";
import { writeAstrobinJSON } from "./astrobin/daily-fetch";
import { runHealthChecks, type HealthCheck } from "./health-check";

const apps = [
  {
    name: "Chinese Proverbs",
    description:
      "A collection of Chinese proverbs with their French translations.",
    route: "chinese-proverbs",
    request: proverbRequest,
  },
  {
    name: "Fortnite Stats",
    description:
      "Fetch Fortnite Battle Royale statistics for a given username.",
    route: "fortnite-stats",
    request: statsRequest,
  },
  {
    name: "Monument of the Day",
    description:
      "Get information about a random UNESCO World Heritage monument.",
    route: "daily-monument",
    request: monumentRequest,
  },
  {
    name: "AstroBin",
    description:
      "Get AstroBin Image of the Day feed and one random image from Top Picks.",
    route: "astrobin",
    request: astrobinRequest,
  },
  {
    name: "World Cup 2026",
    description: "FIFA World Cup 2026 knockout bracket with live scores.",
    route: "world-cup",
    request: worldCupRequest,
  },
  {
    name: "Shakespeare Quotes",
    description: "A random quote from the works of William Shakespeare.",
    route: "shakespeare-quotes",
    request: shakespeareRequest,
  },
  {
    name: "Multilingual Word of the Day",
    description:
      "A daily rare word with definition, pronunciation, etymology and translations. Languages: fr, en, es, de, pl.",
    route: "word",
    request: wordRequest,
  },
];

const healthChecks: HealthCheck[] = [
  {
    name: "Chinese Proverbs",
    run: () => proverbRequest({ lang: "french" } as any),
    validate: (r) => (r.chinese && r.translation ? null : "Missing proverb fields"),
  },
  {
    name: "Fortnite Stats",
    run: () => statsRequest({ username: "Ninja", timeWindow: "lifetime" }),
    validate: (r) => (r.wins !== undefined ? null : "Missing stats fields"),
  },
  {
    name: "Monument of the Day",
    run: () => monumentRequest({} as any),
    validate: (r) => (Object.keys(r).length > 0 ? null : "Empty monument data"),
  },
  {
    name: "AstroBin",
    run: () => astrobinRequest({} as any),
  },
  {
    name: "World Cup 2026",
    run: () => worldCupRequest({} as any),
  },
  {
    name: "Shakespeare Quotes",
    run: () => shakespeareRequest({}),
    validate: (r) => (r.quote && r.book ? null : "Missing quote fields"),
  },
  {
    name: "Word of the Day",
    run: () => wordRequest({ lang: "fr" }),
    validate: (r) => (r.word && r.definition ? null : "Missing word fields"),
  },
  {
    name: "MotoGP Driver Standings",
    run: () => driverStandingsRequest({} as any, null),
  },
  // MotoGP Team Standings exclu : renvoie "not implemented yet" en permanence
  {
    name: "MotoGP Schedule",
    run: () => scheduleRequest({} as any, null),
  },
];

const app = express();
const port = 4200;
app.use(bodyParser.json());

cron.schedule("0 * * * *", async () => {
  await runHealthChecks(healthChecks);
});

cron.schedule("*/10 * * * *", async () => {
  await writeMonumentJSON();
});

cron.schedule("0 0 * * *", async () => {
  await writeAstrobinJSON();
});

// déclenchement manuel : /api/health (JSON seul) ou /api/health?notify=1 (+ alerte Discord)
// doit être déclarée avant /api/:appName qui capturerait la route sinon
app.get("/api/health", async (req, res) => {
  const results = await runHealthChecks(healthChecks, {
    notify: req.query.notify === "1",
  });
  return res.status(results.every((r) => r.ok) ? 200 : 503).json(results);
});

app.get("/api/:appName", async (req, res) => {
  const appName = req.params.appName;
  const appConfig = apps.find((a) => a.route === appName);
  if (!appConfig) {
    return res.status(404).json({ error: "App not found" });
  }
  const { request } = appConfig;
  const result = await request(req.query, req.body);
  return res.json(result);
});

app.get("/api/motogp/standings/drivers", async (req, res) => {
  const result = await driverStandingsRequest(req.query, req.body);
  return res.json(result);
});

app.get("/api/motogp/standings/teams", async (req, res) => {
  const result = await teamStandingsRequest(req.query, req.body);
  return res.json(result);
});

app.get("/api/motogp/schedule", async (req, res) => {
  const result = await scheduleRequest(req.query, req.body);
  return res.json(result);
});

app.get("/links/:name", (req, res) => {
  const name = req.params.name;
  const link = urls.find((u) => u.name === name);
  if (!link) {
    return res.status(404).json({ error: "Link not found" });
  }
  // redirect to the url
  return res.redirect(link.url);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
