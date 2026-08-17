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
import { dokployRequest } from "./dokploy/req";
import cron from "node-cron";
import crypto from "crypto";
import { writeMonumentJSON } from "./daily-monument/daily-fetch";
import { writeAstrobinJSON } from "./astrobin/daily-fetch";
import { runHealthChecks, type HealthCheck } from "./health-check";
import fs from "fs";
import { dataPath } from "./data-dir";

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
    // `book` only: 61 of the 242 scraped quotes carry no source, so requiring
    // it failed a quarter of the random picks and alerted on data that was
    // merely incomplete, not on an API that was down.
    validate: (r) => (r.quote ? null : "Missing quote field"),
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
  {
    name: "Dokploy",
    run: () => dokployRequest({} as any, null),
    validate: (r) => (r.services ? null : "Missing services field"),
  },
];

const app = express();
const port = 4200;
app.use(bodyParser.json());

// Contrairement aux autres routes /api/*, /api/dokploy expose des infos
// privées (services, RAM/disque, déploiements) : elle exige un header
// x-recipes-key qui doit matcher RECIPES_API_KEY, comparé en temps constant
// pour éviter le timing attack. Ce header se règle dans le champ
// polling_headers du plugin TRMNL via l'UI web (jamais commit dans settings.yml).
function requireRecipesKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const expected = process.env.RECIPES_API_KEY || "";
  const provided = req.header("x-recipes-key") || "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  const match =
    expected.length > 0 &&
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf);
  if (!match) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

cron.schedule("0 * * * *", async () => {
  await runHealthChecks(healthChecks);
});

cron.schedule("*/10 * * * *", async () => {
  await writeMonumentJSON();
});

cron.schedule("0 0 * * *", async () => {
  await writeAstrobinJSON();
});

// The cron above only fires at midnight, so a start with an empty data volume
// would leave /api/astrobin failing for up to a day. Fetch once when the file
// is missing — and only then, so a restart never discards the day's pick.
if (!fs.existsSync(dataPath("astrobin.json"))) {
  console.log("astrobin.json missing, fetching it once at startup…");
  writeAstrobinJSON().catch((err) =>
    console.error("Initial AstroBin fetch failed:", err)
  );
}

// déclenchement manuel : /api/health (JSON seul) ou /api/health?notify=1 (+ alerte Telegram)
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

app.get("/api/dokploy", requireRecipesKey, async (req, res) => {
  const result = await dokployRequest(req.query, req.body);
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
