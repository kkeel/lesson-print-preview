// scripts/syllabird/buildAssignments.mjs

import fs from "node:fs/promises";
import path from "node:path";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const AIRTABLE_TABLE_NAME = "Lesson Plan Sets";
const AIRTABLE_EXPORT_STATUS_FIELD = "Syllabird Export Status";

const CSV_HEADERS = [
  "course_custom_id",
  "assignment_custom_id",
  "assignment_week",
  "assignment_day",
  "assignment_name",
  "assignment_description",
  "assignment_teachersNote",
  "assignment_linksUrl",
  "assignment_type",
  "assignment_duration",
  "assignment_graded"
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  return text
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function splitTeacherNotesForSyllabird(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return {
      bodyAppendix: "",
      teacherNotes: ""
    };
  }

  const blocks = text
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  const bodyBlocks = [];
  const teacherOnlyBlocks = [];

  for (const block of blocks) {
    const upper = block.toUpperCase();

    const isTeacherOnly =
      upper.includes("★") &&
      upper.includes("TEACHER") &&
      !upper.includes("STUDENT/TEACHER");

    if (isTeacherOnly) {
      teacherOnlyBlocks.push(block);
    } else {
      bodyBlocks.push(block);
    }
  }

  return {
    bodyAppendix: bodyBlocks.join("\n\n"),
    teacherNotes: teacherOnlyBlocks.join("\n\n")
  };
}

function appendBlocks(...blocks) {
  return blocks
    .map(block => String(block ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  return [
    CSV_HEADERS.map(csvEscape).join(","),
    ...rows.map(row => CSV_HEADERS.map(header => csvEscape(row[header])).join(","))
  ].join("\n") + "\n";
}

async function writePerCourseAssignmentCsvs(rows, outputDir) {
  const grouped = new Map();

  for (const row of rows) {
    const courseId = row.course_custom_id;

    if (!grouped.has(courseId)) {
      grouped.set(courseId, []);
    }

    grouped.get(courseId).push(row);
  }

  for (const [courseId, courseRows] of grouped.entries()) {
    const filePath = path.join(
      outputDir,
      `${courseId}.csv`
    );

    await fs.writeFile(
      filePath,
      toCsv(courseRows),
      "utf8"
    );
  }
}

function formatSyllabirdExportStatus(courseCount, assignmentCount) {
  const exportedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  return `Syllabird CSV exported ${exportedAt} ET · ${courseCount} courses · ${assignmentCount} assignments`;
}

async function updateAirtableSyllabirdStatus(courseIds, assignmentCount) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.warn("Skipping Airtable Syllabird status update: missing Airtable env vars.");
    return;
  }

  const tableName = encodeURIComponent(AIRTABLE_TABLE_NAME);
  const status = formatSyllabirdExportStatus(courseIds.length, assignmentCount);

  for (const courseId of courseIds) {
    const recordId = String(courseId).replace(/^alveary-/, "");

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: {
            [AIRTABLE_EXPORT_STATUS_FIELD]: status
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `Airtable Syllabird status update failed for ${recordId}: ${response.status} ${await response.text()}`
      );
    }
  }

  console.log(`Updated Airtable Syllabird export status for ${courseIds.length} course(s).`);
}

function getLessonsSection(packet) {
  return (packet.sections || []).find(section => section.type === "lessons") || null;
}

function getExamsSection(packet) {
  return (packet.sections || []).find(section => section.type === "exams") || null;
}

function getExamContentForTerm(packet, termNumber) {
  const examsSection = getExamsSection(packet);
  if (!examsSection) return "";

  const termLabel = `Term ${termNumber}`;
  const examTerm = (examsSection.terms || []).find(term =>
    String(term.term || "").trim() === termLabel
  );

  const content = String(examTerm?.content || "").trim();

  if (!content) return "";
  
  return `★ ${packet.lessonSetName} — TERM ${termNumber} EXAM QUESTIONS\n${content}`;
}

function getAssignmentType(packet, lesson) {
  const title = `${packet.lessonSetName || ""} ${lesson.title || ""}`.toLowerCase();
  const weekNumber = Number(lesson.weekNumber || 0);

  if (title.includes(" lab")) return "Lab";
  if (title.includes(" labs")) return "Lab";
  if (weekNumber > 0 && weekNumber % 12 === 0) return "Exam";

  return "Lesson";
}

function buildTrackerRowsForPacket(packet) {
  const tracker = packet.syllabird || {};

  if (!tracker.trackerTemplate) return [];

  const rows = [];
  const courseCustomId = `alveary-${packet.id}`;

  let lessonCounter = 1;

  for (let week = 1; week <= 36; week += 1) {
    const termNumber =
      week <= 12 ? 1 :
      week <= 24 ? 2 : 3;

    for (let day = 1; day <= tracker.perWeek; day += 1) {
      const isExamWeek = week % 12 === 0;

      const examContent = isExamWeek
        ? getExamContentForTerm(packet, termNumber)
        : "";

      const lessonTitle =
        `${tracker.trackerTitleTemplate} - Lesson ${lessonCounter}`;

      const assignmentBody = isExamWeek
        ? "➜ EXAMS\nAnswer question(s) related to course."
        : tracker.trackerTemplate;

      rows.push({
        course_custom_id: courseCustomId,

        assignment_custom_id:
          `alveary-tracker-${packet.id}-${week}-${day}`,

        assignment_week: week,
        assignment_day: day,

        assignment_name: lessonTitle,

        assignment_description:
          textToHtml(assignmentBody),

        assignment_teachersNote:
          textToHtml(examContent),

        assignment_linksUrl: "",

        assignment_type:
          isExamWeek ? "Exam" : "Lesson",

        assignment_duration: 0,
        assignment_graded: "FALSE"
      });

      lessonCounter += 1;
    }
  }

  return rows;
}

function buildRowsForPacket(packet) {
  const lessonsSection = getLessonsSection(packet);
  if (!lessonsSection) return [];

  const rows = [];
  const courseCustomId = `alveary-${packet.id}`;
  
  for (const term of lessonsSection.terms || []) {
    const termNumber = Number(term.termNumber || 0);
    const lessons = term.lessons || [];
    const weekCounters = new Map();

    for (const lesson of lessons) {
      const weekNumber = Number(lesson.weekNumber || 0);
      const currentCount = weekCounters.get(weekNumber) || 0;
      const dayNumber = currentCount + 1;

      weekCounters.set(weekNumber, dayNumber);

      const splitNotes = splitTeacherNotesForSyllabird(lesson.teacherNotes || "");
      const examContent =
        getAssignmentType(packet, lesson) === "Exam"
          ? getExamContentForTerm(packet, termNumber)
          : "";
      
      const assignmentBody = appendBlocks(
        lesson.body || "",
        splitNotes.bodyAppendix
      );
      
      const assignmentTeacherNotes = appendBlocks(
        splitNotes.teacherNotes,
        examContent
      );

      rows.push({
        course_custom_id: courseCustomId,
        assignment_custom_id: `alveary-${lesson.lessonId || `${packet.id}-${weekNumber}-${dayNumber}`}`,
        assignment_week: weekNumber,
        assignment_day: dayNumber,
        assignment_name: lesson.title || "",
        assignment_description: textToHtml(assignmentBody),
        assignment_teachersNote: textToHtml(assignmentTeacherNotes),
        assignment_linksUrl: lesson.lessonLinksUrl || "",
        assignment_type: getAssignmentType(packet, lesson),
        assignment_duration: 0,
        assignment_graded: "FALSE"
      });
    }
  }

  return rows;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      value = "";

      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0];

  return rows.slice(1).map(values => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ?? "";
    });
    return obj;
  });
}

async function main() {
  const repoRoot = process.cwd();
  const packetsDir = path.join(repoRoot, "data", "packets");
  const exportDir = path.join(repoRoot, "exports", "syllabird");
  const coursesPath = path.join(exportDir, "courses.csv");

  const assignmentsByCourseDir = path.join(
    exportDir,
    "assignments-by-course"
  );

  const coursesCsv = await fs.readFile(coursesPath, "utf8");
  const validCourseIds = new Set(
    parseCsv(coursesCsv).map(course => course.course_custom_id).filter(Boolean)
  );

  await fs.mkdir(exportDir, { recursive: true });

  await fs.mkdir(assignmentsByCourseDir, {
    recursive: true
  });

  const fileNames = await fs.readdir(packetsDir);
  const packetFiles = fileNames
    .filter(fileName => fileName.endsWith(".json"))
    .sort();

  const rows = [];

  for (const fileName of packetFiles) {
    const packetPath = path.join(packetsDir, fileName);
    const packet = await readJson(packetPath);

    // Match courses.csv phase 1 behavior:
    // only export standalone Course and Topic packets with lessons.
    const courseCustomId = `alveary-${packet.id}`;

    if (!validCourseIds.has(courseCustomId)) continue;

    const trackerTemplate =
      packet.syllabird?.trackerTemplate || "";
    
    const packetRows = trackerTemplate
      ? buildTrackerRowsForPacket(packet)
      : buildRowsForPacket(packet);
    
    rows.push(...packetRows);
  }

  await writePerCourseAssignmentCsvs(
    rows,
    assignmentsByCourseDir
  );

  await updateAirtableSyllabirdStatus(
    [...validCourseIds],
    rows.length
  );

  console.log(`Built ${rows.length} Syllabird assignment row(s).`);
  console.log(`Wrote per-course assignment CSVs to ${path.relative(repoRoot, assignmentsByCourseDir)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
