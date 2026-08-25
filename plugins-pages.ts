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

  return pageShell("My TRMNL plugins", body, { narrow: false });
}

export function renderPluginPage(plugin: PluginInfo): string {
  const body = `<a class="back-link" href="/">&larr; All plugins</a>
<h1>${escapeHtml(plugin.name)}</h1>
<p>${escapeHtml(plugin.description)}</p>`;

  return pageShell(`${plugin.name} — TRMNL plugins`, body);
}

export function renderPluginNotFoundPage(): string {
  return pageShell(
    "Not found — TRMNL plugins",
    `<div class="not-found"><h1>Page not found</h1><p>This plugin page doesn't exist.</p><a class="btn" href="/">See all plugins</a></div>`
  );
}
