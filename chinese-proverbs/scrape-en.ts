import { JSDOM } from "jsdom";
import { writeFileSync } from "fs";
import { proverbType } from "./req";

const url =
  "https://www.chinahighlights.com/travelguide/learning-chinese/chinese-sayings.htm";
async function getProverbs() {
  const proverbs: proverbType[] = [];

  const res = await fetch(url);
  0;
  const buffer = Buffer.from(await res.arrayBuffer());

  const html = buffer.toString("utf-8");

  const parser = new JSDOM(html);
  const doc = parser.window.document;

  // get <p>s starting with x. e.g. 1. 2. etc. (chinese) and get the following <p> starting with "— " (translation). There's usually a following <p> with an explanation between '"'s.

  // Collect all <p> elements
  const ps = Array.from(doc.querySelectorAll("p"));

  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const text = (p.textContent || "").trim();
    // match paragraphs that start with a numbered list like "1. " or "1.\u00A0"
    if (/^\d+\.\s*/.test(text)) {
      // remove the leading number and dot
      let chinese = text.replace(/^\d+\.\s*/, "").trim();
      // remove any trailing explanation in parentheses
      chinese = chinese.replace(/\(.*?\)$/, "").trim();
      // look ahead for a translation paragraph starting with a dash or em-dash
      let translation = "";
      let k = i + 1;
      while (k < ps.length) {
        const nextText = (ps[k].textContent || "").trim();
        if (nextText === "") {
          k++;
          continue;
        }
        // translations on the source page usually start with an em-dash or dash, e.g. '— '
        if (
          /^[\-—–]\s*/.test(nextText) ||
          /^Translation[:\s]/i.test(nextText)
        ) {
          translation = nextText
            .replace(/^[\-—–]\s*/, "")
            .replace(/^Translation[:\s]+/i, "")
            .trim();
        } else {
          // if it doesn't start with a dash but looks short enough to be a translation, accept it
          const wordCount = nextText.split(/\s+/).length;
          if (wordCount < 40 && translation === "") {
            translation = nextText;
          }
        }
        break;
      }

      // fallback: if we didn't find a translation, try to find an em-dash inside the same paragraph
      if (!translation) {
        const insideMatch = chinese.match(/—\s*(.+)$/);
        if (insideMatch) {
          translation = insideMatch[1].trim();
        }
      }

      // generate a simple id
      const id = `${proverbs.length + 1}`;

      if (chinese) {
        proverbs.push({ id, chinese, translation });
      }
    }
  }

  console.log(`Page processed. Found ${proverbs.length} candidate proverbs.`);

  return proverbs;
}

getProverbs().then((proverbs) => {
  console.log(`Total proverbs collected: ${proverbs.length}`);
  writeFileSync("proverbs-en.json", JSON.stringify(proverbs, null, 2), "utf8");
});
