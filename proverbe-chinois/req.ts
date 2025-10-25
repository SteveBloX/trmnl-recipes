import proverbs from "./proverbs.json" assert { type: "json" };
type dataType = {
  favoriteWords: string[];
  excludedWords: string[];
  explanation: string;
};
export function proverbRequest(data: dataType) {
  const { favoriteWords, excludedWords } = data;
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
  return filteredProverbs[randomIndex];
}
