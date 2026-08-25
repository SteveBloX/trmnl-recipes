// Fiche dédiée pour Animal of the Day dans l'annuaire de plugins — plus
// riche que le template générique (plugins-pages.ts) car elle affiche
// l'historique des tirages avec une recherche, ce qu'aucun autre plugin de
// l'annuaire n'a besoin de faire.
import { escapeHtml, pageShell } from "../web-shell";
import type { DailyHistoryEntry } from "./archive";

export function renderAnimalOfTheDayPluginPage(
  history: DailyHistoryEntry[],
  query: string
): string {
  const q = query.trim().toLowerCase();

  const filtered = q
    ? history.filter(({ entry }) => {
        const names = Object.values(entry.name ?? {}).join(" ").toLowerCase();
        const sci = String(entry.scientificName ?? "").toLowerCase();
        return names.includes(q) || sci.includes(q);
      })
    : history;

  const rows = filtered
    .map(({ date, entry }) => {
      const commonName = entry.name?.en || entry.scientificName;
      return `<li><a class="history-row" href="/animal/${escapeHtml(entry.slug)}">
  <img class="history-thumb" src="${escapeHtml(entry.imageURL)}" alt="" loading="lazy">
  <span class="history-text">
    <span class="history-date">${escapeHtml(date)}</span>
    <span class="history-name">${escapeHtml(commonName)}</span>
    <span class="history-sci">${escapeHtml(entry.scientificName)}</span>
  </span>
</a></li>`;
    })
    .join("\n");

  const empty =
    filtered.length === 0
      ? `<p class="empty">${
          q ? "No animal matches your search." : "No animal has been drawn yet."
        }</p>`
      : "";

  const historyHeading = q
    ? `History &middot; ${filtered.length} match${filtered.length === 1 ? "" : "es"}`
    : "History";

  const body = `<a class="back-link" href="/">&larr; All plugins</a>
<h1>Animal of the Day</h1>
<p>A random wild vertebrate — bird, mammal, reptile, amphibian or fish — picked from a real, research-grade iNaturalist observation. A new one is drawn every day, with its name, description and conservation status in six languages.</p>

<form class="search-form" method="get" action="/plugins/animal-of-the-day">
  <input type="search" name="q" placeholder="Search by name..." value="${escapeHtml(query)}" aria-label="Search animal history">
  <button type="submit">Search</button>
</form>

<h2 class="history-heading">${historyHeading}</h2>
<ul class="history-list">
${rows}
</ul>
${empty}`;

  return pageShell("Animal of the Day — TRMNL plugins", body);
}
