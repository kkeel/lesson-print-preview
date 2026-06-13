import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const DATA_DIR = "./data/history-charts";
const COURSE_PICKER_DIR = "./course-picker";
const OUTPUT_DIR = `${COURSE_PICKER_DIR}/pdf/history-charts`;
const MANIFEST_PATH = `${OUTPUT_DIR}/history-chart-pdf-manifest.json`;

const BASE_PRINT_URL =
  "https://kkeel.github.io/lesson-print-preview/preview/history-charts/print.html";

const RENDER_MODE = process.env.RENDER_MODE || "changed";

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, "utf8"));
}

function saveJson(filepath, value) {
  fs.writeFileSync(filepath, JSON.stringify(value, null, 2));
}

function hashObject(value) {
  return crypto
    .createHash("md5")
    .update(JSON.stringify(value))
    .digest("hex");
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  return loadJson(MANIFEST_PATH);
}

async function getPdfPageCount(pdfPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

function buildPrintUrl(grade, country) {
  const params = new URLSearchParams({
    grade: String(grade),
    country: String(country)
  });

  return `${BASE_PRINT_URL}?${params.toString()}`;
}

async function renderPdf({ url, outputPath }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`Rendering: ${url}`);

  await page.goto(url, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });

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

  console.log(`Saved: ${outputPath}`);
  console.log(`Page count: ${pageCount}`);

  return pageCount;
}

function getJobs() {
  return fs.readdirSync(DATA_DIR)
    .filter(filename => /^grade-\d+-(us|canada)\.json$/i.test(filename))
    .map(filename => {
      const dataPath = path.join(DATA_DIR, filename);
      const data = loadJson(dataPath);

      const grade = data.grade;
      const country = data.country;

      return {
        key: `history-chart:${grade}:${country}`,
        grade,
        country,
        dataPath,
        outputPath: path.join(OUTPUT_DIR, filename.replace(".json", ".pdf")),
        url: buildPrintUrl(grade, country),
        hashSource: data
      };
    });
}

function commitCoursePickerChanges(renderedCount) {
  if (renderedCount === 0) {
    console.log("No History Chart PDFs changed. Skipping commit.");
    return;
  }

  execSync(`git -C ${COURSE_PICKER_DIR} config user.name "github-actions[bot]"`, {
    stdio: "inherit"
  });

  execSync(
    `git -C ${COURSE_PICKER_DIR} config user.email "41898282+github-actions[bot]@users.noreply.github.com"`,
    { stdio: "inherit" }
  );

  execSync(`git -C ${COURSE_PICKER_DIR} add pdf/history-charts`, {
    stdio: "inherit"
  });

  const status = execSync(`git -C ${COURSE_PICKER_DIR} status --porcelain`, {
    encoding: "utf8"
  }).trim();

  if (!status) {
    console.log("No course-picker changes to commit.");
    return;
  }

  execSync(`git -C ${COURSE_PICKER_DIR} commit -m "Update history chart PDFs"`, {
    stdio: "inherit"
  });

  execSync(`git -C ${COURSE_PICKER_DIR} push`, {
    stdio: "inherit"
  });
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Missing ${DATA_DIR}. Run the history chart data builder first.`);
  }

  if (!fs.existsSync(COURSE_PICKER_DIR)) {
    throw new Error(
      `Missing ${COURSE_PICKER_DIR}. Make sure the workflow checks out course-picker into ./course-picker.`
    );
  }

  console.log(`History Chart render mode: ${RENDER_MODE}`);

  const manifest = loadManifest();
  const jobs = getJobs();

  console.log(`History Chart render jobs found: ${jobs.length}`);

  let renderedCount = 0;
  let skippedCount = 0;

  for (const job of jobs) {
    const currentHash = hashObject(job.hashSource);
    const previousHash = manifest[job.key]?.hash;

    const shouldRender =
      RENDER_MODE === "all" ||
      currentHash !== previousHash ||
      !fs.existsSync(job.outputPath);

    if (!shouldRender) {
      console.log(`Skipping unchanged: ${job.key}`);
      skippedCount++;
      continue;
    }

    const pageCount = await renderPdf(job);

    manifest[job.key] = {
      hash: currentHash,
      grade: job.grade,
      country: job.country,
      outputPath: job.outputPath.replace(`${COURSE_PICKER_DIR}/`, ""),
      pageCount,
      updatedAt: new Date().toISOString()
    };

    renderedCount++;
  }

  saveJson(MANIFEST_PATH, manifest);

  console.log(`Rendered History Chart PDFs: ${renderedCount}`);
  console.log(`Skipped unchanged History Chart PDFs: ${skippedCount}`);

  commitCoursePickerChanges(renderedCount);

  console.log("Done rendering History Chart PDFs.");
}

main();
