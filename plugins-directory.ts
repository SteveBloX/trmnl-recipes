// Liste des plugins TRMNL publics à afficher sur la page d'accueil. Les
// descriptions viennent du champ author_bio de chaque settings.yml existant
// (astrobin/src/settings.yml, etc.) — pas inventées — sauf Shakespeare
// Quotes et Word of the Day dont le settings.yml n'a pas de copie locale ;
// pour ces deux-là la description reprend celle déjà utilisée dans
// index.ts pour les health checks / la liste des apps.
export type PluginInfo = {
  slug: string;
  name: string;
  description: string;
};

export const PUBLIC_PLUGINS: PluginInfo[] = [
  {
    slug: "astrobin",
    name: "AstroBin Astronomy Image of the Day",
    description:
      "Displays images from AstroBin, a social network for astrophotographers. Choose either Image of the Day or a Random Top Pick — an image selected by the community.",
  },
  {
    slug: "chinese-proverbs",
    name: "Chinese Proverbs (Translated)",
    description:
      "Shows a random Chinese proverb, with English and French translations available.",
  },
  {
    slug: "fortnite-stats",
    name: "Fortnite Statistics",
    description:
      "Fortnite Battle Royale stats right on your TRMNL — wins, eliminations, and more, for any in-game username.",
  },
  {
    slug: "month-progress",
    name: "Month Progress",
    description:
      "Shows the current month as a simple square-per-day grid — a quick visual for how far through the month you are.",
  },
  {
    slug: "monument-of-the-day",
    name: "Monument of the Day",
    description:
      "A random UNESCO World Heritage monument every day, described in English, French, Spanish, Russian, Arabic and Chinese.",
  },
  {
    slug: "motogp-drivers-standings",
    name: "MotoGP Drivers Standings",
    description:
      "The current MotoGP rider standings — points, wins and recent results — plus a closer look at the championship leader.",
  },
  {
    slug: "shakespeare-quotes",
    name: "Shakespeare Quotes",
    description:
      "A random quote from the works of William Shakespeare, with its source when known.",
  },
  {
    slug: "word-of-the-day",
    name: "Word of the Day (8 languages)",
    description:
      "A daily rare word with its definition, pronunciation and etymology, available in eight languages.",
  },
  {
    slug: "world-cup-2026-bracket",
    name: "World Cup 2026 Bracket",
    description:
      "The FIFA World Cup 2026 knockout bracket with live scores, country flags, and real-time updates.",
  },
];

export function findPlugin(slug: string): PluginInfo | undefined {
  return PUBLIC_PLUGINS.find((p) => p.slug === slug);
}
