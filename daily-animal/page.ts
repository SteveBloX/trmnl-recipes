// Page web complète pour un animal archivé — la cible du QR code du layout
// "full". Contrairement au markup TRMNL, ceci est une vraie page web servie
// au navigateur : le CSS inline y est normal, pas une entorse à une règle.
// Toutes les langues connues sont affichées (pas seulement celle du device
// qui a scanné), puisque c'est justement la version "plus complète".

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  ru: "Русский",
  ar: "العربية",
  zh: "中文",
};

function escapeHtml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<script defer src="https://nx.bloax.xyz/lens.js" data-website-id="4dc22a43-9ced-49d2-9179-c5fb5c9c0e27"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; padding: 0 16px 48px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: #f7f5f0; color: #1a1a1a; line-height: 1.5;
  }
  main { max-width: 720px; margin: 0 auto; }
  img.hero {
    width: 100%; height: auto; max-height: 60vh; object-fit: cover;
    border-radius: 12px; margin: 16px 0; display: block;
  }
  h1 { margin: 0.2em 0 0; font-size: 1.8em; }
  .scientific { color: #6b6b6b; font-style: italic; margin: 0 0 0.6em; }
  .badge {
    display: inline-block; border: 1px solid #1a1a1a; border-radius: 999px;
    padding: 2px 12px; font-size: 0.85em; margin-bottom: 1em;
  }
  section.lang { margin: 1.6em 0; padding-top: 1.2em; border-top: 1px solid #ddd; }
  section.lang:first-of-type { border-top: none; }
  section.lang h2 {
    font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em;
    color: #6b6b6b; margin: 0 0 0.4em;
  }
  .credit { margin-top: 2em; font-size: 0.85em; color: #6b6b6b; }
  .credit a { color: inherit; }
  .not-found { text-align: center; padding: 4em 1em; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

export function renderAnimalPage(entry: any): string {
  const commonName = entry.name?.en || entry.scientificName;

  const sections = Object.entries(entry.description ?? {})
    .filter(([, text]) => !!text)
    .map(([locale, text]) => {
      const localizedName = entry.name?.[locale] || commonName;
      return `<section class="lang">
  <h2>${escapeHtml(LANGUAGE_NAMES[locale] || locale)}${
    localizedName !== commonName ? ` &middot; ${escapeHtml(localizedName)}` : ""
  }</h2>
  <p>${escapeHtml(text)}</p>
</section>`;
    })
    .join("\n");

  const badge = entry.conservationStatus?.statusName
    ? `<span class="badge">${escapeHtml(
        entry.conservationStatus.statusName.charAt(0).toUpperCase() +
          entry.conservationStatus.statusName.slice(1),
      )}</span><br>`
    : "";

  const body = `<img class="hero" src="${escapeHtml(entry.imageURL)}" alt="${escapeHtml(commonName)}">
<h1>${escapeHtml(commonName)}</h1>
<p class="scientific">${escapeHtml(entry.scientificName)}</p>
${badge}
${sections}
<p class="credit">
  Photo: ${escapeHtml(entry.photoCredit || entry.attribution || "")} &middot;
  <a href="${escapeHtml(entry.observationURL)}" target="_blank" rel="noopener">View on iNaturalist</a>
  ${entry.wikipediaURL ? ` &middot; <a href="${escapeHtml(entry.wikipediaURL)}" target="_blank" rel="noopener">Wikipedia</a>` : ""}
</p>`;

  return pageShell(`${commonName} — Animal of the Day`, body);
}

export function renderNotFoundPage(): string {
  return pageShell(
    "Not found — Animal of the Day",
    `<div class="not-found"><h1>Page not found</h1><p>This animal link doesn't exist (or the archive was reset).</p></div>`,
  );
}
