// Réessaie un tirage quotidien qui échoue, puis alerte par Telegram si tous
// les essais échouent — voir daily-animal/daily-fetch.ts, daily-monument/...
// et daily-natural-wonder/... pour les appelants. Incident déclencheur :
// le 02/09/2026, un "socket hang up" ponctuel sur l'API iNaturalist a fait
// échouer le tirage du jour sans qu'aucune alerte ne soit envoyée nulle part.
import { getLogger } from "./logger";
import { sendTelegramMessage, escapeTelegramHtml as escapeHtml } from "./telegram";

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retente `fetchOne` jusqu'à MAX_ATTEMPTS fois avant d'abandonner.
 *
 * `fetchOne` DOIT lancer une exception pour signaler un échec réel (réseau,
 * API...). Un "tirage à refaire" attendu et normal (ex. l'échantillonnage
 * aléatoire d'Animal of the Day, qui redemande volontairement une photo tant
 * que la qualité n'est pas suffisante) doit être géré À L'INTÉRIEUR de
 * `fetchOne` — ce compteur ne doit suivre que les vrais échecs, jamais les
 * re-tirages volontaires, sous peine de fausses alertes.
 *
 * N'écrase jamais la donnée existante en cas d'échec total : l'appelant garde
 * son fichier précédent (voir daily-fetch.ts, qui ne réécrit rien si le
 * retour est `null`). L'alerte Telegram n'est envoyée qu'une fois TOUTES les
 * tentatives épuisées — pas à la première — pour ne pas spammer sur un aléa
 * réseau ponctuel qui se corrige tout seul au deuxième essai.
 */
export async function retryWithAlert<T>(
  label: string,
  fetchOne: () => Promise<T>
): Promise<T | null> {
  const log = getLogger(label);
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchOne();
    } catch (err: any) {
      lastError = err;
      log.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err?.message ?? err}`);
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }

  log.error(`Giving up after ${MAX_ATTEMPTS} attempts.`);
  await sendTelegramMessage(
    `🔴 <b>${escapeHtml(label)}</b> daily draw failed after ${MAX_ATTEMPTS} attempts.\n` +
      `<pre>${escapeHtml(String(lastError?.message ?? lastError ?? "Unknown error")).slice(0, 500)}</pre>\n` +
      `The previous data is still being served.`
  );
  return null;
}
