import { JSDOM } from "jsdom";
import { writeFileSync } from "fs";
// @ts-ignore
import { franc } from "franc-min";
import { getLogger } from "../logger";

const log = getLogger("shakespeare-quotes:scrape");

type Quote = {
  quote: string;
  book: string;
  tags: string[];
};

const TOTAL_PAGES = 30;
const DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function scrapePage(page: number): Promise<Quote[]> {
  const url = `https://www.goodreads.com/quotes/tag/shakespeare?page=${page}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    log.warn(`Page ${page}: HTTP ${res.status}, skipping.`);
    return [];
  }

  const html = await res.text();
  const doc = new JSDOM(html).window.document;
  const quotes: Quote[] = [];

  const blocks = doc.querySelectorAll(".quoteDetails");

  for (const block of blocks) {
    // Check author
    const authorEl = block.querySelector(".authorOrTitle");
    const author = authorEl?.textContent?.trim().replace(/,$/, "").trim() ?? "";
    if (!author.toLowerCase().includes("shakespeare")) continue;

    // Quote text: inside .quoteText, before the <br>
    const quoteTextEl = block.querySelector(".quoteText");
    if (!quoteTextEl) continue;

    // Extract only the text nodes before the <br> (the actual quote)
    let quoteText = "";
    for (const node of quoteTextEl.childNodes) {
      if (node.nodeName === "BR") break;
      if (node.nodeType === 3 /* TEXT_NODE */) {
        quoteText += node.textContent ?? "";
      }
    }

    // Strip surrounding typographic quotes (“ " ” " „ „)
    quoteText = quoteText.trim().replace(/^[“”„]|[“”„]$/g, "").trim();
    if (!quoteText) continue;

    // Skip non-English quotes
    if (franc(quoteText) !== "eng") continue;

    // Book title: second .authorOrTitle (first is author)
    const allAuthorOrTitle = block.querySelectorAll(".authorOrTitle");
    const book =
      allAuthorOrTitle.length >= 2
        ? allAuthorOrTitle[1].textContent?.trim() ?? ""
        : "";

    // Tags
    const tagLinks = block.querySelectorAll(".greyText a");
    const tags = Array.from(tagLinks)
      .map((a) => a.textContent?.trim() ?? "")
      .filter(Boolean);

    quotes.push({ quote: quoteText, book, tags });
  }

  return quotes;
}

async function main() {
  const allQuotes: Quote[] = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    process.stdout.write(`Scraping page ${page}/${TOTAL_PAGES}...`);
    const quotes = await scrapePage(page);
    allQuotes.push(...quotes);
    console.log(` ${quotes.length} quotes found (total: ${allQuotes.length})`);
    if (page < TOTAL_PAGES) await sleep(DELAY_MS);
  }

  // Deduplicate by quote text
  const seen = new Set<string>();
  const unique = allQuotes.filter(({ quote }) => {
    if (seen.has(quote)) return false;
    seen.add(quote);
    return true;
  });

  log.success(`Done. ${unique.length} unique quotes saved.`);
  writeFileSync(
    "./shakespeare-quotes/quotes.json",
    JSON.stringify(unique, null, 2),
    "utf-8"
  );
}

main();
