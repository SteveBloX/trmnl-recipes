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
import { animalRequest } from "./daily-animal/req";
import cron from "node-cron";
import crypto from "crypto";
import { writeMonumentJSON } from "./daily-monument/daily-fetch";
import { writeAstrobinJSON } from "./astrobin/daily-fetch";
import { writeAnimalJSON } from "./daily-animal/daily-fetch";
import { runHealthChecks, type HealthCheck } from "./health-check";
import fs from "fs";
import path from "path";
import { dataPath } from "./data-dir";
import { trackEvent } from "./analytics";
import {
  getFromArchive,
  getDailyHistory,
  getLatestForToday,
} from "./daily-animal/archive";
import { renderAnimalPage, renderNotFoundPage } from "./daily-animal/page";
import { renderAnimalOfTheDayPluginPage } from "./daily-animal/plugin-page";
import { findPlugin, PUBLIC_PLUGINS } from "./plugins-directory";
import { SITE_ORIGIN } from "./web-shell";
import {
  renderHomePage,
  renderPluginPage,
  renderPluginNotFoundPage,
} from "./plugins-pages";

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
  {
    name: "Animal of the Day",
    description:
      "A random wild animal (bird, mammal, reptile, amphibian or fish) from a real iNaturalist observation, with name and description in 6 languages.",
    route: "daily-animal",
    request: animalRequest,
  },
];

const healthChecks: HealthCheck[] = [
  {
    name: "Chinese Proverbs",
    run: () => proverbRequest({ lang: "french" } as any),
    validate: (r) =>
      r.chinese && r.translation ? null : "Missing proverb fields",
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
  {
    name: "Animal of the Day",
    run: () => animalRequest({} as any),
    validate: (r) =>
      r.imageURL && r.scientificName ? null : "Missing animal fields",
  },
];

const app = express();
const port = 4200;
app.use(bodyParser.json());

// Captures d'écran des plugins pour les cartes de la page d'accueil — voir
// plugins-directory.ts pour les noms de fichiers attendus. Ajoutées à la
// main dans public/screenshots/, pas générées.
app.use(
  "/screenshots",
  express.static(path.join(__dirname, "public", "screenshots")),
);

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
    console.error("Initial AstroBin fetch failed:", err),
  );
}

cron.schedule("0 0 * * *", async () => {
  await writeAnimalJSON();
});

// Same reasoning as AstroBin above: without this, a fresh data volume leaves
// /api/daily-animal failing until the next midnight cron. But unlike
// AstroBin, a missing animal.json doesn't necessarily mean no draw happened
// today — the volume can go missing (or the file get deleted) after a
// perfectly good draw was already archived. Re-drawing in that case would
// both waste an archive entry and show a different animal than the one
// already served earlier today, purely because of a restart. So: check the
// archive for today's most recent draw first, and only fetch a fresh one if
// there truly isn't one yet.
if (!fs.existsSync(dataPath("animal.json"))) {
  getLatestForToday()
    .then((todaysEntry) => {
      if (todaysEntry) {
        console.log(
          "animal.json missing but today's animal is already in the archive — restoring it instead of drawing a new one.",
        );
        return fs.promises.writeFile(
          dataPath("animal.json"),
          JSON.stringify(todaysEntry, null, 2),
        );
      }
      console.log("animal.json missing, fetching it once at startup…");
      return writeAnimalJSON();
    })
    .catch((err) =>
      console.error("Initial Animal of the Day fetch failed:", err),
    );
}

// déclenchement manuel : /api/health (JSON seul) ou /api/health?notify=1 (+ alerte Telegram)
// doit être déclarée avant /api/:appName qui capturerait la route sinon
app.get("/api/health", async (req, res) => {
  trackEvent("api_request", "/api/health", { endpoint: "health" });
  const results = await runHealthChecks(healthChecks, {
    notify: req.query.notify === "1",
  });
  return res.status(results.every((r) => r.ok) ? 200 : 503).json(results);
});

// Même règle que /api/health ci-dessus : un seul segment ("dokploy"), donc
// doit être déclarée avant /api/:appName sous peine d'y être capturée avec
// un 404 silencieux (déjà arrivé une fois — cf. historique du fichier).
app.get("/api/dokploy", requireRecipesKey, async (req, res) => {
  trackEvent("api_request", "/api/dokploy", { endpoint: "dokploy" });
  const result = await dokployRequest(req.query, req.body);
  return res.json(result);
});

app.get("/api/:appName", async (req, res) => {
  const appName = req.params.appName;
  const appConfig = apps.find((a) => a.route === appName);
  if (!appConfig) {
    return res.status(404).json({ error: "App not found" });
  }
  // Non-bloquant : un event Umami qui échoue ou traîne ne doit jamais
  // ralentir la réponse réelle de l'endpoint.
  trackEvent("api_request", `/api/${appName}`, { endpoint: appName });
  const { request } = appConfig;
  const result = await request(req.query, req.body);
  return res.json(result);
});

app.get("/api/motogp/standings/drivers", async (req, res) => {
  trackEvent("api_request", "/api/motogp/standings/drivers", {
    endpoint: "motogp-standings-drivers",
  });
  const result = await driverStandingsRequest(req.query, req.body);
  return res.json(result);
});

app.get("/api/motogp/standings/teams", async (req, res) => {
  trackEvent("api_request", "/api/motogp/standings/teams", {
    endpoint: "motogp-standings-teams",
  });
  const result = await teamStandingsRequest(req.query, req.body);
  return res.json(result);
});

app.get("/api/motogp/schedule", async (req, res) => {
  trackEvent("api_request", "/api/motogp/schedule", {
    endpoint: "motogp-schedule",
  });
  const result = await scheduleRequest(req.query, req.body);
  return res.json(result);
});

// Cible du QR code du layout "full" d'Animal of the Day — voir
// daily-animal/archive.ts pour pourquoi ce n'est pas juste animal.json.
app.get("/animal/:slug", async (req, res) => {
  const { slug } = req.params;
  const entry = await getFromArchive(slug);
  trackEvent("animal_page_view", `/animal/${slug}`, {
    slug,
    found: !!entry,
  });
  res.set("Content-Type", "text/html; charset=utf-8");
  if (!entry) {
    return res.status(404).send(renderNotFoundPage());
  }
  return res.send(renderAnimalPage(entry));
});

// Pas de pages /animal/:slug dedans : ça grandit d'une entrée par jour pour
// toujours, aucun intérêt SEO à les faire indexer une par une — l'annuaire
// de plugins suffit.
app.get("/sitemap.xml", (req, res) => {
  const urlsXml = [
    `<url><loc>${SITE_ORIGIN}/</loc></url>`,
    ...PUBLIC_PLUGINS.map(
      (p) => `<url><loc>${SITE_ORIGIN}/plugins/${p.slug}</loc></url>`
    ),
  ].join("\n");
  res.set("Content-Type", "application/xml; charset=utf-8");
  return res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`
  );
});

app.get("/robots.txt", (req, res) => {
  res.set("Content-Type", "text/plain; charset=utf-8");
  return res.send(`User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
});

// Page d'accueil : annuaire de mes plugins TRMNL publics.
app.get("/", (req, res) => {
  trackEvent("home_page_view", "/");
  res.set("Content-Type", "text/html; charset=utf-8");
  return res.send(renderHomePage());
});

// Fiche riche (historique + recherche) pour Animal of the Day — doit être
// déclarée avant /plugins/:slug ci-dessous, sinon ce dernier la capturerait
// et servirait le template générique à la place (même piège que
// /api/dokploy vs /api/:appName plus haut dans ce fichier).
app.get("/plugins/animal-of-the-day", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const group = typeof req.query.group === "string" ? req.query.group : "";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  trackEvent("plugin_page_view", "/plugins/animal-of-the-day", {
    slug: "animal-of-the-day",
    found: true,
    ...(query ? { query } : {}),
    ...(group ? { group } : {}),
    ...(page > 1 ? { page } : {}),
  });
  const history = await getDailyHistory();
  res.set("Content-Type", "text/html; charset=utf-8");
  return res.send(
    renderAnimalOfTheDayPluginPage({ history, query, group, page })
  );
});

app.get("/plugins/:slug", (req, res) => {
  const { slug } = req.params;
  const plugin = findPlugin(slug);
  trackEvent("plugin_page_view", `/plugins/${slug}`, {
    slug,
    found: !!plugin,
  });
  res.set("Content-Type", "text/html; charset=utf-8");
  if (!plugin) {
    return res.status(404).send(renderPluginNotFoundPage());
  }
  return res.send(renderPluginPage(plugin));
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
