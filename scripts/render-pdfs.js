import fs from "fs";
import path from "path";
import crypto from "crypto";
import { chromium } from "playwright";

const BASE_URL =
  "https://kkeel.github.io/lesson-print-preview/preview/print.html?id=";

const OUTPUT_DIR = "./generated-pdfs";

const MANIFEST_PATH =
  "./course-picker/pdf/lesson-plans/pdf-manifest.json";

const INDEX_PATH = "./data/packet-index.json";

const RENDER_MODE = process.env.RENDER_MODE || "changed";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function getPacketJsonPath(recordId) {
  return `./data/packets/${recordId}.json`;
}

function hashFile(filepath) {
  const content = fs.readFileSync(filepath);
  return crypto.createHash("md5").update(content).digest("hex");
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {};
  }

  return JSON.parse(
    fs.readFileSync(MANIFEST_PATH, "utf8")
  );
}

function saveManifest(manifest) {
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "pdf-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
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

  const slug = slugify(
    record.lessonSetName || record.title || record.id
  );

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
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`Missing ${INDEX_PATH}`);
  }

  const records = JSON.parse(
    fs.readFileSync(INDEX_PATH, "utf8")
  );

  const manifest = loadManifest();

  let renderedCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    try {
      const packetPath = getPacketJsonPath(record.id);

      if (!fs.existsSync(packetPath)) {
        console.warn(`Missing packet JSON: ${packetPath}`);
        continue;
      }

      const currentHash = hashFile(packetPath);

      const previousHash = manifest[record.id]?.hash;

      const slug = slugify(
        record.lessonSetName || record.title || record.id
      );

      const filename = `${record.id}-${slug}.pdf`;

      const shouldRender =
        RENDER_MODE === "all" ||
        currentHash !== previousHash;

      if (!shouldRender) {
        console.log(`Skipping unchanged: ${filename}`);
        skippedCount++;
        continue;
      }

      await renderPdf(record);

      manifest[record.id] = {
        hash: currentHash,
        filename,
        updatedAt: new Date().toISOString()
      };

      renderedCount++;
    } catch (err) {
      console.error(`Failed: ${record.id}`);
      console.error(err);
    }
  }

  saveManifest(manifest);

  console.log(`Rendered: ${renderedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log("Done rendering PDFs.");
}

main();
