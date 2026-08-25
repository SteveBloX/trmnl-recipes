// Page web complète pour un animal archivé — la cible du QR code du layout
// "full". Contrairement au markup TRMNL, ceci est une vraie page web servie
// au navigateur : le CSS inline y est normal, pas une entorse à une règle.
// Toutes les langues connues sont affichées (pas seulement celle du device
// qui a scanné), puisque c'est justement la version "plus complète".
//
// escapeHtml/pageShell viennent de web-shell.ts — coquille partagée avec
// l'annuaire de plugins (plugins-pages.ts), pour un style et un script Umami
// cohérents sans les dupliquer page par page.
import { escapeHtml, pageShell } from "../web-shell";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  ru: "Русский",
  ar: "العربية",
  zh: "中文",
};

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
</p>
<a class="btn" href="/">See my other TRMNL plugins</a>`;

  return pageShell(`${commonName} — Animal of the Day`, body);
}

export function renderNotFoundPage(): string {
  return pageShell(
    "Not found — Animal of the Day",
    `<div class="not-found"><h1>Page not found</h1><p>This animal link doesn't exist (or the archive was reset).</p><a class="btn" href="/">See my other TRMNL plugins</a></div>`,
  );
}
