import { chromium } from "playwright";
import fs from "fs";
import { getLogger } from "../logger";

const log = getLogger("motogp:scrape");

async function scrapeDriverStandings() {
  // Lance le navigateur en mode headless
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const year = new Date().getFullYear();
    await page.goto(
      `https://www.motogp.com/en/world-standing/${year}/motogp/championship-standings`,
      { waitUntil: "networkidle" },
    );

    const standings = await page.evaluate(() => {
      // table must not have class "u-hide" and must have class "standings-table" and is a div
      const table = document.querySelector("div.standings-table:not(.u-hide)");
      if (!table) return [];
      const rows = table.querySelectorAll(".standings-table__body-row");
      const drivers = [];
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
          // last 3 pos (may be "-")
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
    fs.writeFileSync(
      `./motogp-s.json`,
      JSON.stringify(standings, null, 2),
      "utf-8",
    );
    log.success(`Scraped ${standings.length} driver standings.`);
  } catch (error) {
    log.error("Failed to scrape driver standings:", error);
  } finally {
    await browser.close();
  }
}

scrapeDriverStandings();
