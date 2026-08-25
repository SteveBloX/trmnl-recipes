import { escapeHtml, pageShell } from "./web-shell";
import { PUBLIC_PLUGINS, type PluginInfo } from "./plugins-directory";

export function renderHomePage(): string {
  const items = PUBLIC_PLUGINS.map(
    (p) => `<li><a class="plugin-card" href="/plugins/${escapeHtml(p.slug)}">
  <img class="plugin-card-img" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)} preview" loading="lazy">
  <div class="plugin-card-body">
    <h2>${escapeHtml(p.name)}</h2>
    <p>${escapeHtml(p.description)}</p>
  </div>
</a></li>`
  ).join("\n");

  const body = `<div class="site-header">
  <h1>TRMNL plugins</h1>
  <p>A handful of small plugins I built for the TRMNL e-ink display.</p>
</div>
<ul class="plugin-grid">
${items}
</ul>`;

  return pageShell("My TRMNL plugins", body, {
    narrow: false,
    path: "/",
  });
}

export function renderPluginPage(plugin: PluginInfo): string {
  // Pas de bouton "Add to TRMNL" tant que l'ID de la recipe n'est pas connu
  // (voir plugins-directory.ts) — mieux vaut l'absence du bouton qu'un lien
  // inventé qui pointerait vers le mauvais plugin.
  const addToTrmnl = plugin.recipeId
    ? `<a class="btn" href="https://trmnl.com/recipes/${plugin.recipeId}" target="_blank" rel="noopener">Add to TRMNL</a>`
    : "";

  const body = `<a class="back-link" href="/">&larr; All plugins</a>
<img class="hero" src="${escapeHtml(plugin.image)}" alt="${escapeHtml(plugin.name)} preview">
<h1>${escapeHtml(plugin.name)}</h1>
<p>${escapeHtml(plugin.description)}</p>
<div class="actions">${addToTrmnl}</div>`;

  return pageShell(`${plugin.name} — TRMNL plugins`, body, {
    description: plugin.description,
    image: plugin.image,
    path: `/plugins/${plugin.slug}`,
  });
}

export function renderPluginNotFoundPage(): string {
  return pageShell(
    "Not found — TRMNL plugins",
    `<div class="not-found"><h1>Page not found</h1><p>This plugin page doesn't exist.</p><a class="btn" href="/">See all plugins</a></div>`
  );
}
