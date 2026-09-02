import { urls } from "./links.json";
import express from "express";
import bodyParser from "body-parser";
import { proverbRequest } from "./chinese-proverbs/req";
import { statsRequest } from "./fortnite-stats/req";
import { monumentRequest } from "./daily-monument/req";
import {
  getFromArchive as getMonumentFromArchive,
  getDailyHistory as getMonumentDailyHistory,
  getLatestForToday as getLatestMonumentForToday,
} from "./daily-monument/archive";
import { renderMonumentOfTheDayPluginPage } from "./daily-monument/plugin-page";
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
import { naturalWonderRequest } from "./daily-natural-wonder/req";
import cron from "node-cron";
import crypto from "crypto";
import { writeMonumentJSON } from "./daily-monument/daily-fetch";
import { writeAstrobinJSON } from "./astrobin/daily-fetch";
import {
  writeAnimalJSON,
  writeBabyAnimalJSON,
  rerollAnimalJSON,
} from "./daily-animal/daily-fetch";
import { writeNaturalWonderJSON } from "./daily-natural-wonder/daily-fetch";
import { runHealthChecks, type HealthCheck } from "./health-check";
import fs from "fs";
import path from "path";
import { dataPath } from "./data-dir";
import { trackEvent } from "./analytics";
import { getLogger } from "./logger";
import {
  getFromArchive,
  getDailyHistory,
  getLatestForToday,
  getBabyFromArchive,
  getBabyDailyHistory,
  getLatestBabyForToday,
} from "./daily-animal/archive";
import { renderAnimalPage, renderNotFoundPage } from "./daily-animal/page";
import { renderAnimalOfTheDayPluginPage } from "./daily-animal/plugin-page";
import {
  getFromArchive as getWonderFromArchive,
  getDailyHistory as getWonderDailyHistory,
  getLatestForToday as getLatestWonderForToday,
} from "./daily-natural-wonder/archive";
import {
  renderNaturalWonderPage,
  renderNotFoundPage as renderWonderNotFoundPage,
} from "./daily-natural-wonder/page";
import { renderNaturalWonderPluginPage } from "./daily-natural-wonder/plugin-page";
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
  {
    name: "Natural Wonder of the Day",
    description:
      "A random Natural or Mixed UNESCO World Heritage Site, with name and description in 6 languages.",
    route: "daily-natural-wonder",
    request: naturalWonderRequest,
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
  {
    name: "Animal of the Day (Babies)",
    run: () => animalRequest({ babies: "yes" } as any),
    validate: (r) =>
      r.imageURL && r.scientificName ? null : "Missing animal fields",
  },
  {
    name: "Natural Wonder of the Day",
    run: () => naturalWonderRequest({} as any),
    validate: (r) =>
      r.imageURL && r.name?.en ? null : "Missing natural wonder fields",
  },
];

const log = getLogger("server");
const httpLog = getLogger("http");

const app = express();
const port = 4200;
app.use(bodyParser.json());

// Une ligne par requête (méthode, chemin, statut, durée) — avant ça, la seule
// façon de savoir ce qui se passait sur le serveur en prod était de recouper
// les logs épars des différents plugins. Volontairement minimal (pas de body,
// pas d'IP) : un aperçu du trafic, pas un système d'audit.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    httpLog.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Captures d'écran des plugins pour les cartes de la page d'accueil — voir
// plugins-directory.ts pour les noms de fichiers attendus. Ajoutées à la
// main dans public/screenshots/, pas générées.
app.use(
  "/screenshots",
  express.static(path.join(__dirname, "public", "screenshots")),
);

// Images UNESCO mises en cache par image-cache.ts (Monument + Natural
// Wonder) — sur le volume de données, pas dans public/, car générées à
// l'exécution plutôt que commit.
app.use("/images", express.static(dataPath("images")));

// Contrairement aux autres routes /api/*, /api/dokploy (et les routes admin
// comme le reroll manuel plus bas) exposent des actions privées : elles
// exigent la clé RECIPES_API_KEY, comparée en temps constant pour éviter le
// timing attack. Accepte le header x-recipes-key (dokploy, réglé dans
// polling_headers via l'UI TRMNL, jamais commit) ou ?key=... en query (pour
// pouvoir déclencher un reroll depuis une simple URL dans le navigateur).
function requireRecipesKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const expected = process.env.RECIPES_API_KEY || "";
  const provided = req.header("x-recipes-key") || String(req.query.key || "");
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

// Passé de */10 min à 1x/jour pour que l'historique par jour ait un sens
// (voir daily-monument/archive.ts) — 144 tirages/jour ne laissaient de toute
// façon place à aucune notion de "monument du jour" cohérente, et
// refresh_interval côté settings.yml était déjà réglé sur 1440 (quotidien).
// Même try/catch appliqué aux 5 tirages quotidiens ci-dessous : sans lui, une
// erreur transitoire (réseau, API en rate-limit...) passait inaperçue —
// aucun log, aucune retentative, le fichier de la veille restait servi
// indéfiniment jusqu'au prochain tirage réussi. Bug vécu en prod le
// 02/09/2026 sur Animal of the Day (aucun animal du jour, rien dans les logs).
cron.schedule("0 0 * * *", async () => {
  await writeMonumentJSON().catch((err) => log.error("Daily Monument fetch failed:", err));
});

// Même raisonnement que pour Animal/Natural Wonder plus bas : re-vérifier
// l'archive du jour avant de tirer, pour ne pas gaspiller une entrée ni
// changer le monument déjà servi plus tôt aujourd'hui à cause d'un simple
// redémarrage.
if (!fs.existsSync(dataPath("monument.json"))) {
  getLatestMonumentForToday()
    .then((todaysEntry) => {
      if (todaysEntry) {
        log.info(
          "monument.json missing but today's monument is already in the archive — restoring it instead of drawing a new one.",
        );
        return fs.promises.writeFile(
          dataPath("monument.json"),
          JSON.stringify(todaysEntry, null, 2),
        );
      }
      log.info("monument.json missing, fetching it once at startup…");
      return writeMonumentJSON();
    })
    .catch((err) => log.error("Initial Monument of the Day fetch failed:", err));
}

cron.schedule("0 0 * * *", async () => {
  await writeAstrobinJSON().catch((err) => log.error("Daily AstroBin fetch failed:", err));
});

// The cron above only fires at midnight, so a start with an empty data volume
// would leave /api/astrobin failing for up to a day. Fetch once when the file
// is missing — and only then, so a restart never discards the day's pick.
if (!fs.existsSync(dataPath("astrobin.json"))) {
  log.info("astrobin.json missing, fetching it once at startup…");
  writeAstrobinJSON().catch((err) => log.error("Initial AstroBin fetch failed:", err));
}

cron.schedule("0 0 * * *", async () => {
  await writeAnimalJSON().catch((err) => log.error("Daily Animal of the Day fetch failed:", err));
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
        log.info(
          "animal.json missing but today's animal is already in the archive — restoring it instead of drawing a new one.",
        );
        return fs.promises.writeFile(
          dataPath("animal.json"),
          JSON.stringify(todaysEntry, null, 2),
        );
      }
      log.info("animal.json missing, fetching it once at startup…");
      return writeAnimalJSON();
    })
    .catch((err) => log.error("Initial Animal of the Day fetch failed:", err));
}

cron.schedule("0 0 * * *", async () => {
  await writeBabyAnimalJSON().catch((err) => log.error("Daily baby Animal of the Day fetch failed:", err));
});

// Même garde-fou que pour animal.json juste au-dessus, appliqué à l'archive
// séparée du mode bébés (voir daily-animal/archive.ts).
if (!fs.existsSync(dataPath("animal-babies.json"))) {
  getLatestBabyForToday()
    .then((todaysEntry) => {
      if (todaysEntry) {
        log.info(
          "animal-babies.json missing but today's baby animal is already in the archive — restoring it instead of drawing a new one.",
        );
        return fs.promises.writeFile(
          dataPath("animal-babies.json"),
          JSON.stringify(todaysEntry, null, 2),
        );
      }
      log.info("animal-babies.json missing, fetching it once at startup…");
      return writeBabyAnimalJSON();
    })
    .catch((err) => log.error("Initial baby Animal of the Day fetch failed:", err));
}

cron.schedule("0 0 * * *", async () => {
  await writeNaturalWonderJSON().catch((err) => log.error("Daily Natural Wonder fetch failed:", err));
});

// Même raisonnement que pour Animal of the Day juste au-dessus : re-vérifier
// l'archive du jour avant de tirer, pour ne pas gaspiller une entrée ni
// changer la merveille déjà servie plus tôt aujourd'hui, à cause d'un simple
// redémarrage.
if (!fs.existsSync(dataPath("natural-wonder.json"))) {
  getLatestWonderForToday()
    .then((todaysEntry) => {
      if (todaysEntry) {
        log.info(
          "natural-wonder.json missing but today's wonder is already in the archive — restoring it instead of drawing a new one.",
        );
        return fs.promises.writeFile(
          dataPath("natural-wonder.json"),
          JSON.stringify(todaysEntry, null, 2),
        );
      }
      log.info("natural-wonder.json missing, fetching it once at startup…");
      return writeNaturalWonderJSON();
    })
    .catch((err) => log.error("Initial Natural Wonder of the Day fetch failed:", err));
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

// Reroll manuel d'Animal of the Day : quand le tirage du jour rend mal à
// l'écran, plutôt que d'attendre le lendemain. Retire le tirage du jour de
// l'archive avant d'en générer un nouveau — voir rerollAnimalJSON. Même
// clé que /api/dokploy, acceptée en query (?key=...) pour rester une simple
// URL à ouvrir dans le navigateur plutôt qu'exiger curl/Postman.
app.get("/api/admin/reroll-animal", requireRecipesKey, async (req, res) => {
  const babiesOnly = req.query.babies === "yes";
  try {
    await rerollAnimalJSON(babiesOnly);
    return res.json({ ok: true, babiesOnly });
  } catch (err: any) {
    log.error("Manual animal reroll failed:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
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
  const { slug: rawSlug } = req.params;
  // Les slugs sont exclusivement hexadécimaux (0-9a-f) — un "q" final ne
  // peut donc jamais faire partie d'un vrai slug, ce qui en fait un marqueur
  // sans ambiguïté. Le QR du markup "full" encode <slug>q ; un lien normal
  // (historique du site, partage...) encode le slug nu, sans ce suffixe.
  // Bien plus léger qu'un "?src=qr" en franchise de caractères pour le QR.
  const fromQr = /q$/.test(rawSlug);
  const slug = fromQr ? rawSlug.slice(0, -1) : rawSlug;
  // Archives séparées (normal / bébés, voir daily-animal/archive.ts) mais un
  // seul schéma d'URL /animal/<slug> — on cherche dans l'une puis l'autre.
  const entry = (await getFromArchive(slug)) ?? (await getBabyFromArchive(slug));
  trackEvent("animal_page_view", `/animal/${slug}`, {
    slug,
    found: !!entry,
    ...(fromQr ? { source: "qr" } : {}),
  });
  if (fromQr) {
    trackEvent("qr_scan", `/animal/${slug}`, { plugin: "animal-of-the-day", slug });
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  if (!entry) {
    return res.status(404).send(renderNotFoundPage());
  }
  return res.send(renderAnimalPage(entry));
});

// Cible du QR code du layout "full" de Natural Wonder of the Day — même
// principe que /animal/:slug juste au-dessus.
app.get("/natural-wonder/:slug", async (req, res) => {
  const { slug: rawSlug } = req.params;
  // Même astuce que /animal/:slug ci-dessus : "q" final = marqueur QR, jamais
  // un vrai caractère de slug (hexadécimal uniquement).
  const fromQr = /q$/.test(rawSlug);
  const slug = fromQr ? rawSlug.slice(0, -1) : rawSlug;
  const entry = await getWonderFromArchive(slug);
  trackEvent("natural_wonder_page_view", `/natural-wonder/${slug}`, {
    slug,
    found: !!entry,
    ...(fromQr ? { source: "qr" } : {}),
  });
  if (fromQr) {
    trackEvent("qr_scan", `/natural-wonder/${slug}`, {
      plugin: "natural-wonder-of-the-day",
      slug,
    });
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  if (!entry) {
    return res.status(404).send(renderWonderNotFoundPage());
  }
  return res.send(renderNaturalWonderPage(entry));
});

// Cible du QR code de Monument of the Day — contrairement à /animal/:slug et
// /natural-wonder/:slug, ce n'est pas une page mais une redirection pure vers
// la vraie fiche UNESCO (officialURL) : Monument n'a pas de contenu propre à
// afficher (pas de description enrichie multilingue distincte de ce que le
// markup montre déjà). Aucun autre lien du site ne pointe vers cette route
// (l'historique de /plugins/monument-of-the-day lie directement officialURL)
// donc, contrairement aux deux autres, chaque visite ici est sans ambiguïté
// un scan de QR — pas besoin du même marqueur "q".
app.get("/monument/:slug", async (req, res) => {
  const { slug } = req.params;
  const entry = await getMonumentFromArchive(slug);
  trackEvent("qr_scan", `/monument/${slug}`, { plugin: "monument-of-the-day", slug });
  // Archive réinitialisée, volume perdu... un lien mort ferait un mauvais
  // atterrissage pour quelqu'un qui vient de scanner physiquement un QR —
  // mieux vaut renvoyer vers la liste UNESCO que vers une page d'erreur.
  return res.redirect(entry?.officialURL || "https://whc.unesco.org/en/list/");
});

// Pas de pages /animal/:slug ni /natural-wonder/:slug dedans : ça grandit
// d'une entrée par jour pour toujours, aucun intérêt SEO à les faire indexer
// une par une — l'annuaire de plugins suffit.
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
  const mode = req.query.mode === "babies" ? "babies" : "normal";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  trackEvent("plugin_page_view", "/plugins/animal-of-the-day", {
    slug: "animal-of-the-day",
    found: true,
    ...(query ? { query } : {}),
    ...(group ? { group } : {}),
    ...(mode === "babies" ? { mode } : {}),
    ...(page > 1 ? { page } : {}),
  });
  const history =
    mode === "babies" ? await getBabyDailyHistory() : await getDailyHistory();
  res.set("Content-Type", "text/html; charset=utf-8");
  return res.send(
    renderAnimalOfTheDayPluginPage({ history, query, group, page, mode })
  );
});

// Même piège que ci-dessus : doit être déclarée avant /plugins/:slug.
app.get("/plugins/natural-wonder-of-the-day", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const category =
    typeof req.query.category === "string" ? req.query.category : "";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  trackEvent("plugin_page_view", "/plugins/natural-wonder-of-the-day", {
    slug: "natural-wonder-of-the-day",
    found: true,
    ...(query ? { query } : {}),
    ...(category ? { category } : {}),
    ...(page > 1 ? { page } : {}),
  });
  const history = await getWonderDailyHistory();
  res.set("Content-Type", "text/html; charset=utf-8");
  return res.send(
    renderNaturalWonderPluginPage({ history, query, category, page })
  );
});

// Même piège que ci-dessus : doit être déclarée avant /plugins/:slug.
app.get("/plugins/monument-of-the-day", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  trackEvent("plugin_page_view", "/plugins/monument-of-the-day", {
    slug: "monument-of-the-day",
    found: true,
    ...(query ? { query } : {}),
    ...(page > 1 ? { page } : {}),
  });
  const history = await getMonumentDailyHistory();
  res.set("Content-Type", "text/html; charset=utf-8");
  return res.send(renderMonumentOfTheDayPluginPage({ history, query, page }));
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
  log.success(`Server is running on http://localhost:${port}`);
});
