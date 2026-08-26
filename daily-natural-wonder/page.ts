// Page web complète pour une merveille naturelle archivée — la cible du QR
// code du layout "full". Même principe que daily-animal/page.ts : vraie page
// web, donc le CSS inline y est normal (pas une entorse à la règle TRMNL).
import { escapeHtml, pageShell } from "../web-shell";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  ru: "Русский",
  ar: "العربية",
  zh: "中文",
};

export function renderNaturalWonderPage(entry: any): string {
  const commonName = entry.name?.en;

  const sections = Object.entries(entry.description ?? {})
    .filter(([, text]) => !!text)
    .map(([locale, text]) => {
      const localizedName = entry.name?.[locale] || commonName;
      return `<section class="lang">
  <h2>${escapeHtml(LANGUAGE_NAMES[locale] || locale)}${
    localizedName !== commonName ? ` &middot; ${escapeHtml(localizedName)}` : ""
  }</h2>
  <p>${escapeHtml(text as string)}</p>
</section>`;
    })
    .join("\n");

  const badge = entry.category
    ? `<span class="badge">${escapeHtml(entry.category)} site</span><br>`
    : "";

  const countryCodes = Array.isArray(entry.country_code)
    ? entry.country_code.join(", ")
    : entry.country_code;

  const body = `<img class="hero" src="${escapeHtml(entry.imageURL)}" alt="${escapeHtml(commonName)}">
<h1>${escapeHtml(commonName)}</h1>
${countryCodes ? `<p class="scientific">${escapeHtml(String(countryCodes).toUpperCase())}</p>` : ""}
${badge}
${sections}
<p class="credit">
  <a href="${escapeHtml(entry.officialURL)}" target="_blank" rel="noopener">View on the UNESCO World Heritage List</a>
</p>
<a class="btn" href="/">See my other TRMNL plugins</a>`;

  const description =
    entry.description?.en ||
    Object.values(entry.description ?? {}).find((t) => !!t) ||
    `${commonName} — a random natural wonder from Natural Wonder of the Day.`;

  return pageShell(`${commonName} — Natural Wonder of the Day`, body, {
    description: String(description).slice(0, 200),
    image: entry.imageURL,
    path: `/natural-wonder/${entry.slug}`,
  });
}

export function renderNotFoundPage(): string {
  return pageShell(
    "Not found — Natural Wonder of the Day",
    `<div class="not-found"><h1>Page not found</h1><p>This natural wonder link doesn't exist (or the archive was reset).</p><a class="btn" href="/">See my other TRMNL plugins</a></div>`,
  );
}
