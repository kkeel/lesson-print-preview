import fs from "fs";
import path from "path";
import crypto from "crypto";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const BASE_URL =
  "https://kkeel.github.io/lesson-print-preview/preview/print.html?id=";

const OUTPUT_DIR = "./generated-pdfs";

const MANIFEST_PATH =
  "./course-picker/pdf/lesson-plans/pdf-manifest.json";

const INDEX_PATH = "./data/packet-index.json";

const RENDER_MODE = process.env.RENDER_MODE || "changed";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = "Lesson Plan Sets";
const AIRTABLE_PAGE_COUNT_FIELD = "PDF Page Count";
const AIRTABLE_RENDER_STATUS_FIELD = "PDF Render Status";

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

async function getPdfPageCount(pdfPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

function formatRenderStatus(pageCount) {
  const renderedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  return `Rendered ${renderedAt} ET · ${pageCount} pages`;
}

async function updateAirtablePageCount(recordId, pageCount) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.warn("Skipping Airtable page count update: missing Airtable env vars.");
    return;
  }

  const tableName = encodeURIComponent(AIRTABLE_TABLE_NAME);

  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          [AIRTABLE_PAGE_COUNT_FIELD]: pageCount,
          [AIRTABLE_RENDER_STATUS_FIELD]: formatRenderStatus(pageCount)
        }
      })
    }
  );

  if (!res.ok) {
    throw new Error(
      `Airtable page count update failed for ${recordId}: ${res.status} ${await res.text()}`
    );
  }

  console.log(`Updated Airtable PDF render status: ${recordId} = ${pageCount} pages`);
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

  const pageCount = await getPdfPageCount(outputPath);

  console.log(`Saved: ${filename}`);
  console.log(`Page count: ${pageCount}`);

  return {
    filename,
    outputPath,
    pageCount
  };
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

      const renderedPdf = await renderPdf(record);

      await updateAirtablePageCount(record.id, renderedPdf.pageCount);

      manifest[record.id] = {
        hash: currentHash,
        filename,
        pageCount: renderedPdf.pageCount,
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
