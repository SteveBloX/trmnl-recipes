import fs from "fs/promises";
import { chromium } from "playwright";
import { DateTime } from "luxon";
import { dataPath } from "../data-dir";

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const DRIVERS_CACHE_FILE = dataPath("motogp-drivers.json");
const TEAMS_CACHE_FILE = dataPath("motogp-teams.json");
const SCHEDULE_CACHE_FILE = dataPath("motogp-schedule.json");

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

// Codes ISO 3166-1 alpha-3 -> alpha-2 des pays susceptibles d'accueillir un GP.
// Le template utilise le code alpha-2 avec Intl.DisplayNames pour afficher le
// nom du pays dans la langue de l'utilisateur, quelle qu'elle soit.
const ISO3_TO_ISO2: Record<string, string> = {
  arg: "AR", are: "AE", aus: "AU", aut: "AT", bra: "BR", che: "CH",
  cze: "CZ", deu: "DE", esp: "ES", fin: "FI", fra: "FR", gbr: "GB",
  hun: "HU", idn: "ID", ind: "IN", ita: "IT", jpn: "JP", kaz: "KZ",
  mex: "MX", mys: "MY", nld: "NL", prt: "PT", qat: "QA", smr: "SM",
  tha: "TH", tur: "TR", usa: "US", zaf: "ZA",
};

function countryCodeFromFlag(flagUrl: string | null | undefined) {
  const iso3 = flagUrl?.match(/\/([a-z]{3})\.svg$/)?.[1];
  return iso3 ? (ISO3_TO_ISO2[iso3] ?? null) : null;
}

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

// Le site affiche les horaires dans le fuseau du navigateur : on force donc
// le contexte Playwright en UTC pour savoir exactement dans quel fuseau
// interpréter les heures scrapées.
async function scrapeSchedule() {
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
      const timings = Array.from(
        container.querySelectorAll(".calendar-listing__timings-row"),
      ).map((row) => {
        // time is like "Fri \ 10:45"
        const time =
          row
            .querySelector(".calendar-listing__timings-session-start")
            ?.textContent?.trim()
            .split(" / ") ?? [];
        const day = time[0];
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
      throw new Error(
        "date_range introuvable, impossible de dater les sessions",
      );
    }
    const { year, month, startDay, endDay } = parseDateRange(
      schedule.date_range,
    );

    const timings = schedule.timings.map((timing) => {
      const day = resolveDayOfMonth(year, month, startDay, endDay, timing.day);
      const [hour, minute] = (timing.hour ?? "").split(":").map(Number);
      const utc = DateTime.utc(year, month, day, hour, minute).toISO();
      return { ...timing, utc };
    });

    return {
      ...schedule,
      country_code: countryCodeFromFlag(schedule.country_flag),
      timings,
    };
  } finally {
    await browser.close();
  }
}

// Le cache contient les données brutes (anglais) partagées entre tous les
// utilisateurs ; la localisation est appliquée à chaque requête selon ?locale=.
function localizeSchedule(schedule: any, locale: string) {
  let location_localized = schedule.location ?? null;
  if (schedule.country_code) {
    try {
      const name = new Intl.DisplayNames([locale], { type: "region" }).of(
        schedule.country_code,
      );
      if (name) location_localized = name.toLocaleUpperCase(locale);
    } catch {
      // locale inconnue : on garde le nom anglais scrapé
    }
  }

  let relative_start: string | null = null;
  const firstUtc = schedule.timings?.[0]?.utc;
  if (firstUtc) {
    const diffMs = new Date(firstUtc).getTime() - Date.now();
    // Granularité adaptée : minutes < 1h, heures < 24h, jours au-delà.
    // Week-end déjà commencé -> "aujourd'hui".
    let value: number;
    let unit: Intl.RelativeTimeFormatUnit;
    if (diffMs <= 0) {
      value = 0;
      unit = "day";
    } else if (diffMs < 3_600_000) {
      value = Math.max(1, Math.round(diffMs / 60_000));
      unit = "minute";
    } else if (diffMs < 86_400_000) {
      value = Math.round(diffMs / 3_600_000);
      unit = "hour";
    } else {
      value = Math.floor(diffMs / 86_400_000);
      unit = "day";
    }
    try {
      relative_start = new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
      }).format(value, unit);
    } catch {
      relative_start = value === 0 ? "today" : `in ${value} ${unit}s`;
    }
  }

  return { ...schedule, location_localized, relative_start };
}

export async function scheduleRequest(query: unknown, _body: unknown = null) {
  const rawLocale = (query as Record<string, unknown> | null)?.locale;
  const locale = typeof rawLocale === "string" && rawLocale ? rawLocale : "en";

  const cached = await readCache(SCHEDULE_CACHE_FILE);
  if (cached) return localizeSchedule(cached, locale);

  try {
    const schedule = await scrapeSchedule();
    await writeCache(SCHEDULE_CACHE_FILE, schedule);
    return localizeSchedule(schedule, locale);
  } catch (e: any) {
    return { error: String(e.message) };
  }
}
