// Envoi Telegram générique — extrait de health-check.ts pour être réutilisé
// par les tirages quotidiens (voir retry-with-alert.ts) sans dupliquer la
// logique d'appel API.
import "dotenv/config";
import { getLogger } from "./logger";

const log = getLogger("telegram");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// Échappe les caractères spéciaux du mode HTML de Telegram pour éviter un
// message tronqué ou une erreur 400 si un nom ou un message d'erreur
// contient <, > ou &.
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Envoie un message Telegram brut (HTML). Ne fait rien — silencieusement,
 * juste un log — si les identifiants ne sont pas configurés, pour que ça
 * reste toujours sûr à appeler.
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log.warn("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID non défini(s) — message Telegram ignoré");
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      log.error(`Telegram message failed: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    log.error("Telegram message failed:", e);
  }
}
