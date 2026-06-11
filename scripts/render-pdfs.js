import fs from "fs";
import path from "path";
import crypto from "crypto";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const BASE_URL =
  "https://kkeel.github.io/lesson-print-preview/preview/print.html?id=";

const OUTPUT_DIR = "./generated-pdfs";
const SAMPLE_OUTPUT_DIR = "./generated-sample-pdfs";
const ML_OUTPUT_DIR = "./generated-modern-language-pdfs";

const MANIFEST_PATH =
  "./course-picker/pdf/lesson-plans/pdf-manifest.json";

const INDEX_PATH = "./data/packet-index.json";

const RENDER_MODE = process.env.RENDER_MODE || "changed";

const TEST_PACKET_ID = process.env.TEST_PACKET_ID || "";
const TEST_VARIANT = process.env.TEST_VARIANT || "";
const TEST_TOPIC = process.env.TEST_TOPIC || "";
const TEST_LESSON_ID = process.env.TEST_LESSON_ID || "";
const SKIP_AIRTABLE_UPDATE = process.env.SKIP_AIRTABLE_UPDATE === "true";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = "Lesson Plan Sets";
const AIRTABLE_PAGE_COUNT_FIELD = "PDF Page Count";
const AIRTABLE_RENDER_STATUS_FIELD = "PDF Render Status";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

if (!fs.existsSync(SAMPLE_OUTPUT_DIR)) {
  fs.mkdirSync(SAMPLE_OUTPUT_DIR, { recursive: true });
}

if (!fs.existsSync(ML_OUTPUT_DIR)) {
  fs.mkdirSync(ML_OUTPUT_DIR, { recursive: true });
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

function isModernLanguagePacket(packetData) {
  return (packetData.sections || []).some(
    section => section.type === "modern-language-lessons"
  );
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

  const params = new URLSearchParams({
    id: record.id
  });
  
  const isSampleRender = record.renderSample === true;
  
  if (isSampleRender) {
    params.set("sample", "1");
  }

  if (TEST_VARIANT) {
    params.set("variant", TEST_VARIANT);
  }

  if (TEST_TOPIC) {
    params.set("mlView", "topic");
    params.set("topic", TEST_TOPIC);
  }

  if (TEST_LESSON_ID) {
    params.set("lesson", TEST_LESSON_ID);
  }

  const url = `https://kkeel.github.io/lesson-print-preview/preview/print.html?${params.toString()}`;

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

  let filename = isSampleRender
    ? `${record.id}.pdf`
    : `${record.id}-${slug}.pdf`;
  
  let outputDir = isSampleRender
    ? SAMPLE_OUTPUT_DIR
    : OUTPUT_DIR;

  if (TEST_VARIANT === "g1-3") {
    filename = `${record.id}-g1-3.pdf`;
    outputDir = ML_OUTPUT_DIR;
  }

  if (TEST_TOPIC) {
    filename = `${record.id}-${slugify(TEST_TOPIC)}.pdf`;
    outputDir = ML_OUTPUT_DIR;
  }

  if (TEST_LESSON_ID) {
    filename = `${TEST_LESSON_ID}.pdf`;
    outputDir = ML_OUTPUT_DIR;
  }

  const outputPath = path.join(outputDir, filename);

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

  let records = JSON.parse(
    fs.readFileSync(INDEX_PATH, "utf8")
  );
  
  if (TEST_PACKET_ID) {
    records = records.filter(record => record.id === TEST_PACKET_ID);
  
    if (!records.length) {
      throw new Error(`No packet found for TEST_PACKET_ID: ${TEST_PACKET_ID}`);
    }
  
    console.log(`TEST MODE: rendering only ${TEST_PACKET_ID}`);
  }

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

      const packetData = JSON.parse(fs.readFileSync(packetPath, "utf8"));

      if (!TEST_PACKET_ID && isModernLanguagePacket(packetData)) {
        console.log(`Skipping Modern Language packet in regular PDF render: ${record.id}`);
        skippedCount++;
        continue;
      }
      
      const currentHash = hashFile(packetPath);

      const previousHash = manifest[record.id]?.hash;

      const slug = slugify(
        record.lessonSetName || record.title || record.id
      );

      const filename = `${record.id}-${slug}.pdf`;

      const pdfPrintingStatus = String(record.pdfPrintingStatus || "").trim().toLowerCase();

      const shouldRender =
        RENDER_MODE === "all" ||
        RENDER_MODE === "samples-only" ||
        pdfPrintingStatus === "needs update" ||
        currentHash !== previousHash;
      
      if (!shouldRender) {
        console.log(`Skipping unchanged: ${filename}`);
        skippedCount++;
        continue;
      }
      
      let renderedPdf = null;
      
      if (RENDER_MODE !== "samples-only") {
        renderedPdf = await renderPdf(record);
      }
      
      if (!TEST_VARIANT && !TEST_TOPIC && !TEST_LESSON_ID) {
        const renderedSamplePdf = await renderPdf({
          ...record,
          renderSample: true
        });
      
        console.log(`Sample PDF saved: ${renderedSamplePdf.filename}`);
      }

      if (SKIP_AIRTABLE_UPDATE) {
        console.log(`Skipping Airtable update for test render: ${record.id}`);
      } else {
        if (renderedPdf) {
          await updateAirtablePageCount(record.id, renderedPdf.pageCount);
        }
      }

      if (renderedPdf) {
        manifest[record.id] = {
          hash: currentHash,
          filename,
          pageCount: renderedPdf.pageCount,
          updatedAt: new Date().toISOString()
        };
      }

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
