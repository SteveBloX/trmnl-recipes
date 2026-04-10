import { JSDOM } from "jsdom";

const IOTD_FEED_URL = "https://www.astrobin.com/iotd/rss/iotd";
const TOP_PICKS_FEED_URL = "https://www.astrobin.com/iotd/rss/top-picks";

type AstrobinItem = {
  title: string;
  link: string;
  description: string;
  creator: string;
  pubDate: string;
  guid: string;
  imageUrl: string;
  instagramUsername: string;
};

type AstrobinFeedData = {
  fetchedAt: string;
  iotd: AstrobinItem | null;
  randomTopPick: AstrobinItem | null;
};

function firstTextContent(parent: Element, tagNames: string[]) {
  for (const tagName of tagNames) {
    const element = parent.getElementsByTagName(tagName)[0];
    if (element?.textContent) {
      return element.textContent.trim();
    }
  }

  return "";
}

function parseFeed(xml: string) {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;
  const items = Array.from(doc.getElementsByTagName("item"));

  return items.map((item) => {
    const enclosure = item.getElementsByTagName("enclosure")[0];

    return {
      title: firstTextContent(item, ["title"]),
      link: firstTextContent(item, ["link"]),
      description: firstTextContent(item, ["description"]),
      creator: firstTextContent(item, ["dc:creator", "creator"]),
      pubDate: firstTextContent(item, ["pubDate"]),
      guid: firstTextContent(item, ["guid"]),
      imageUrl: enclosure?.getAttribute("url") || "",
      instagramUsername: firstTextContent(item, ["instagram_username"]),
    };
  });
}

async function fetchFeed(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }

  const xml = await response.text();
  return parseFeed(xml);
}

export async function fetchAstrobinData(): Promise<AstrobinFeedData | null> {
  try {
    const [iotd, topPicks] = await Promise.all([
      fetchFeed(IOTD_FEED_URL),
      fetchFeed(TOP_PICKS_FEED_URL),
    ]);

    if (iotd.length === 0 || topPicks.length === 0) {
      console.warn("AstroBin RSS feed returned no items.");
      return null;
    }

    const randomIndex = Math.floor(Math.random() * topPicks.length);
    const randomTopPick = topPicks[randomIndex] || null;
    const latestIotd = iotd[0] || null;

    return {
      fetchedAt: new Date().toISOString(),
      iotd: latestIotd,
      randomTopPick,
    };
  } catch (error: any) {
    console.error("Error retrieving AstroBin feeds:", error.message);
    return null;
  }
}
