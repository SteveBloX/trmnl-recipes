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
    ];
    return notFoundMessages.find((p) => p.lang === lang) || notFoundMessages[0];
  }
  const randomIndex = Math.floor(Math.random() * filteredProverbs.length);
  let proverb = filteredProverbs[randomIndex];

  if (!explanation) {
    console.log("Removing explanations from the proverb.", explanation);
    proverb = {
      ...proverb,
      translation: proverb.translation.replace(/\(.*?\)/g, "").trim(),
    };
  }
  return proverb;
}
