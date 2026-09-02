import "dotenv/config";
import { getLogger } from "./logger";
import { sendTelegramMessage, escapeTelegramHtml as escapeHtml } from "./telegram";

const log = getLogger("health-check");

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

async function sendTelegramAlert(failures: CheckResult[], total: number) {
  const lines = [
    `🩺 <b>TRMNL API Health Check</b>`,
    `<b>${failures.length}/${total}</b> API${failures.length > 1 ? "s" : ""} en erreur`,
    "",
    ...failures.map(
      (f) =>
        `🔴 <b>${escapeHtml(f.name)}</b>\n<pre>${escapeHtml((f.error || "Unknown error").slice(0, 500))}</pre>`
    ),
  ];
  await sendTelegramMessage(lines.join("\n"));
}
