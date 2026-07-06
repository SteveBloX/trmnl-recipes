import quotes from "./quotes.json" assert { type: "json" };

type dataType = {
  favoriteBooks?: string;
  excludedBooks?: string;
  favoriteTags?: string;
};

export type quoteType = {
  quote: string;
  book: string;
  tags: string[];
};

export function shakespeareRequest(data: dataType, _body: any = null): quoteType {
  const favoriteBooks = data.favoriteBooks
    ? data.favoriteBooks.split(",").map((b) => b.trim().toLowerCase())
    : [];
  const excludedBooks = data.excludedBooks
    ? data.excludedBooks.split(",").map((b) => b.trim().toLowerCase())
    : [];
  const favoriteTags = data.favoriteTags
    ? data.favoriteTags.split(",").map((t) => t.trim().toLowerCase())
    : [];

  const filtered = (quotes as quoteType[]).filter((q) => {
    const book = q.book.toLowerCase();
    const tags = q.tags.map((t) => t.toLowerCase());

    const inFavoriteBook =
      favoriteBooks.length === 0 || favoriteBooks.some((b) => book.includes(b));
    const inExcludedBook = excludedBooks.some((b) => book.includes(b));
    const hasTag =
      favoriteTags.length === 0 || favoriteTags.some((t) => tags.includes(t));

    return inFavoriteBook && !inExcludedBook && hasTag;
  });

  if (filtered.length === 0) {
    return {
      quote: "No quotes match the given criteria.",
      book: "",
      tags: [],
    };
  }

  const result = filtered[Math.floor(Math.random() * filtered.length)];
  return {
    ...result,
    tags: result.tags.filter((t) => t.toLowerCase() !== "shakespeare"),
  };
}
