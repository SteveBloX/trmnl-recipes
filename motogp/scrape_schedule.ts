import { chromium } from "playwright";
import fs from "fs";
import { DateTime } from "luxon";

const MONTHS: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

// Le site affiche les horaires dans le fuseau du navigateur : on force donc
// le contexte Playwright en UTC pour savoir exactement dans quel fuseau
// interpréter les heures scrapées.

function parseDateRange(dateRange: string) {
  const monthMatch = dateRange.match(/[A-Za-z]{3,}/);
  const yearMatch = dateRange.match(/\b(20\d{2})\b/);
  const dayMatches = [...dateRange.matchAll(/\b(\d{1,2})\b/g)].map((m) =>
    parseInt(m[1], 10),
  );

  if (!monthMatch || dayMatches.length === 0) {
    throw new Error(`Impossible de parser date_range: "${dateRange}"`);
  }

  const month = MONTHS[monthMatch[0].slice(0, 3)];
  if (!month) {
    throw new Error(`Mois inconnu dans date_range: "${dateRange}"`);
  }

  return {
    month,
    year: yearMatch ? parseInt(yearMatch[1], 10) : DateTime.utc().year,
    startDay: Math.min(...dayMatches),
    endDay: Math.max(...dayMatches),
  };
}

function resolveDayOfMonth(
  year: number,
  month: number,
  startDay: number,
  endDay: number,
  weekdayLong: string,
) {
  for (let day = startDay; day <= endDay; day++) {
    if (DateTime.utc(year, month, day).weekdayLong === weekdayLong) {
      return day;
    }
  }
  return startDay;
}

async function scrapeDriverStandings() {
  // Lance le navigateur en mode headless
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ timezoneId: "UTC" });
  const page = await context.newPage();

  try {
    await page.goto(`https://www.motogp.com/en/calendar?view=list`, {
      waitUntil: "networkidle",
    });

    const acceptCookiesButton = page.locator("#onetrust-accept-btn-handler");
    if (await acceptCookiesButton.isVisible().catch(() => false)) {
      await acceptCookiesButton.click();
    }

    await page.getByRole("button", { name: "List View" }).click();

    const scheduleTitleCandidates = page.getByText("MotoGP™ Schedule");
    const count = await scheduleTitleCandidates.count();

    let eventInfoContainer = null;
    for (let i = 0; i < count; i++) {
      const candidate = scheduleTitleCandidates.nth(i);
      if (!(await candidate.isVisible())) continue;

      const container = candidate
        .locator(
          "xpath=ancestor::*[contains(@class, 'calendar-listing__event')]",
        )
        .first();

      if ((await container.count()) > 0) {
        eventInfoContainer = container;
        break;
      }
    }

    if (!eventInfoContainer) {
      throw new Error(
        "Aucun élément 'MotoGP™ Schedule' avec conteneur 'calendar-listing__event-info-container' trouvé",
      );
    }

    const containerHandle = await eventInfoContainer.elementHandle();
    if (!containerHandle) {
      throw new Error("Impossible de récupérer l'élément DOM du conteneur");
    }

    const schedule = await page.evaluate((container: Element) => {
      const track_img = container
        .querySelector(".calendar-listing__track-layout img")
        ?.getAttribute("src");
      const date_range = container
        .querySelector(".calendar-listing__event-date-container")
        ?.textContent?.trim();
      const country_flag = container
        .querySelector(".calendar-listing__event-info img")
        ?.getAttribute("src");
      const event_name = container
        .querySelector(".calendar-listing__event-name")
        ?.textContent?.trim();
      const location = container
        .querySelector(".calendar-listing__event-full-name")
        ?.textContent?.trim();
      const number = container
        .querySelector(".calendar-listing__event-status-type")
        ?.textContent?.trim();
      const timings = Array.from(
        container.querySelectorAll(".calendar-listing__timings-row"),
      ).map((row) => {
        // time is like "Fri \ 10:45"
        const time =
          row
            .querySelector(".calendar-listing__timings-session-start")
            ?.textContent?.trim()
            .split(" / ") ?? [];
        // parse time
        const day = time[0];
        // pretty print day
        const prettyDay =
          day === "Mon"
            ? "Monday"
            : day === "Tue"
              ? "Tuesday"
              : day === "Wed"
                ? "Wednesday"
                : day === "Thu"
                  ? "Thursday"
                  : day === "Fri"
                    ? "Friday"
                    : day === "Sat"
                      ? "Saturday"
                      : "Sunday";
        const hour = time[1];
        const name = row
          .querySelector(".calendar-listing__session-name")
          ?.textContent?.trim();
        return {
          day: prettyDay,
          hour,
          name,
        };
      });
      return {
        track_img,
        date_range,
        country_flag,
        event_name,
        location,
        timings,
      };
    }, containerHandle);

    if (!schedule.date_range) {
      throw new Error("date_range introuvable, impossible de dater les sessions");
    }
    const { year, month, startDay, endDay } = parseDateRange(
      schedule.date_range,
    );

    const timingsWithUtc = schedule.timings.map((timing) => {
      const day = resolveDayOfMonth(year, month, startDay, endDay, timing.day);
      const [hour, minute] = timing.hour.split(":").map(Number);
      const utc = DateTime.utc(year, month, day, hour, minute).toISO();
      return { ...timing, utc };
    });

    const scheduleWithUtc = { ...schedule, timings: timingsWithUtc };

    fs.writeFileSync(
      `./motogp-schedule.json`,
      JSON.stringify(scheduleWithUtc, null, 2),
      "utf-8",
    );
    console.log(scheduleWithUtc);
  } catch (error) {
    console.error("error:", error);
  } finally {
    await browser.close();
  }
}

scrapeDriverStandings();
