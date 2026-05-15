// scripts/syllabird/buildAssignments.mjs

import fs from "node:fs/promises";
import path from "node:path";

const CSV_HEADERS = [
  "course_custom_id",
  "assignment_custom_id",
  "assignment_week",
  "assignment_day",
  "assignment_name",
  "assignment_description",
  "assignment_teachersNote",
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

function buildRowsForPacket(packet) {
  const lessonsSection = getLessonsSection(packet);
  if (!lessonsSection) return [];

  const rows = [];
  const courseCustomId = `alveary-${packet.id}`;
  const termNumber = Number(term.termNumber || 0);

  for (const term of lessonsSection.terms || []) {
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
  const outputPath = path.join(exportDir, "assignments.csv");
  const coursesPath = path.join(exportDir, "courses.csv");
  const coursesCsv = await fs.readFile(coursesPath, "utf8");
  const validCourseIds = new Set(
    parseCsv(coursesCsv).map(course => course.course_custom_id).filter(Boolean)
  );

  await fs.mkdir(exportDir, { recursive: true });

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

    const packetRows = buildRowsForPacket(packet);
    rows.push(...packetRows);
  }

  await fs.writeFile(outputPath, toCsv(rows), "utf8");

  console.log(`Built ${rows.length} Syllabird assignment row(s).`);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
