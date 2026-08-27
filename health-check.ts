import "dotenv/config";
import { getLogger } from "./logger";

const log = getLogger("health-check");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TIMEOUT_MS = 30000;

export type HealthCheck = {
  name: string;
  run: () => Promise<any> | any;
  // retourne une description du problème, ou null si le résultat est valide
  validate?: (result: any) => string | null;
};

export type CheckResult = {
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
};

function withTimeout(promise: Promise<any>): Promise<any> {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
    ),
  ]);
}

function defaultValidate(result: any): string | null {
  if (result === null || result === undefined) return "Empty response";
  if (typeof result !== "object") return `Unexpected response type: ${typeof result}`;
  if (result.error) return `API returned an error: ${result.error}`;
  return null;
}

export async function runHealthChecks(
  checks: HealthCheck[],
  { notify = true } = {}
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    const start = Date.now();
    try {
      const result = await withTimeout(Promise.resolve(check.run()));
      const problem = defaultValidate(result) ?? check.validate?.(result) ?? null;
      results.push({
        name: check.name,
        ok: !problem,
        ms: Date.now() - start,
        ...(problem ? { error: problem } : {}),
      });
    } catch (e: any) {
      results.push({
        name: check.name,
        ok: false,
        ms: Date.now() - start,
        error: e?.message || String(e),
      });
    }
  }

  const failures = results.filter((r) => !r.ok);
  const okCount = results.length - failures.length;
  const summary =
    `Health check: ${okCount}/${results.length} OK` +
    (failures.length ? ` — KO: ${failures.map((f) => f.name).join(", ")}` : "");
  if (failures.length > 0) log.warn(summary);
  else log.success(summary);

  if (failures.length > 0 && notify) {
    await sendTelegramAlert(failures, results.length);
  }
  return results;
}

// Échappe les caractères spéciaux du mode HTML de Telegram pour éviter un
// message tronqué ou une erreur 400 si un nom d'app ou un message d'erreur
// contient <, > ou &.
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegramAlert(failures: CheckResult[], total: number) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log.warn(
      "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID non défini(s) — alerte Telegram ignorée"
    );
    return;
  }
  const lines = [
    `🩺 <b>TRMNL API Health Check</b>`,
    `<b>${failures.length}/${total}</b> API${failures.length > 1 ? "s" : ""} en erreur`,
    "",
    ...failures.map(
      (f) =>
        `🔴 <b>${escapeHtml(f.name)}</b>\n<pre>${escapeHtml((f.error || "Unknown error").slice(0, 500))}</pre>`
    ),
  ];
  const text = lines.join("\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    if (!res.ok) {
      log.error(`Telegram alert failed: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    log.error("Telegram alert failed:", e);
  }
}
