import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const BASE_URL = "https://kkeel.github.io/lesson-print-preview/preview/print.html?id=";

const OUTPUT_DIR = "./generated-pdfs";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function renderPdf(record) {
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  const url = `${BASE_URL}${record.id}`;

  console.log(`Rendering: ${url}`);

  await page.goto(url, {
    waitUntil: "networkidle"
  });

  await page.emulateMedia({
    media: "print"
  });

  const slug = slugify(record.title);

  const filename = `${record.id}-${slug}.pdf`;

  const outputPath = path.join(OUTPUT_DIR, filename);

  await page.pdf({
    path: outputPath,
    format: "Letter",
    printBackground: true,
    margin: {
      top: "0.5in",
      right: "0.5in",
      bottom: "0.5in",
      left: "0.5in"
    }
  });

  await browser.close();

  console.log(`Saved: ${filename}`);
}

async function main() {
  const jsonPath = "./data/packet-index.json";

  if (!fs.existsSync(jsonPath)) {
    throw new Error("Missing data/packet-index.json");
  }

  const records = JSON.parse(
    fs.readFileSync(jsonPath, "utf8")
  );

  for (const record of records) {
    try {
      await renderPdf(record);
    } catch (err) {
      console.error(`Failed: ${record.id}`);
      console.error(err);
    }
  }

  console.log("Done rendering PDFs.");
}

main();
