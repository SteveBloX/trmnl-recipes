// Coquille HTML partagée par toutes les pages servies par ce backend (les
// fiches animal, l'annuaire de plugins et ses fiches individuelles) —
// centralisée pour que le style visuel et le script client Umami restent
// cohérents au lieu d'être dupliqués page par page.
export function escapeHtml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function pageShell(title: string, body: string): string {
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

  .site-header { padding: 28px 0 4px; }
  .site-header p { color: #6b6b6b; margin: 0.4em 0 0; }

  .btn {
    display: inline-block; margin-top: 1.4em; padding: 8px 18px;
    border: 1px solid #1a1a1a; border-radius: 999px; text-decoration: none;
    color: #1a1a1a; font-size: 0.9em; background: transparent;
  }
  .btn:hover { background: #1a1a1a; color: #f7f5f0; }

  .back-link {
    display: inline-block; margin-bottom: 1em; color: #6b6b6b;
    text-decoration: none; font-size: 0.9em;
  }
  .back-link:hover { text-decoration: underline; }

  .plugin-list { list-style: none; margin: 1.5em 0 0; padding: 0; }
  .plugin-card {
    display: block; padding: 18px 0; border-top: 1px solid #ddd;
    text-decoration: none; color: inherit;
  }
  .plugin-list li:first-child .plugin-card { border-top: none; }
  .plugin-card h2 { margin: 0 0 0.3em; font-size: 1.15em; }
  .plugin-card p { margin: 0; color: #6b6b6b; font-size: 0.95em; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}
