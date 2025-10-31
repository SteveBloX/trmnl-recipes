import proverbsFr from "./proverbs-fr.json" assert { type: "json" };
import proverbsEn from "./proverbs-en.json" assert { type: "json" };
import fs from "fs";
type dataType = {
  lang: string;
  favoriteWords: any;
  excludedWords: any;
  explanation: string;
};
export type proverbType = {
  id: string;
  chinese: string;
  translation: string;
};
export function proverbRequest(data: dataType) {
  let { lang, favoriteWords, excludedWords } = data;

  const proverbs = lang === "french" ? proverbsFr : proverbsEn;
  favoriteWords = favoriteWords
    ? favoriteWords.split(",").map((w) => w.trim())
    : [];
  excludedWords = excludedWords
    ? excludedWords.split(",").map((w) => w.trim())
    : [];
  const explanation = data.explanation ? data.explanation === "1" : false;
  const filteredProverbs = proverbs.filter((proverb) => {
    const { translation } = proverb;
    // must contain at least one favorite word
    const containsFavorite =
      favoriteWords.length === 0 ||
      favoriteWords.some((word) => translation.includes(word));
    // must not contain any excluded word
    const containsExcluded = excludedWords.some((word) =>
      translation.includes(word)
    );
    return containsFavorite && !containsExcluded;
  });
  // choose a random proverb from the filtered list
  if (filteredProverbs.length === 0) {
    const notFoundMessages = [
      {
        lang: "french",
        chinese: "无",
        translation: "Aucun proverbe ne correspond aux critères donnés.",
      },
      {
        lang: "english",
        chinese: "无",
        translation: "No proverbs match the given criteria.",
      },
    ];
    return notFoundMessages.find((p) => p.lang === lang) || notFoundMessages[0];
  }
  const randomIndex = Math.floor(Math.random() * filteredProverbs.length);
  let proverb = filteredProverbs[randomIndex];

  if (!explanation) {
    proverb = {
      ...proverb,
      translation: proverb.translation.replace(/\(.*?\)/g, "").trim(),
    };
  }
  try {
    fs.accessSync("./chinese-proverbs/stats.json", fs.constants.F_OK);
  } catch (err) {
    fs.writeFileSync(
      "./chinese-proverbs/stats.json",
      JSON.stringify({ french: 0, english: 0 }, null, 2),
      "utf-8"
    );
  }
  fs.readFileSync("./chinese-proverbs/stats.json", "utf-8");
  const statsPath = "./chinese-proverbs/stats.json";
  const statsData = fs.readFileSync(statsPath, "utf-8");
  const stats = JSON.parse(statsData);
  stats[lang] = (stats[lang] || 0) + 1;
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), "utf-8");
  console.log(
    `[${new Date().toISOString()}] ${lang} proverb requested. (Total: ${
      stats[lang]
    })`
  );
  return proverb;
}
