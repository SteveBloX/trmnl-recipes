import { JSDOM } from "jsdom";
import { writeFileSync } from "fs";
import iconv from "iconv-lite";

const pages = 22;
const firstPage = 0;
const getPage = (page: number) =>
  `https://chine.in/mandarin/proverbes/index.php?start=${page}`;

async function getProverbs() {
  const proverbs: { id: string; chinese: string; french: string }[] = [];

  for (let page = firstPage; page < pages; page++) {
    const res = await fetch(getPage(page));
    const buffer = Buffer.from(await res.arrayBuffer());

    const html = iconv.decode(buffer, "latin1");

    const parser = new JSDOM(html);
    const doc = parser.window.document;

    const items = doc.querySelectorAll(".proverbe");
    items.forEach((item) => {
      const id =
        item.querySelector(".p_id")?.textContent?.trim().replace("N°", "") ||
        "";
      const chinese = item.querySelector(".p_zh")?.textContent?.trim();
      const french = item.querySelector(".p_fr")?.textContent?.trim();
      if (chinese && french) {
        proverbs.push({
          id,
          chinese,
          french,
        });
      }
    });
    console.log(`Page ${page + 1}/${pages} processed.`);
  }

  return proverbs;
}

getProverbs().then((proverbs) => {
  console.log(`Total proverbs collected: ${proverbs.length}`);
  writeFileSync("proverbs.json", JSON.stringify(proverbs, null, 2), "utf8");
});
