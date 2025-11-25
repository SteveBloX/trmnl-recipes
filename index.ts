import { proverbRequest } from "./chinese-proverbs/req";

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
];

// create a simple express server to handle requests
import express from "express";
import bodyParser from "body-parser";
import { statsRequest } from "./fortnite-stats/req";
const app = express();
const port = 4200;
app.use(bodyParser.json());

app.get("/api/:appName", (req, res) => {
  const appName = req.params.appName;
  const appConfig = apps.find((a) => a.route === appName);
  if (!appConfig) {
    return res.status(404).json({ error: "App not found" });
  }
  const { request } = appConfig;
  const result = request(req.query, req.body);
  return res.json(result);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
