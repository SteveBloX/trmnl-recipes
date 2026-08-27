// Fiche dédiée pour Monument of the Day dans l'annuaire de plugins — même
// principe que daily-natural-wonder/plugin-page.ts (recherche + pagination
// + miniatures). Contrairement aux deux autres plugins "pioche du jour", les
// lignes d'historique pointent vers la vraie page UNESCO (officialURL) au
// lieu d'un permalien interne : ce plugin n'en a jamais eu besoin, son QR
// pointe déjà vers cette page stable.
import { escapeHtml, pageShell } from "../web-shell";
import { findPlugin } from "../plugins-directory";
import type { DailyHistoryEntry } from "./archive";

const PAGE_SIZE = 30;

export type MonumentPageParams = {
  history: DailyHistoryEntry[];
  query: string;
  page: number; // 1-indexé
};

export function renderMonumentOfTheDayPluginPage({
  history,
  query,
  page,
}: MonumentPageParams): string {
  const q = query.trim().toLowerCase();

  let filtered = history;
  if (q) {
    filtered = filtered.filter(({ entry }) => {
      const names = Object.values(entry.name ?? {}).join(" ").toLowerCase();
      const countries = Array.isArray(entry.country_code)
        ? entry.country_code.join(" ").toLowerCase()
        : String(entry.country_code ?? "").toLowerCase();
      return names.includes(q) || countries.includes(q);
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const rows = pageItems
    .map(({ date, entry }) => {
      const commonName = entry.name?.en;
      return `<li><a class="history-row" href="${escapeHtml(entry.officialURL)}" target="_blank" rel="noopener">
  <img class="history-thumb" src="${escapeHtml(entry.imageURL)}" alt="" loading="lazy">
  <span class="history-text">
    <span class="history-date">${escapeHtml(date)}</span>
    <span class="history-name">${escapeHtml(commonName)}</span>
  </span>
</a></li>`;
    })
    .join("\n");

  const empty =
    filtered.length === 0
      ? `<p class="empty">${
          q ? "No monument matches your search." : "No monument has been drawn yet."
        }</p>`
      : "";

  const historyHeading = q
    ? `History &middot; ${filtered.length} match${filtered.length === 1 ? "" : "es"}`
    : `History &middot; ${filtered.length} total`;

  const pageQuery = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/plugins/monument-of-the-day${qs ? `?${qs}` : ""}`;
  };

  const pagination =
    totalPages > 1
      ? `<div class="pagination">
  <span>${currentPage > 1 ? `<a href="${escapeHtml(pageQuery(currentPage - 1))}">&larr; Previous</a>` : `<span class="disabled">&larr; Previous</span>`}</span>
  <span>Page ${currentPage} of ${totalPages}</span>
  <span>${currentPage < totalPages ? `<a href="${escapeHtml(pageQuery(currentPage + 1))}">Next &rarr;</a>` : `<span class="disabled">Next &rarr;</span>`}</span>
</div>`
      : "";

  const image = findPlugin("monument-of-the-day")?.image;

  const body = `<a class="back-link" href="/">&larr; All plugins</a>
${image ? `<img class="hero" src="${escapeHtml(image)}" alt="Monument of the Day preview">` : ""}
<h1>Monument of the Day</h1>
<p>A random UNESCO World Heritage monument, drawn every day, with name and description in 6 languages. History rows link to the official UNESCO page.</p>

<form class="search-form" method="get" action="/plugins/monument-of-the-day">
  <input type="search" name="q" placeholder="Search by name or country..." value="${escapeHtml(query)}" aria-label="Search monument history">
  <button type="submit">Search</button>
</form>

<h2 class="history-heading">${historyHeading}</h2>
<ul class="history-list">
${rows}
</ul>
${empty}
${pagination}`;

  return pageShell("Monument of the Day — TRMNL plugins", body, {
    description:
      "A random UNESCO World Heritage monument, drawn every day. Browse the full history of past monuments.",
    image,
    path: "/plugins/monument-of-the-day",
  });
}
