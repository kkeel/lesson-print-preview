import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const INDEX_PATH = "./data/packet-index.json";
const PACKET_DIR = "./data/packets";

const COURSE_PICKER_DIR = "./course-picker";
const OUTPUT_ROOT = `${COURSE_PICKER_DIR}/pdf/modern-language`;
const MANIFEST_PATH = `${OUTPUT_ROOT}/ml-pdf-manifest.json`;

const BASE_PRINT_URL =
  "https://kkeel.github.io/lesson-print-preview/preview/print.html";

const RENDER_MODE = process.env.RENDER_MODE || "changed";

const TERM_PACKET_ID = process.env.TERM_PACKET_ID || "";
const TERM_NUMBER = process.env.TERM_NUMBER || "";

const OUTPUT_PATHS = {
  fullCourse: `${OUTPUT_ROOT}/full-course`,
  grades13: `${OUTPUT_ROOT}/grades-1-3`,
  topics: `${OUTPUT_ROOT}/topics`,
  individualLessons: `${OUTPUT_ROOT}/individual-lessons`,
  studentNotebooks: `${OUTPUT_ROOT}/student-notebooks`,
  references: `${OUTPUT_ROOT}/references`,
  termCourses: `${OUTPUT_ROOT}/term-courses`,
  samples: `${COURSE_PICKER_DIR}/pdf/samples`
};

for (const dir of Object.values(OUTPUT_PATHS)) {
  fs.mkdirSync(dir, { recursive: true });
}

function getPacketJsonPath(packetId) {
  return `${PACKET_DIR}/${packetId}.json`;
}

function loadJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, "utf8"));
}

function saveJson(filepath, value) {
  fs.writeFileSync(filepath, JSON.stringify(value, null, 2));
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

function hashObject(value) {
  return crypto
    .createHash("md5")
    .update(JSON.stringify(value))
    .digest("hex");
}

function getModernLanguageSection(packet) {
  return (packet.sections || []).find(
    section => section.type === "modern-language-lessons"
  );
}

function isModernLanguagePacket(packet) {
  return Boolean(getModernLanguageSection(packet));
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {};
  }

  return loadJson(MANIFEST_PATH);
}

async function getPdfPageCount(pdfPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

function buildPrintUrl(packetId, params = {}) {
  const urlParams = new URLSearchParams({ id: packetId });

  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.set(key, value);
  });

  return `${BASE_PRINT_URL}?${urlParams.toString()}`;
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

function getTopicSlug(lessonSetTitle) {
  return slugify(lessonSetTitle);
}

function getTopicRenderJobs(packet, mlSection) {
  return (mlSection.lessonSets || []).map(lessonSet => {
    const topicSlug = getTopicSlug(lessonSet.title);

    return {
      key: `${packet.id}:topic:${topicSlug}`,
      type: "topic",
      packetId: packet.id,
      pdfPrintingStatus: packet.pdfPrintingStatus,
      outputPath: path.join(
        OUTPUT_PATHS.topics,
        `${packet.id}-${topicSlug}.pdf`
      ),
      url: buildPrintUrl(packet.id, {
        mlView: "topic",
        topic: topicSlug
      }),
      hashSource: {
        packetId: packet.id,
        topicSlug,
        lessonSet
      }
    };
  });
}

function getIndividualLessonJobs(packet, mlSection) {
  const jobs = [];

  for (const lessonSet of mlSection.lessonSets || []) {
    for (const lesson of lessonSet.lessons || []) {
      jobs.push({
        key: `${packet.id}:lesson:${lesson.id}`,
        type: "individualLesson",
        packetId: packet.id,
        pdfPrintingStatus: packet.pdfPrintingStatus,
        outputPath: path.join(
          OUTPUT_PATHS.individualLessons,
          `${lesson.id}.pdf`
        ),
        url: buildPrintUrl(packet.id, {
          lesson: lesson.id
        }),
        hashSource: {
          packetId: packet.id,
          lessonSetId: lessonSet.id,
          lesson
        }
      });
    }
  }

  return jobs;
}

function getLanguageSlug(packet, mlSection) {
  const title = String(packet.title || mlSection.title || "").toLowerCase();

  if (title.includes("french")) return "french";
  if (title.includes("spanish")) return "spanish";

  const firstLessonSetTitle = String((mlSection.lessonSets || [])[0]?.title || "").toLowerCase();

  if (firstLessonSetTitle.includes("french")) return "french";
  if (firstLessonSetTitle.includes("spanish")) return "spanish";

  return slugify(packet.title || packet.id);
}

function getStudentNotebookJobs(packet, mlSection) {
  const languageSlug = getLanguageSlug(packet, mlSection);

  return [
    {
      key: `${packet.id}:student-notebook:full`,
      type: "studentNotebookFull",
      packetId: packet.id,
      pdfPrintingStatus: packet.pdfPrintingStatus,
      outputPath: path.join(
        OUTPUT_PATHS.studentNotebooks,
        `${packet.id}-${languageSlug}-student-notebook-full.pdf`
      ),
      url: buildPrintUrl(packet.id, {
        studentNotebook: "full"
      }),
      hashSource: {
        packetId: packet.id,
        pdfPrintingStatus: packet.pdfPrintingStatus,
        studentNotebook: "full",
        packet
      }
    },
    {
      key: `${packet.id}:student-notebook:work-only`,
      type: "studentNotebookWorkOnly",
      packetId: packet.id,
      pdfPrintingStatus: packet.pdfPrintingStatus,
      outputPath: path.join(
        OUTPUT_PATHS.studentNotebooks,
        `${packet.id}-${languageSlug}-student-notebook-work-only.pdf`
      ),
      url: buildPrintUrl(packet.id, {
        studentNotebook: "work-only"
      }),
      hashSource: {
        packetId: packet.id,
        pdfPrintingStatus: packet.pdfPrintingStatus,
        studentNotebook: "work-only",
        packet
      }
    }
  ];
}

function getReferenceJobs(packet, mlSection) {
  const languageSlug = getLanguageSlug(packet, mlSection);

  const references = [
    ["full", "references-full"],
    ["songs-rhymes", "songs-rhymes-reference"],
    ["storylines", "storylines-reference"],
    ["picture-study-vocab", "picture-study-vocab-reference"],
    ["literature-vocab", "literature-vocab-reference"],
    ["conversation-lines-phrases", "conversation-lines-phrases-reference"]
  ];

  return references.map(([referenceType, fileSuffix]) => ({
    key: `${packet.id}:reference:${referenceType}`,
    type: `reference:${referenceType}`,
    packetId: packet.id,
    pdfPrintingStatus: packet.pdfPrintingStatus,
    outputPath: path.join(
      OUTPUT_PATHS.references,
      `${packet.id}-${languageSlug}-${fileSuffix}.pdf`
    ),
    url: buildPrintUrl(packet.id, {
      mlReference: referenceType
    }),
    hashSource: {
      packetId: packet.id,
      pdfPrintingStatus: packet.pdfPrintingStatus,
      mlReference: referenceType,
      packet
    }
  }));
}

function getTermCourseJobs(packet, mlSection) {
  if (TERM_PACKET_ID && packet.id !== TERM_PACKET_ID) return [];

  const languageSlug = getLanguageSlug(packet, mlSection);
  const terms = TERM_NUMBER ? [TERM_NUMBER] : ["1", "2", "3"];

  return terms.map(term => ({
    key: `${packet.id}:term-course:${term}`,
    type: `termCourse:${term}`,
    packetId: packet.id,
    pdfPrintingStatus: packet.pdfPrintingStatus,
    outputPath: path.join(
      OUTPUT_PATHS.termCourses,
      `${packet.id}-${languageSlug}-term-${term}.pdf`
    ),
    url: buildPrintUrl(packet.id, {
      term
    }),
    hashSource: {
      packetId: packet.id,
      pdfPrintingStatus: packet.pdfPrintingStatus,
      term,
      packet
    }
  }));
}

function getPacketRenderJobs(packet) {
  const mlSection = getModernLanguageSection(packet);

  return [
    {
      key: `${packet.id}:sample`,
      type: "sample",
      packetId: packet.id,
      pdfPrintingStatus: packet.pdfPrintingStatus,
      outputPath: path.join(
        OUTPUT_PATHS.samples,
        `${packet.id}.pdf`
      ),
      url: buildPrintUrl(packet.id, {
        sample: "1"
      }),
      hashSource: {
        packetId: packet.id,
        pdfPrintingStatus: packet.pdfPrintingStatus,
        sample: "1",
        packet
      }
    },
    {
      key: `${packet.id}:full-course`,
      type: "fullCourse",
      packetId: packet.id,
      pdfPrintingStatus: packet.pdfPrintingStatus,
      outputPath: path.join(
        OUTPUT_PATHS.fullCourse,
        `${packet.id}-full.pdf`
      ),
      url: buildPrintUrl(packet.id),
      hashSource: packet
    },
    {
      key: `${packet.id}:g1-3`,
      type: "grades13",
      packetId: packet.id,
      pdfPrintingStatus: packet.pdfPrintingStatus,
      outputPath: path.join(
        OUTPUT_PATHS.grades13,
        `${packet.id}-g1-3.pdf`
      ),
      url: buildPrintUrl(packet.id, {
        variant: "g1-3"
      }),
      hashSource: {
        packetId: packet.id,
        pdfPrintingStatus: packet.pdfPrintingStatus,
        variant: "g1-3",
        packet
      }
    },
    ...getTopicRenderJobs(packet, mlSection),
    ...getIndividualLessonJobs(packet, mlSection),
    ...getStudentNotebookJobs(packet, mlSection),
    ...getReferenceJobs(packet, mlSection),
    ...getTermCourseJobs(packet, mlSection)
  ];
}

function commitCoursePickerChanges(renderedCount) {
  if (renderedCount === 0) {
    console.log("No Modern Language PDFs changed. Skipping commit.");
    return;
  }

  execSync(`git -C ${COURSE_PICKER_DIR} config user.name "github-actions[bot]"`, {
    stdio: "inherit"
  });

  execSync(
    `git -C ${COURSE_PICKER_DIR} config user.email "41898282+github-actions[bot]@users.noreply.github.com"`,
    { stdio: "inherit" }
  );

  execSync(`git -C ${COURSE_PICKER_DIR} add pdf/modern-language pdf/samples`, {
    stdio: "inherit"
  });

  const status = execSync(`git -C ${COURSE_PICKER_DIR} status --porcelain`, {
    encoding: "utf8"
  }).trim();

  if (!status) {
    console.log("No course-picker changes to commit.");
    return;
  }

  execSync(`git -C ${COURSE_PICKER_DIR} commit -m "Update modern language PDFs"`, {
    stdio: "inherit"
  });

  execSync(`git -C ${COURSE_PICKER_DIR} push`, {
    stdio: "inherit"
  });
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`Missing ${INDEX_PATH}`);
  }

  if (!fs.existsSync(COURSE_PICKER_DIR)) {
    throw new Error(
      `Missing ${COURSE_PICKER_DIR}. Make sure the workflow checks out course-picker into ./course-picker.`
    );
  }

  console.log(`Modern Language render mode: ${RENDER_MODE}`);

  if (RENDER_MODE === "term-course-only" && !TERM_PACKET_ID) {
    throw new Error("TERM_PACKET_ID is required when RENDER_MODE is term-course-only.");
  }

  const index = loadJson(INDEX_PATH);
  const manifest = loadManifest();
  const jobs = [];

  for (const record of index) {
    const packetPath = getPacketJsonPath(record.id);

    if (!fs.existsSync(packetPath)) {
      continue;
    }

    const packet = loadJson(packetPath);

    if (!isModernLanguagePacket(packet)) {
      continue;
    }

    jobs.push(...getPacketRenderJobs(packet));
  }

  console.log(`Modern Language render jobs found: ${jobs.length}`);

  let renderedCount = 0;
  let skippedCount = 0;

  for (const job of jobs) {
    const currentHash = hashObject(job.hashSource);
    const previousHash = manifest[job.key]?.hash;

    const pdfPrintingStatus =
      String(job.pdfPrintingStatus || "")
        .trim()
        .toLowerCase();
    
    const shouldRender =
      RENDER_MODE === "all" ||
      RENDER_MODE === "samples-only" ||
      RENDER_MODE === "term-course-only" ||
      pdfPrintingStatus === "needs update" ||
      currentHash !== previousHash ||
      !fs.existsSync(job.outputPath);
    
    if (RENDER_MODE === "samples-only" && job.type !== "sample") {
      console.log(`Skipping non-sample ML job: ${job.key}`);
      skippedCount++;
      continue;
    }

    if (RENDER_MODE === "term-course-only" && !String(job.type || "").startsWith("termCourse:")) {
      console.log(`Skipping non-term-course ML job: ${job.key}`);
      skippedCount++;
      continue;
    }

    if (!shouldRender) {
      console.log(`Skipping unchanged: ${job.key}`);
      skippedCount++;
      continue;
    }

    const pageCount = await renderPdf(job);

    manifest[job.key] = {
      hash: currentHash,
      type: job.type,
      packetId: job.packetId,
      outputPath: job.outputPath.replace(`${COURSE_PICKER_DIR}/`, ""),
      pageCount,
      updatedAt: new Date().toISOString()
    };

    renderedCount++;
  }

  saveJson(MANIFEST_PATH, manifest);

  console.log(`Rendered Modern Language PDFs: ${renderedCount}`);
  console.log(`Skipped unchanged Modern Language PDFs: ${skippedCount}`);

  commitCoursePickerChanges(renderedCount);

  console.log("Done rendering Modern Language PDFs.");
}

main();
