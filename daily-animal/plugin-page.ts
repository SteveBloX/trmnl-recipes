// Fiche dédiée pour Animal of the Day dans l'annuaire de plugins — plus
// riche que le template générique (plugins-pages.ts) car elle affiche
// l'historique des tirages avec recherche, filtre par groupe et pagination,
// ce qu'aucun autre plugin de l'annuaire n'a besoin de faire.
//
// Deux onglets (tous animaux / bébés) car ce sont deux tirages quotidiens
// distincts avec leur propre archive (voir daily-animal/archive.ts et
// fetch-animal.ts) — pas un simple filtre sur une même liste.
import { escapeHtml, pageShell } from "../web-shell";
import { findPlugin } from "../plugins-directory";
import type { DailyHistoryEntry } from "./archive";

// Même mapping que shared.liquid côté markup TRMNL, pour rester cohérent
// avec ce que l'appareil affiche.
const GROUP_LABELS: Record<string, string> = {
  Aves: "Bird",
  Mammalia: "Mammal",
  Reptilia: "Reptile",
  Amphibia: "Amphibian",
  Actinopterygii: "Fish",
};

// L'historique grandit d'une entrée par jour, indéfiniment — sans pagination
// cette page finirait par afficher des centaines de lignes sur un seul chargement.
const PAGE_SIZE = 30;

export type AnimalMode = "normal" | "babies";

export type AnimalOfTheDayPageParams = {
  history: DailyHistoryEntry[];
  query: string;
  group: string; // "" = tous les groupes
  page: number; // 1-indexé
  mode: AnimalMode;
};

export function renderAnimalOfTheDayPluginPage({
  history,
  query,
  group,
  page,
  mode,
}: AnimalOfTheDayPageParams): string {
  const q = query.trim().toLowerCase();

  let filtered = history;
  if (q) {
    filtered = filtered.filter(({ entry }) => {
      const names = Object.values(entry.name ?? {}).join(" ").toLowerCase();
      const sci = String(entry.scientificName ?? "").toLowerCase();
      return names.includes(q) || sci.includes(q);
    });
  }
  if (group) {
    filtered = filtered.filter(({ entry }) => entry.taxonGroup === group);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const rows = pageItems
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

  const isFiltered = !!(q || group);
  const emptyLabel = mode === "babies" ? "baby animal" : "animal";
  const empty =
    filtered.length === 0
      ? `<p class="empty">${
          isFiltered
            ? `No ${emptyLabel} matches your search.`
            : `No ${emptyLabel} has been drawn yet.`
        }</p>`
      : "";

  const historyHeading = isFiltered
    ? `History &middot; ${filtered.length} match${filtered.length === 1 ? "" : "es"}`
    : `History &middot; ${filtered.length} total`;

  // Pas de poissons en mode bébés (voir fetch-animal.ts, ICONIC_TAXA_BABIES)
  // — inutile de proposer un filtre qui ne donnerait jamais de résultat.
  const availableGroups = Object.entries(GROUP_LABELS).filter(
    ([value]) => mode === "normal" || value !== "Actinopterygii"
  );
  const groupOptions = availableGroups
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}"${group === value ? " selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("\n");

  const pageQuery = (p: number) => {
    const params = new URLSearchParams();
    if (mode === "babies") params.set("mode", "babies");
    if (query) params.set("q", query);
    if (group) params.set("group", group);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/plugins/animal-of-the-day${qs ? `?${qs}` : ""}`;
  };

  const pagination =
    totalPages > 1
      ? `<div class="pagination">
  <span>${currentPage > 1 ? `<a href="${escapeHtml(pageQuery(currentPage - 1))}">&larr; Previous</a>` : `<span class="disabled">&larr; Previous</span>`}</span>
  <span>Page ${currentPage} of ${totalPages}</span>
  <span>${currentPage < totalPages ? `<a href="${escapeHtml(pageQuery(currentPage + 1))}">Next &rarr;</a>` : `<span class="disabled">Next &rarr;</span>`}</span>
</div>`
      : "";

  // Changer d'onglet repart d'une recherche/filtre/page vierges : les deux
  // modes ont des espèces et des groupes différents, un filtre actif dans
  // l'un n'a pas forcément de sens dans l'autre.
  const tabs = `<div class="tabs">
  <a class="tab${mode === "normal" ? " tab--active" : ""}" href="/plugins/animal-of-the-day">All animals</a>
  <a class="tab${mode === "babies" ? " tab--active" : ""}" href="/plugins/animal-of-the-day?mode=babies">Baby animals</a>
</div>`;

  const modeHiddenInput =
    mode === "babies" ? `<input type="hidden" name="mode" value="babies">` : "";

  const image = findPlugin("animal-of-the-day")?.image;

  const intro =
    mode === "babies"
      ? "A random baby animal (bird, mammal, reptile or amphibian — no fish) picked from iNaturalist observations annotated as juveniles."
      : "A random wild animal (bird, mammal, reptile, amphibian or fish) from a real iNaturalist observation, with name and description in 6 languages.";

  const body = `<a class="back-link" href="/">&larr; All plugins</a>
${image ? `<img class="hero" src="${escapeHtml(image)}" alt="Animal of the Day preview">` : ""}
<h1>Animal of the Day</h1>
<p>${intro}</p>

${tabs}

<form class="search-form" method="get" action="/plugins/animal-of-the-day">
  ${modeHiddenInput}
  <input type="search" name="q" placeholder="Search by name..." value="${escapeHtml(query)}" aria-label="Search animal history">
  <select name="group" aria-label="Filter by animal group" onchange="this.form.submit()">
    <option value="">All groups</option>
    ${groupOptions}
  </select>
  <button type="submit">Search</button>
</form>

<h2 class="history-heading">${historyHeading}</h2>
<ul class="history-list">
${rows}
</ul>
${empty}
${pagination}`;

  return pageShell("Animal of the Day — TRMNL plugins", body, {
    description:
      "A random wild vertebrate from a real iNaturalist observation, drawn every day. Browse the full history and search past animals.",
    image,
    path: "/plugins/animal-of-the-day",
  });
}
