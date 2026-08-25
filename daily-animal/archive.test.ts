// Tests pour la logique d'historique — "actif le plus longtemps par jour"
// est facile à se tromper (vérifié : je m'y suis moi-même trompé une fois en
// calculant un scénario de test à la main dans la session qui a écrit
// archive.ts). Utilise le test runner intégré de Node (node:test), aucune
// dépendance supplémentaire.
//
// DATA_DIR est redirigé vers un dossier temporaire AVANT que archive.ts (et
// data-dir.ts, qui fige DATA_DIR à son premier import) ne soit chargé — d'où
// l'import dynamique dans `before`, plutôt qu'un `import` statique en haut
// du fichier qui s'exécuterait trop tôt.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let getDailyHistory: typeof import("./archive").getDailyHistory;
let getLatestForToday: typeof import("./archive").getLatestForToday;
let tmpDir: string;
let archivePath: string;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "animal-archive-test-"));
  process.env.DATA_DIR = tmpDir;
  archivePath = path.join(tmpDir, "animal-archive.json");
  ({ getDailyHistory, getLatestForToday } = await import("./archive"));
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function seed(data: Record<string, any>) {
  return fs.writeFile(archivePath, JSON.stringify(data));
}

test("keeps the draw that stayed active longest when a restart caused two draws the same day", async () => {
  await seed({
    morning: {
      slug: "morning",
      scientificName: "Aaa aaa",
      name: { en: "Morning Pick" },
      createdAt: "2026-01-01T00:00:00.000Z", // active ~23h
    },
    restart: {
      slug: "restart",
      scientificName: "Bbb bbb",
      name: { en: "Restart Pick" },
      createdAt: "2026-01-01T23:00:00.000Z", // active only ~1h
    },
    dayTwo: {
      slug: "daytwo",
      scientificName: "Ccc ccc",
      name: { en: "Day Two" },
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  });

  const history = await getDailyHistory();
  const day1 = history.find((h) => h.date === "2026-01-01");

  assert.equal(day1?.entry.name.en, "Morning Pick");
});

test("sorts history with the most recent day first", async () => {
  await seed({
    a: { slug: "a", scientificName: "A", name: { en: "A" }, createdAt: "2026-01-01T00:00:00.000Z" },
    b: { slug: "b", scientificName: "B", name: { en: "B" }, createdAt: "2026-01-03T00:00:00.000Z" },
    c: { slug: "c", scientificName: "C", name: { en: "C" }, createdAt: "2026-01-02T00:00:00.000Z" },
  });

  const history = await getDailyHistory();

  assert.deepEqual(
    history.map((h) => h.date),
    ["2026-01-03", "2026-01-02", "2026-01-01"]
  );
});

test("getDailyHistory returns an empty array when the archive file doesn't exist", async () => {
  await fs.rm(archivePath, { force: true });

  const history = await getDailyHistory();

  assert.deepEqual(history, []);
});

test("getLatestForToday returns null when nothing was drawn today", async () => {
  await seed({
    old: { slug: "old", scientificName: "Old", name: { en: "Old" }, createdAt: "2020-01-01T00:00:00.000Z" },
  });

  const result = await getLatestForToday();

  assert.equal(result, null);
});

test("getLatestForToday returns the most recent of today's draws, not the first", async () => {
  const today = new Date().toISOString().slice(0, 10);
  await seed({
    first: { slug: "first", scientificName: "First", name: { en: "First" }, createdAt: `${today}T01:00:00.000Z` },
    second: { slug: "second", scientificName: "Second", name: { en: "Second" }, createdAt: `${today}T10:00:00.000Z` },
  });

  const result = await getLatestForToday();

  assert.equal(result?.slug, "second");
});
