import { urls } from "./links.json";
import express from "express";
import bodyParser from "body-parser";
import { proverbRequest } from "./chinese-proverbs/req";
import { statsRequest } from "./fortnite-stats/req";
import { monumentRequest } from "./daily-monument/req";

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
];

const app = express();
const port = 4200;
app.use(bodyParser.json());

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
