import { proverbRequest } from "./proverbe-chinois/req";

const apps = [
  {
    name: "Proverbes Chinois",
    description:
      "Une collection de proverbes chinois avec leurs traductions françaises.",
    route: "proverbes-chinois",
    request: proverbRequest,
  },
];

// create a simple express server to handle requests
import express from "express";
import bodyParser from "body-parser";
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
  console.log("Received request:", req.query);
  const result = request(req.query);
  return res.json(result);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
