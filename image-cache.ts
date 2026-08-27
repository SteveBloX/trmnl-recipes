// Cache d'images distantes protégées par Cloudflare (whc.unesco.org bloque
// tout client non-navigateur derrière un challenge JS — voir l'incident du
// 26/08/2026 sur Natural Wonder of the Day, un rendu TRMNL qui avait
// pourtant marché la veille). On télécharge l'image UNE fois au moment du
// tirage quotidien (via un vrai navigateur headless, seul capable de
// résoudre le challenge), on la stocke sur le volume Docker, et on la sert
// depuis notre propre domaine — le moteur de rendu TRMNL ne parle alors
// plus jamais directement à la source bloquée.
import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import { dataPath } from "./data-dir";
import { SITE_ORIGIN } from "./web-shell";

const KNOWN_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function imagesDir(subdir: string): string {
  return dataPath("images", subdir);
}

async function findCachedFile(subdir: string, id: string | number): Promise<string | null> {
  for (const ext of KNOWN_EXTENSIONS) {
    const p = path.join(imagesDir(subdir), `${id}.${ext}`);
    try {
      await fs.access(p);
      return p;
    } catch {
      // pas cet extension-là, on essaie la suivante
    }
  }
  return null;
}

function publicUrl(subdir: string, id: string | number, ext: string): string {
  return `${SITE_ORIGIN}/images/${subdir}/${id}.${ext}`;
}

// Un vrai navigateur headless, seul capable d'exécuter le challenge JS de
// Cloudflare. Une fois la page chargée (challenge résolu, cookie de
// clearance posé), on refait la requête de l'image *depuis la page* pour
// récupérer ses octets bruts avec le bon Content-Type.
async function downloadViaBrowser(
  sourceUrl: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  // Un Playwright headless "nu" est lui-même détecté et bloqué par le
  // challenge anti-bot de Cloudflare (vérifié : bloqué même après 6s
  // d'attente, quel que soit waitUntil). Un User-Agent de vrai navigateur +
  // le masquage de navigator.webdriver suffisent à le faire passer —
  // mesuré : image/webp récupérée du premier coup avec ces deux réglages.
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    const page = await context.newPage();
    await page.goto(sourceUrl, { waitUntil: "load", timeout: 30_000 });

    const result = await page.evaluate(async (url: string) => {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      return {
        contentType: res.headers.get("content-type") || "",
        bytes: Array.from(new Uint8Array(buf)),
      };
    }, sourceUrl);

    if (!result.contentType.startsWith("image/")) {
      // Toujours pas une image (challenge non résolu, page d'erreur...) —
      // un échec propre, pas une exception, pour que l'appelant retombe sur
      // l'URL d'origine sans planter le tirage du jour.
      return null;
    }

    return { buffer: Buffer.from(result.bytes), contentType: result.contentType };
  } finally {
    await browser.close();
  }
}

/**
 * Retourne l'URL publique (sur notre domaine) d'une image mise en cache,
 * l'y téléchargeant d'abord si besoin. `id` doit être un identifiant stable
 * de la ressource elle-même (ex. l'id_no UNESCO du site), pas du tirage —
 * pour que deux tirages du même site réutilisent la même image en cache
 * plutôt que de retélécharger à chaque fois.
 *
 * En cas d'échec (source injoignable, toujours bloquée...), retombe sur
 * `sourceUrl` telle quelle plutôt que de faire échouer tout le tirage —
 * même philosophie que le reste du pipeline (mieux vaut une image parfois
 * cassée qu'un tirage entier perdu).
 */
export async function cacheRemoteImage(
  subdir: string,
  id: string | number,
  sourceUrl: string
): Promise<string> {
  const existing = await findCachedFile(subdir, id);
  if (existing) {
    const ext = existing.split(".").pop()!;
    return publicUrl(subdir, id, ext);
  }

  try {
    const downloaded = await downloadViaBrowser(sourceUrl);
    if (!downloaded) {
      console.warn(`Image cache: '${sourceUrl}' didn't resolve to an image — using it directly.`);
      return sourceUrl;
    }

    const ext = CONTENT_TYPE_EXTENSIONS[downloaded.contentType] || "jpg";
    const dir = imagesDir(subdir);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${id}.${ext}`), downloaded.buffer);

    return publicUrl(subdir, id, ext);
  } catch (error: any) {
    console.warn(`Image cache: failed to cache '${sourceUrl}':`, error.message);
    return sourceUrl;
  }
}
