// scripts/syllabird/buildCourses.mjs

import fs from "node:fs/promises";
import path from "node:path";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const LESSON_TABLE_NAME = "Lesson Plan Sets";
const LESSON_VIEW_NAME = "Cover Page";

const HEADER_TABLE_NAME = "Header Pages";
const HEADER_VIEW_NAME = "Header Print";

const LESSONS_TABLE_NAME = "Lessons";
const LESSONS_VIEW_NAME = "Grid view";

const COURSE_FIELDS = [
  "Lesson Set Name",
  "setID",
  "Course Type",
  "Grade",
  "Grade Text",
  "Subject",
  "Sort_ID",
  "Course Connection",
  "Topic Connection",
  "Schedule Info.",
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "Connect Header Pages",
  "Lessons"
];

const HEADER_FIELDS = [
  "headerID",
  "Connect Lesson Plans",
  "Course/Topic Description (LP)",
  "About_Export",
  "General_Export",
  "Special_Export",
  "Term_Export",
  "Reminders_Export"
];

const LESSON_DETAIL_FIELDS = [
  "Term",
  "Week"
];

const CSV_HEADERS = [
  "course_custom_id",
  "course_name",
  "course_numberOfDaysPerWeek",
  "course_numberOfWeeks",
  "course_subjects",
  "course_gradeYears",
  "course_defaultDaysOfTheWeek",
  "course_gradingStyle",
  "course_color",
  "course_picture",
  "course_credits",
  "course_description",
  "course_introduction"
];

if (!AIRTABLE_TOKEN) {
  throw new Error("Missing AIRTABLE_TOKEN environment variable.");
}

if (!AIRTABLE_BASE_ID) {
  throw new Error("Missing AIRTABLE_BASE_ID environment variable.");
}

async function fetchAllRecords(tableName, viewName, fields) {
  const allRecords = [];
  let offset = "";

  while (true) {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
    );

    url.searchParams.set("view", viewName);

    for (const field of fields) {
      url.searchParams.append("fields[]", field);
    }

    if (offset) {
      url.searchParams.set("offset", offset);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Airtable request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    allRecords.push(...(data.records || []));

    if (!data.offset) break;
    offset = data.offset;
  }

  return allRecords;
}

function normalizeText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value).trim();
}

function normalizeArray(value) {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value
      .map(item => String(item ?? "").trim())
      .filter(Boolean);
  }

  return String(value)
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeRichText(value) {
  if (value == null) return "";

  if (Array.isArray(value)) {
    return value
      .map(item => String(item ?? "").trim())
      .filter(item => item && item.toLowerCase() !== "null")
      .join("\n\n");
  }

  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
}

function joinNonEmptyBlocks(blocks) {
  return blocks
    .map(block => String(block ?? "").trim())
    .filter(block => block && block.toLowerCase() !== "null")
    .join("\n\n");
}

function textToHtml(value) {
  const text = normalizeRichText(value);
  if (!text) return "";

  return text
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const lines = [
    CSV_HEADERS.map(csvEscape).join(","),
    ...rows.map(row => CSV_HEADERS.map(header => csvEscape(row[header])).join(","))
  ];

  return lines.join("\n") + "\n";
}

function buildHeaderLookup(headerRecords) {
  const byHeaderId = new Map();
  const byLessonPlanId = new Map();

  for (const record of headerRecords) {
    const fields = record.fields || {};
    const headerId = normalizeText(fields["headerID"]) || record.id;
    const connectedLessonPlanIds = normalizeArray(fields["Connect Lesson Plans"]);

    byHeaderId.set(headerId, record);

    for (const lessonPlanId of connectedLessonPlanIds) {
      if (!byLessonPlanId.has(lessonPlanId)) {
        byLessonPlanId.set(lessonPlanId, []);
      }

      byLessonPlanId.get(lessonPlanId).push(record);
    }
  }

  return { byHeaderId, byLessonPlanId };
}

function getMatchedHeaderRecords(courseFields, courseSetId, headerLookup) {
  const linkedHeaderIds = normalizeArray(courseFields["Connect Header Pages"]);

  const matchedByLinkedIds = linkedHeaderIds
    .map(id => headerLookup.byHeaderId.get(id))
    .filter(Boolean);

  if (matchedByLinkedIds.length) {
    return matchedByLinkedIds;
  }

  return headerLookup.byLessonPlanId.get(courseSetId) || [];
}

function buildCourseDescription(headerRecords) {
  const blocks = [];

  for (const record of headerRecords) {
    const fields = record.fields || {};

    blocks.push(
      normalizeRichText(fields["Course/Topic Description (LP)"]),
      normalizeRichText(fields["About_Export"])
    );
  }

  return textToHtml(joinNonEmptyBlocks(blocks));
}

function buildCourseIntroduction(headerRecords) {
  const blocks = [];

  for (const record of headerRecords) {
    const fields = record.fields || {};

    blocks.push(
      normalizeRichText(fields["General_Export"]),
      normalizeRichText(fields["Special_Export"]),
      normalizeRichText(fields["Term_Export"]),
      normalizeRichText(fields["Reminders_Export"])
    );
  }

  return textToHtml(joinNonEmptyBlocks(blocks));
}

function normalizeSubject(value) {
  const subjects = normalizeArray(value);
  return subjects.join(",");
}

function gradeTextToSyllabirdGrades(value) {
  const text = normalizeText(value);
  const grades = new Set();

  const gradeMap = [
    ["KINDERGARTEN", /\bK\b|kindergarten/i],
    ["FIRSTGRADE", /grade\s*1\b|\b1st\b/i],
    ["SECONDGRADE", /grade\s*2\b|\b2nd\b/i],
    ["THIRDGRADE", /grade\s*3\b|\b3rd\b/i],
    ["FOURTHGRADE", /grade\s*4\b|\b4th\b/i],
    ["FIFTHGRADE", /grade\s*5\b|\b5th\b/i],
    ["SIXTHGRADE", /grade\s*6\b|\b6th\b/i],
    ["SEVENTHGRADE", /grade\s*7\b|\b7th\b/i],
    ["EIGHTHGRADE", /grade\s*8\b|\b8th\b/i],
    ["NINTHGRADE", /grade\s*9\b|\b9th\b/i],
    ["TENTHGRADE", /grade\s*10\b|\b10th\b/i],
    ["ELEVENTHGRADE", /grade\s*11\b|\b11th\b/i],
    ["TWELFTHGRADE", /grade\s*12\b|\b12th\b/i]
  ];

  for (const [syllabirdGrade, regex] of gradeMap) {
    if (regex.test(text)) {
      grades.add(syllabirdGrade);
    }
  }

  // Handle ranges like Grades 4-6 or 7-8.
  const rangeMatch = text.match(/grades?\s*(\d+)\s*[-–]\s*(\d+)/i);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);

    const byNumber = {
      1: "FIRSTGRADE",
      2: "SECONDGRADE",
      3: "THIRDGRADE",
      4: "FOURTHGRADE",
      5: "FIFTHGRADE",
      6: "SIXTHGRADE",
      7: "SEVENTHGRADE",
      8: "EIGHTHGRADE",
      9: "NINTHGRADE",
      10: "TENTHGRADE",
      11: "ELEVENTHGRADE",
      12: "TWELFTHGRADE"
    };

    for (let grade = start; grade <= end; grade += 1) {
      if (byNumber[grade]) grades.add(byNumber[grade]);
    }
  }

  return `[${[...grades].map(grade => `'${grade}'`).join(", ")}]`;
}

function getDayText(fields, dayNumber) {
  return normalizeText(fields[`Day ${dayNumber}`]);
}

function inferDefaultDays(fields) {
  const dayValues = [1, 2, 3, 4, 5].map(dayNumber => getDayText(fields, dayNumber));
  let activeDays = dayValues.map(value => value.length > 0);

  // If the sample weekly view fields are blank, try a light fallback from Schedule Info.
  if (!activeDays.some(Boolean)) {
    const scheduleInfo = normalizeText(fields["Schedule Info."]);
    const match = scheduleInfo.match(/(\d+)\s*(?:days?|x)\s*(?:\/|per)?\s*week/i);
    const count = match ? Number(match[1]) : 1;

    activeDays = [0, 1, 2, 3, 4].map(index => index < Math.max(1, Math.min(count, 5)));
  }

  const [monday, tuesday, wednesday, thursday, friday] = activeDays;

  return {
    monday,
    tuesday,
    wednesday,
    thursday,
    friday
  };
}

function formatSyllabirdDays(days) {
  return [
    "{",
    `'monday': ${days.monday ? "True" : "False"}`,
    `'tuesday': ${days.tuesday ? "True" : "False"}`,
    `'wednesday': ${days.wednesday ? "True" : "False"}`,
    `'thursday': ${days.thursday ? "True" : "False"}`,
    `'friday': ${days.friday ? "True" : "False"}`,
    "}"
  ].join(", ");
}

function countActiveDays(days) {
  return Object.values(days).filter(Boolean).length || 1;
}

function getMaxWeekForCourse(fields, lessonDetailsById) {
  const lessonIds = normalizeArray(fields["Lessons"]);
  let maxWeek = 0;

  for (const lessonId of lessonIds) {
    const lessonRecord = lessonDetailsById.get(lessonId);
    if (!lessonRecord) continue;

    const week = Number(normalizeText(lessonRecord.fields?.["Week"]) || 0);
    if (week > maxWeek) maxWeek = week;
  }

  return maxWeek || 36;
}

function shouldExportCourse(record) {
  const fields = record.fields || {};
  const courseType = normalizeText(fields["Course Type"]);
  const lessonIds = normalizeArray(fields["Lessons"]);

  return (
    lessonIds.length > 0 &&
    (courseType === "Course" || courseType === "Topic")
  );
}

function buildCourseRow(record, headerLookup, lessonDetailsById) {
  const fields = record.fields || {};

  const setId = normalizeText(fields.setID) || record.id;
  const name = normalizeText(fields["Lesson Set Name"]);
  const matchedHeaderRecords = getMatchedHeaderRecords(fields, setId, headerLookup);

  const defaultDays = inferDefaultDays(fields);
  const numberOfDaysPerWeek = countActiveDays(defaultDays);
  const numberOfWeeks = getMaxWeekForCourse(fields, lessonDetailsById);

  return {
    course_custom_id: `alveary-${setId}`,
    course_name: name,
    course_numberOfDaysPerWeek: numberOfDaysPerWeek,
    course_numberOfWeeks: numberOfWeeks,
    course_subjects: normalizeSubject(fields["Subject"]),
    course_gradeYears: gradeTextToSyllabirdGrades(fields["Grade"] || fields["Grade Text"]),
    course_defaultDaysOfTheWeek: formatSyllabirdDays(defaultDays),
    course_gradingStyle: "UNGRADED",
    course_color: "",
    course_picture: "",
    course_credits: "",
    course_description: buildCourseDescription(matchedHeaderRecords),
    course_introduction: buildCourseIntroduction(matchedHeaderRecords)
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main() {
  const repoRoot = process.cwd();
  const exportDir = path.join(repoRoot, "exports", "syllabird");
  const outputPath = path.join(exportDir, "courses.csv");

  await ensureDir(exportDir);

  const courseRecords = await fetchAllRecords(
    LESSON_TABLE_NAME,
    LESSON_VIEW_NAME,
    COURSE_FIELDS
  );

  const headerRecords = await fetchAllRecords(
    HEADER_TABLE_NAME,
    HEADER_VIEW_NAME,
    HEADER_FIELDS
  );

  const lessonDetailRecords = await fetchAllRecords(
    LESSONS_TABLE_NAME,
    LESSONS_VIEW_NAME,
    LESSON_DETAIL_FIELDS
  );

  const headerLookup = buildHeaderLookup(headerRecords);
  const lessonDetailsById = new Map(
    lessonDetailRecords.map(record => [record.id, record])
  );

  const exportableRecords = courseRecords
    .filter(shouldExportCourse)
    .sort((a, b) => {
      const aSort = normalizeText(a.fields?.["Sort_ID"]);
      const bSort = normalizeText(b.fields?.["Sort_ID"]);

      if (aSort && bSort) return aSort.localeCompare(bSort);
      return normalizeText(a.fields?.["Lesson Set Name"]).localeCompare(
        normalizeText(b.fields?.["Lesson Set Name"])
      );
    });

  const rows = exportableRecords.map(record =>
    buildCourseRow(record, headerLookup, lessonDetailsById)
  );

  await fs.writeFile(outputPath, toCsv(rows), "utf8");

  console.log(`Built ${rows.length} Syllabird course row(s).`);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
