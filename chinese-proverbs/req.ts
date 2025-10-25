import proverbsFr from "./proverbs-fr.json" assert { type: "json" };
type dataType = {
  lang: string;
  favoriteWords: any;
  excludedWords: any;
  explanation: string;
};
export function proverbRequest(data: dataType) {
  let { lang, favoriteWords, excludedWords } = data;
  const proverbs = lang === "french" ? proverbsFr : proverbsFr;
  favoriteWords = favoriteWords
    ? favoriteWords.split(";").map((w) => w.trim())
    : [];
  excludedWords = excludedWords
    ? excludedWords.split(";").map((w) => w.trim())
    : [];
  const explanation = data.explanation ? data.explanation === "1" : false;
  const filteredProverbs = proverbs.filter((proverb) => {
    const { french } = proverb;
    // must contain at least one favorite word
    const containsFavorite =
      favoriteWords.length === 0 ||
      favoriteWords.some((word) => french.includes(word));
    // must not contain any excluded word
    const containsExcluded = excludedWords.some((word) =>
      french.includes(word)
    );
    return containsFavorite && !containsExcluded;
  });
  // choose a random proverb from the filtered list
  if (filteredProverbs.length === 0) {
    return {
      chinese: "无",
      french: "Aucun proverbe ne correspond aux critères donnés.",
    };
  }
  const randomIndex = Math.floor(Math.random() * filteredProverbs.length);
  // if explanation isn't requested, remove all strings between parentheses in french
  let proverb = filteredProverbs[randomIndex];

  if (!explanation) {
    console.log("Removing explanations from the proverb.", explanation);
    proverb = {
      ...proverb,
      french: proverb.french.replace(/\(.*?\)/g, "").trim(),
    };
  }
  return proverb;
}
