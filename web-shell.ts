// Coquille HTML partagée par toutes les pages servies par ce backend (les
// fiches animal, l'annuaire de plugins et ses fiches individuelles) —
// centralisée pour que le style visuel, le script client Umami, les balises
// Open Graph et le favicon restent cohérents au lieu d'être dupliqués page
// par page.
export const SITE_ORIGIN = "https://trmnl.bloax.xyz";

export function escapeHtml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Les images de ce backend sont parfois déjà absolues (photos iNaturalist),
// parfois relatives (captures d'écran servies depuis /screenshots) — les
// crawlers qui lisent og:image n'acceptent que des URLs absolues.
export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_ORIGIN}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export type PageShellOptions = {
  narrow?: boolean;
  description?: string;
  image?: string;
  path?: string; // pour og:url / le lien canonique, ex. "/plugins/astrobin"
};

// Emoji favicon en SVG inline : pas de fichier binaire à gérer, pas de
// requête réseau supplémentaire.
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Ctext y=%27.9em%27 font-size=%2790%27%3E%F0%9F%94%8C%3C/text%3E%3C/svg%3E";

export function pageShell(
  title: string,
  body: string,
  { narrow = true, description, image, path }: PageShellOptions = {}
): string {
  const desc =
    description ||
    "A handful of small plugins I built for the TRMNL e-ink display.";
  const ogImage = image ? toAbsoluteUrl(image) : null;
  const ogUrl = path ? toAbsoluteUrl(path) : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<script defer src="https://nx.bloax.xyz/lens.js" data-website-id="4dc22a43-9ced-49d2-9179-c5fb5c9c0e27"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="${FAVICON}">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
${ogUrl ? `<meta property="og:url" content="${escapeHtml(ogUrl)}">\n<link rel="canonical" href="${escapeHtml(ogUrl)}">` : ""}
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">\n<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`}
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<style>
  :root {
    color-scheme: light dark;
    --bg: #f7f5f0; --fg: #1a1a1a; --muted: #6b6b6b; --border: #ddd;
    --card-bg: #fff; --input-bg: #fff; --input-border: #ccc;
    --thumb-bg: #eee;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #16161a; --fg: #f0eee9; --muted: #9a9a9a; --border: #333;
      --card-bg: #201f24; --input-bg: #201f24; --input-border: #444;
      --thumb-bg: #2a2a2e;
    }
  }
  body {
    margin: 0; padding: 0 16px 48px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--fg); line-height: 1.5;
  }
  a { color: inherit; }
  main { max-width: 960px; margin: 0 auto; }
  main.narrow { max-width: 720px; }
  img.hero {
    width: 100%; height: auto; max-height: 60vh; object-fit: cover;
    border-radius: 12px; margin: 16px 0; display: block;
  }
  h1 { margin: 0.2em 0 0; font-size: 1.8em; }
  .scientific { color: var(--muted); font-style: italic; margin: 0 0 0.6em; }
  .badge {
    display: inline-block; border: 1px solid var(--fg); border-radius: 999px;
    padding: 2px 12px; font-size: 0.85em; margin-bottom: 1em;
  }
  section.lang { margin: 1.6em 0; padding-top: 1.2em; border-top: 1px solid var(--border); }
  section.lang:first-of-type { border-top: none; }
  section.lang h2 {
    font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--muted); margin: 0 0 0.4em;
  }
  .credit { margin-top: 2em; font-size: 0.85em; color: var(--muted); }
  .credit a { color: inherit; }
  .not-found { text-align: center; padding: 4em 1em; }

  .site-header { padding: 28px 0 4px; }
  .site-header p { color: var(--muted); margin: 0.4em 0 0; }

  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 1.4em; }

  .btn {
    display: inline-block; padding: 8px 18px;
    border: 1px solid var(--fg); border-radius: 999px; text-decoration: none;
    color: var(--bg); font-size: 0.9em; background: var(--fg);
  }
  .btn:hover { background: transparent; color: var(--fg); }

  .btn-secondary {
    display: inline-block; padding: 8px 18px;
    border: 1px solid var(--border); border-radius: 999px; text-decoration: none;
    color: var(--fg); font-size: 0.9em; background: transparent;
  }
  .btn-secondary:hover { border-color: var(--fg); }

  .back-link {
    display: inline-block; margin-bottom: 1em; color: var(--muted);
    text-decoration: none; font-size: 0.9em;
  }
  .back-link:hover { text-decoration: underline; }

  .plugin-grid {
    list-style: none; margin: 1.5em 0 0; padding: 0;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 20px;
  }
  .plugin-card {
    display: flex; flex-direction: column; height: 100%;
    border: 1px solid var(--border); border-radius: 12px;
    overflow: hidden; text-decoration: none; color: inherit;
    background: var(--card-bg);
  }
  .plugin-card-img {
    width: 100%; aspect-ratio: 5 / 3; object-fit: cover;
    display: block; background: var(--thumb-bg); flex-shrink: 0;
  }
  .plugin-card-body { padding: 14px 16px; flex: 1; }
  .plugin-card h2 { margin: 0 0 0.3em; font-size: 1.05em; }
  .plugin-card p { margin: 0; color: var(--muted); font-size: 0.9em; }

  .search-form, .filter-form {
    display: flex; flex-wrap: wrap; gap: 8px; margin: 1.6em 0 0;
  }
  .filter-form { margin-top: 0.6em; }
  .search-form input, .filter-form select {
    padding: 8px 12px; border: 1px solid var(--input-border); border-radius: 8px;
    font-size: 0.95em; font-family: inherit; background: var(--input-bg); color: var(--fg);
  }
  .search-form input { flex: 1; }
  .search-form button {
    padding: 8px 16px; border: 1px solid var(--fg); border-radius: 8px;
    background: var(--fg); color: var(--bg); font-size: 0.95em; cursor: pointer;
  }
  .search-form button:hover { opacity: 0.85; }

  .history-heading {
    font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--muted); margin: 1.6em 0 0.4em;
  }
  .history-list { list-style: none; margin: 0; padding: 0; }
  .history-row {
    display: flex; align-items: center; gap: 12px; padding: 10px 0;
    border-top: 1px solid var(--border); text-decoration: none; color: inherit;
  }
  .history-list li:first-child .history-row { border-top: none; }
  .history-thumb {
    width: 48px; height: 48px; border-radius: 8px; object-fit: cover;
    flex-shrink: 0; background: var(--thumb-bg);
  }
  .history-text { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .history-date { color: var(--muted); font-size: 0.85em; flex-shrink: 0; }
  .history-name { font-weight: 600; }
  .history-sci { color: var(--muted); font-style: italic; font-size: 0.9em; }
  .empty { color: var(--muted); padding: 1em 0; }

  .pagination {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 1.4em; font-size: 0.9em; color: var(--muted);
  }
  .pagination a { color: var(--fg); text-decoration: none; }
  .pagination a:hover { text-decoration: underline; }
  .pagination .disabled { color: var(--border); pointer-events: none; }
</style>
</head>
<body>
<main${narrow ? ' class="narrow"' : ""}>
${body}
</main>
</body>
</html>`;
}
