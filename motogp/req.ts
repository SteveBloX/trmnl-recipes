import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const DRIVERS_CACHE_FILE = path.join(process.cwd(), "motogp-drivers.json");
const TEAMS_CACHE_FILE = path.join(process.cwd(), "motogp-teams.json");
const PLANNING_CACHE_FILE = path.join(process.cwd(), "motogp-planning.json");

async function readCache(file: string): Promise<any | null> {
  try {
    const cached = JSON.parse(await fs.readFile(file, "utf-8"));
    if (Date.now() - cached.fetchedAt < CACHE_TTL) {
      const { fetchedAt, ...rest } = cached;
      return rest;
    }
  } catch {
    // no cache yet or invalid JSON
  }
  return null;
}

async function writeCache(file: string, data: object) {
  await fs.writeFile(file, JSON.stringify({ ...data, fetchedAt: Date.now() }));
}

async function scrapeDriverStandings(year: number) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(
      `https://www.motogp.com/en/world-standing/${year}/motogp/championship-standings`,
      { waitUntil: "networkidle" },
    );

    return await page.evaluate(() => {
      const table = document.querySelector("div.standings-table:not(.u-hide)");
      if (!table) return [];
      const rows = table.querySelectorAll(".standings-table__body-row");
      const drivers: any[] = [];
      rows.forEach((row) => {
        const info = row.querySelector(
          ".standings-table__body-cell-scrolling-container",
        );
        const pos = info
          ?.querySelector(".standings-table__body-cell--pos")
          ?.textContent?.trim();
        const rider = {
          number: info
            ?.querySelector(".standings-table__body-cell--number")
            ?.textContent?.trim(),
          name: info
            ?.querySelector(".standings-table__body-cell--full-name")
            ?.textContent?.trim(),
          flag: info
            ?.querySelector(".standings-table__body-cell--flag img")
            ?.getAttribute("src"),
          image: info?.querySelector(".picture img")?.getAttribute("src"),
        };
        const team = row
          .querySelector(".standings-table__body-cell--team")
          ?.textContent?.trim();
        const points = row
          .querySelector(".standings-table__body-cell--points")
          ?.textContent?.trim();
        const gap = row
          .querySelector(".standings-table__body-cell--gap")
          ?.textContent?.trim();
        const race_wins = row
          .querySelector(".standings-table__body-cell--race-wins")
          ?.textContent?.trim();
        const podiums = row
          .querySelector(".standings-table__body-cell--podiums")
          ?.textContent?.trim();
        const last_pos = Array.from(
          row.querySelectorAll(
            ".standings-table__body-cell--last-pos .standings-table__body-cell-rider-race-pos",
          ),
        ).map((el) => el.textContent?.trim());
        if (race_wins === undefined) return;
        drivers.push({
          ...rider,
          pos,
          team,
          points,
          gap,
          race_wins,
          podiums,
          last_pos,
        });
      });
      return drivers;
    });
  } finally {
    await browser.close();
  }
}

export async function driverStandingsRequest(
  _query: unknown,
  _body: unknown = null,
) {
  const year = new Date().getFullYear();
  const cached = await readCache(DRIVERS_CACHE_FILE);
  if (cached) return cached;

  try {
    const standings = await scrapeDriverStandings(year);
    const data = { season: year, standings };
    await writeCache(DRIVERS_CACHE_FILE, data);
    return data;
  } catch (e: any) {
    return { error: String(e.message) };
  }
}

// TODO: scrape https://www.motogp.com/en/world-standing/<year>/motogp/team-standings
export async function teamStandingsRequest(
  _query: unknown,
  _body: unknown = null,
) {
  const cached = await readCache(TEAMS_CACHE_FILE);
  if (cached) return cached;
  return { error: "Team standings are not implemented yet" };
}

// TODO: scrape https://www.motogp.com/en/calendar for the race calendar
export async function planningRequest(_query: unknown, _body: unknown = null) {
  const cached = await readCache(PLANNING_CACHE_FILE);
  if (cached) return cached;
  return { error: "Race planning is not implemented yet" };
}
