import { writeFileSync } from "node:fs";

const recipes: unknown[] = [];

async function main() {
  for (let page = 1; page <= 11; page++) {
    const url = new URL("https://trmnl.com/recipes.json");
    url.searchParams.set("sort-by", "newest");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch page ${page}: ${response.status} ${response.statusText}`,
      );
    }

    const payload: unknown = await response.json();
    const pageRecipes =
      typeof payload === "object" && payload !== null && "data" in payload
        ? payload.data
        : undefined;
    if (!Array.isArray(pageRecipes)) {
      throw new Error(`Unexpected response format on page ${page}`);
    }

    recipes.push(
      ...pageRecipes.filter(
        (recipe: { stats: { forks: number; installs: number } }) =>
          recipe.stats.forks + recipe.stats.installs > 50,
      ),
    );
    console.log(`Fetched page ${page}/${11}`);
  }

  writeFileSync("recipes.json", JSON.stringify(recipes, null, 2), "utf8");
  console.log(`Wrote ${recipes.length} recipes to recipes.json`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
