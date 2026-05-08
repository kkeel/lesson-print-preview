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

  for (const term of lessonsSection.terms || []) {
    const lessons = term.lessons || [];

    const weekCounters = new Map();

    for (const lesson of lessons) {
      const weekNumber = Number(lesson.weekNumber || 0);
      const currentCount = weekCounters.get(weekNumber) || 0;
      const dayNumber = currentCount + 1;

      weekCounters.set(weekNumber, dayNumber);

      rows.push({
        course_custom_id: courseCustomId,
        assignment_custom_id: `alveary-${lesson.lessonId || `${packet.id}-${weekNumber}-${dayNumber}`}`,
        assignment_week: weekNumber,
        assignment_day: dayNumber,
        assignment_name: lesson.title || "",
        assignment_description: textToHtml(lesson.body || ""),
        assignment_teachersNote: textToHtml(lesson.teacherNotes || ""),
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

async function main() {
  const repoRoot = process.cwd();
  const packetsDir = path.join(repoRoot, "data", "packets");
  const exportDir = path.join(repoRoot, "exports", "syllabird");
  const outputPath = path.join(exportDir, "assignments.csv");

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
    if (!(packet.rowType === "course" || packet.rowType === "topic")) continue;

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
