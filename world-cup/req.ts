import "dotenv/config";
import fs from "fs/promises";
import path from "path";

const API_KEY = process.env.FOOTBALL_DATA_API_KEY || "";
const CACHE_FILE = path.join(process.cwd(), "world-cup.json");
const CACHE_TTL = 10 * 60 * 1000;

const TLA_TO_FLAG: Record<string, string> = {
  GER: "de", PAR: "py", FRA: "fr", SWE: "se", RSA: "za", CAN: "ca",
  NED: "nl", MAR: "ma", POR: "pt", CRO: "hr", ESP: "es", AUT: "at",
  USA: "us", BIH: "ba", BEL: "be", SEN: "sn", BRA: "br", JPN: "jp",
  CIV: "ci", NOR: "no", MEX: "mx", ECU: "ec", ENG: "gb-eng", COD: "cd",
  ARG: "ar", CPV: "cv", AUS: "au", EGY: "eg", SUI: "ch", DZA: "dz", ALG: "dz",
  COL: "co", GHA: "gh", KOR: "kr", CZE: "cz", SCO: "gb-sct", HAI: "ht",
  TUR: "tr", QAT: "qa", WAL: "gb-wls", NIR: "gb-nir", IRL: "ie",
};

interface Team { tla: string; name: string; flag: string }
interface Match {
  home: Team | null;
  away: Team | null;
  scoreHome: number | null;
  scoreAway: number | null;
  homeLost: boolean;
  awayLost: boolean;
  status: string;
}

function toTeam(t: any): Team | null {
  if (!t?.tla || t.tla === "Unknown Team" || t.tla === "TBD") return null;
  return {
    tla: t.tla,
    name: t.name ?? t.shortName ?? t.tla,
    flag: TLA_TO_FLAG[t.tla] ?? t.tla.slice(0, 2).toLowerCase(),
  };
}

function scoreValue(score: any, side: "home" | "away"): number | null {
  return typeof score?.[side] === "number" ? score[side] : null;
}

// For penalty shootouts, football-data.org's score.fullTime includes the
// shootout goals (e.g. regularTime 1-1, penalties 3-4 -> fullTime 4-5).
// score.regularTime + score.extraTime gives the actual match score before
// the shootout; fall back to fullTime - score.penalties if regularTime is
// ever missing.
function displayScore(m: any, side: "home" | "away"): number | null {
  const score = m.score;
  const fullTime = scoreValue(score?.fullTime, side);

  if (score?.duration === "PENALTY_SHOOTOUT") {
    const regularTime = scoreValue(score?.regularTime, side);
    const extraTime = scoreValue(score?.extraTime, side) ?? 0;
    if (regularTime !== null) return regularTime + extraTime;

    const penalties = scoreValue(score?.penalties, side);
    if (fullTime !== null && penalties !== null) return fullTime - penalties;
  }

  return fullTime;
}

function sideLost(m: any, side: "home" | "away"): boolean {
  if (m.status !== "FINISHED" || !m.score?.winner) return false;

  const winningSide = side === "home" ? "HOME_TEAM" : "AWAY_TEAM";
  const losingSide = side === "home" ? "AWAY_TEAM" : "HOME_TEAM";

  if (m.score.winner === winningSide) return false;
  return m.score.winner === losingSide;
}

function toMatch(m: any): Match {
  return {
    home: toTeam(m.homeTeam),
    away: toTeam(m.awayTeam),
    scoreHome: displayScore(m, "home"),
    scoreAway: displayScore(m, "away"),
    homeLost: sideLost(m, "home"),
    awayLost: sideLost(m, "away"),
    status: m.status ?? "SCHEDULED",
  };
}

async function fetchStage(stage: string): Promise<Match[]> {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/WC/matches?stage=${stage}`,
    { headers: { "X-Auth-Token": API_KEY } }
  );
  if (!res.ok) throw new Error(`API ${res.status} for stage ${stage}`);
  const json: any = await res.json();
  return (json.matches ?? []).map(toMatch);
}

const BRACKET_LEFT: [string, string][] = [
  ["GER", "PAR"], ["FRA", "SWE"], ["RSA", "CAN"], ["NED", "MAR"],
  ["POR", "CRO"], ["ESP", "AUT"], ["USA", "BIH"], ["BEL", "SEN"],
];
const BRACKET_RIGHT: [string, string][] = [
  ["BRA", "JPN"], ["CIV", "NOR"], ["MEX", "ECU"], ["ENG", "COD"],
  ["ARG", "CPV"], ["AUS", "EGY"], ["SUI", "ALG"], ["COL", "GHA"],
];

function hasTeam(match: Match, tlas: string[]): boolean {
  return !!(match.home?.tla && tlas.includes(match.home.tla)) ||
         !!(match.away?.tla && tlas.includes(match.away.tla));
}

function sortR32(matches: Match[], draw: [string, string][]): (Match | null)[] {
  return draw.map(([t1, t2]) => matches.find(m => hasTeam(m, [t1, t2])) ?? null);
}

function sortRound(matches: Match[], prevRound: (Match | null)[]): (Match | null)[] {
  const slots = prevRound.length / 2;
  const result: (Match | null)[] = [];
  for (let i = 0; i < slots; i++) {
    const a = prevRound[i * 2];
    const b = prevRound[i * 2 + 1];
    const candidates = [a?.home?.tla, a?.away?.tla, b?.home?.tla, b?.away?.tla].filter(Boolean) as string[];
    result.push(matches.find(m => hasTeam(m, candidates)) ?? null);
  }
  return result;
}

const EMPTY: Match = { home: null, away: null, scoreHome: null, scoreAway: null, homeLost: false, awayLost: false, status: "SCHEDULED" };
const fill = (arr: (Match | null)[]): Match[] => arr.map(m => m ?? EMPTY);

function buildData(r32: Match[], r16: Match[], qf: Match[], sf: Match[], finalArr: Match[]) {
  const leftR32  = sortR32(r32, BRACKET_LEFT);
  const rightR32 = sortR32(r32, BRACKET_RIGHT);
  const leftR16  = sortRound(r16, leftR32);
  const rightR16 = sortRound(r16, rightR32);
  const leftQF   = sortRound(qf, leftR16);
  const rightQF  = sortRound(qf, rightR16);
  const leftSF   = sortRound(sf, leftQF);
  const rightSF  = sortRound(sf, rightQF);
  return {
    leftR32:    fill(leftR32),
    leftR16:    fill(leftR16),
    leftQF:     fill(leftQF),
    leftSF:     fill(leftSF),
    finalMatch: finalArr[0] ?? EMPTY,
    rightSF:    fill(rightSF),
    rightQF:    fill(rightQF),
    rightR16:   fill(rightR16),
    rightR32:   fill(rightR32),
  };
}

export async function worldCupRequest(_query: unknown, _body: unknown = null) {
  try {
    const cached = JSON.parse(await fs.readFile(CACHE_FILE, "utf-8"));
    if (Date.now() - cached.fetchedAt < CACHE_TTL && cached.leftR32) {
      const { fetchedAt, ...rest } = cached;
      return rest;
    }
  } catch { /* no cache or invalid JSON */ }

  if (!API_KEY) return { error: "Missing FOOTBALL_DATA_API_KEY in .env" };

  try {
    const [r32, r16, qf, sf, finalArr] = await Promise.all([
      fetchStage("LAST_32"),
      fetchStage("LAST_16"),
      fetchStage("QUARTER_FINALS"),
      fetchStage("SEMI_FINALS"),
      fetchStage("FINAL"),
    ]);

    const bracketData = buildData(r32, r16, qf, sf, finalArr);
    const lastUpdated = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const data = { ...bracketData, lastUpdated, fetchedAt: Date.now() };
    await fs.writeFile(CACHE_FILE, JSON.stringify(data));
    return { ...bracketData, lastUpdated };
  } catch (e: any) {
    return { error: String(e.message) };
  }
}
