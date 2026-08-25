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
  // Servi statiquement depuis public/screenshots/ (voir index.ts). À déposer
  // toi-même : le fichier attendu est <slug>.png pour chaque plugin.
  image: string;
  // ID de la recipe sur trmnl.com/recipes/<id> — présent uniquement quand la
  // valeur existe dans le settings.yml local du plugin. Absent = pas de
  // bouton "Add to TRMNL" plutôt qu'un lien inventé.
  recipeId?: number;
};

export const PUBLIC_PLUGINS: PluginInfo[] = [
  {
    slug: "animal-of-the-day",
    name: "Animal of the Day",
    description:
      "A random wild animal (bird, mammal, reptile, amphibian or fish) from a real iNaturalist observation, with name and description in 6 languages.",
    image: "/screenshots/animal-of-the-day.png",
  },
  {
    slug: "astrobin",
    name: "AstroBin Astronomy Image of the Day",
    description:
      "Displays images from AstroBin, a social network for astrophotographers. Choose either Image of the Day or a Random Top Pick: an image selected by the community.",
    image: "/screenshots/astrobin.png",
    recipeId: 283008,
  },
  {
    slug: "chinese-proverbs",
    name: "Chinese Proverbs (Translated)",
    description:
      "Shows a random Chinese proverb, with English and French translations available.",
    image: "/screenshots/chinese-proverbs.png",
    recipeId: 171219,
  },
  {
    slug: "fortnite-stats",
    name: "Fortnite Statistics",
    description:
      "Fortnite Battle Royale stats right on your TRMNL: wins, eliminations, and more.",
    image: "/screenshots/fortnite-stats.png",
    recipeId: 186199,
  },
  {
    slug: "month-progress",
    name: "Month Progress",
    description:
      "Shows the current month as a simple grid. A quick visual for how far through the month you are.",
    image: "/screenshots/month-progress.png",
    recipeId: 209701,
  },
  {
    slug: "monument-of-the-day",
    name: "Monument of the Day",
    description:
      "A random UNESCO World Heritage monument every day, described in English, French, Spanish, Russian, Arabic and Chinese.",
    image: "/screenshots/monument-of-the-day.png",
    recipeId: 192148,
  },
  {
    slug: "motogp-drivers-standings",
    name: "MotoGP Drivers Standings",
    description:
      "The current MotoGP rider standings: points, wins and recent results. Plus a closer look at the championship leader.",
    image: "/screenshots/motogp-drivers-standings.png",
  },
  {
    slug: "shakespeare-quotes",
    name: "Shakespeare Quotes",
    description: "A random quote from the works of William Shakespeare.",
    image: "/screenshots/shakespeare-quotes.png",
  },
  {
    slug: "word-of-the-day",
    name: "Word of the Day (8 languages)",
    description:
      "A daily rare word with its definition, pronunciation and etymology, available in eight languages.",
    image: "/screenshots/word-of-the-day.png",
  },
  {
    slug: "world-cup-2026-bracket",
    name: "World Cup 2026 Bracket",
    description:
      "The FIFA World Cup 2026 knockout bracket with live scores and country flags.",
    image: "/screenshots/world-cup-2026-bracket.png",
  },
];

export function findPlugin(slug: string): PluginInfo | undefined {
  return PUBLIC_PLUGINS.find((p) => p.slug === slug);
}
