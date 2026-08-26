// Fiche dédiée pour Natural Wonder of the Day dans l'annuaire de plugins —
// même principe que daily-animal/plugin-page.ts (recherche + filtre +
// pagination), catégorie UNESCO au lieu du groupe taxonomique.
import { escapeHtml, pageShell } from "../web-shell";
import { findPlugin } from "../plugins-directory";
import type { DailyHistoryEntry } from "./archive";

const PAGE_SIZE = 30;

export type NaturalWonderPageParams = {
  history: DailyHistoryEntry[];
  query: string;
  category: string; // "" = toutes, sinon "Natural" ou "Mixed"
  page: number; // 1-indexé
};

export function renderNaturalWonderPluginPage({
  history,
  query,
  category,
  page,
}: NaturalWonderPageParams): string {
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
  if (category) {
    filtered = filtered.filter(({ entry }) => entry.category === category);
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
      return `<li><a class="history-row" href="/natural-wonder/${escapeHtml(entry.slug)}">
  <img class="history-thumb" src="${escapeHtml(entry.imageURL)}" alt="" loading="lazy">
  <span class="history-text">
    <span class="history-date">${escapeHtml(date)}</span>
    <span class="history-name">${escapeHtml(commonName)}</span>
  </span>
</a></li>`;
    })
    .join("\n");

  const isFiltered = !!(q || category);
  const empty =
    filtered.length === 0
      ? `<p class="empty">${
          isFiltered
            ? "No natural wonder matches your search."
            : "No natural wonder has been drawn yet."
        }</p>`
      : "";

  const historyHeading = isFiltered
    ? `History &middot; ${filtered.length} match${filtered.length === 1 ? "" : "es"}`
    : `History &middot; ${filtered.length} total`;

  const categoryOptions = ["Natural", "Mixed"]
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}"${category === value ? " selected" : ""}>${escapeHtml(value)}</option>`
    )
    .join("\n");

  const pageQuery = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/plugins/natural-wonder-of-the-day${qs ? `?${qs}` : ""}`;
  };

  const pagination =
    totalPages > 1
      ? `<div class="pagination">
  <span>${currentPage > 1 ? `<a href="${escapeHtml(pageQuery(currentPage - 1))}">&larr; Previous</a>` : `<span class="disabled">&larr; Previous</span>`}</span>
  <span>Page ${currentPage} of ${totalPages}</span>
  <span>${currentPage < totalPages ? `<a href="${escapeHtml(pageQuery(currentPage + 1))}">Next &rarr;</a>` : `<span class="disabled">Next &rarr;</span>`}</span>
</div>`
      : "";

  const image = findPlugin("natural-wonder-of-the-day")?.image;

  const body = `<a class="back-link" href="/">&larr; All plugins</a>
${image ? `<img class="hero" src="${escapeHtml(image)}" alt="Natural Wonder of the Day preview">` : ""}
<h1>Natural Wonder of the Day</h1>
<p>A random natural or mixed UNESCO World Heritage Site, drawn every day, with name and description in 6 languages.</p>

<form class="search-form" method="get" action="/plugins/natural-wonder-of-the-day">
  <input type="search" name="q" placeholder="Search by name or country..." value="${escapeHtml(query)}" aria-label="Search natural wonder history">
  <select name="category" aria-label="Filter by UNESCO category" onchange="this.form.submit()">
    <option value="">All categories</option>
    ${categoryOptions}
  </select>
  <button type="submit">Search</button>
</form>

<h2 class="history-heading">${historyHeading}</h2>
<ul class="history-list">
${rows}
</ul>
${empty}
${pagination}`;

  return pageShell("Natural Wonder of the Day — TRMNL plugins", body, {
    description:
      "A random natural or mixed UNESCO World Heritage Site, drawn every day. Browse the full history and search past wonders.",
    image,
    path: "/plugins/natural-wonder-of-the-day",
  });
}
