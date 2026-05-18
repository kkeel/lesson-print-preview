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
  "perWeek",
  "Syllabird Days",
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "Connect Header Pages",
  "Lessons",
  "Grade Filter",
  "Link Page",
  "Books",
  "Supplies",
  "Supply List Link",
  "Syllabird Status",
  "Syllabird Tracker Template"
];

const HEADER_FIELDS = [
  "headerID",
  "Connect Lesson Plans",
  "Course/Topic Description (LP)",
  "About_Export",
  "Combining & Placement Tips (LP)",
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

  const rawItems = Array.isArray(value)
    ? value
    : [value];

  return rawItems
    .flatMap(item =>
      String(item ?? "")
        .split("||")
        .map(part => part.trim())
    )
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

function htmlSection(title, content) {
  const body = normalizeRichText(content);
  if (!body) return "";

  return `<h2>${escapeHtml(title)}</h2>${textToHtml(body)}`;
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

function buildCourseDescription(headerRecords, courseFields) {
  const aboutBlocks = [];
  const placementBlocks = [];

  for (const record of headerRecords) {
    const fields = record.fields || {};

    aboutBlocks.push(
      normalizeRichText(fields["Course/Topic Description (LP)"]),
      normalizeRichText(fields["About_Export"])
    );

    placementBlocks.push(
      normalizeRichText(fields["Combining & Placement Tips (LP)"])
    );
  }

  const schedulingText = normalizeRichText(courseFields["Schedule Info."]);

  return [
    htmlSection("About the Course", joinNonEmptyBlocks(aboutBlocks)),
    htmlSection("Placement & Combining Tips", joinNonEmptyBlocks(placementBlocks)),
    htmlSection("Scheduling", schedulingText)
  ].filter(Boolean).join("");
}

function buildCourseIntroduction(headerRecords, courseFields) {
  const planningBlocks = [];

  for (const record of headerRecords) {
    const fields = record.fields || {};

    planningBlocks.push(
      normalizeRichText(fields["General_Export"]),
      normalizeRichText(fields["Special_Export"]),
      normalizeRichText(fields["Term_Export"]),
      normalizeRichText(fields["Reminders_Export"])
    );
  }

  return [
    htmlSection("Planning & Prep", joinNonEmptyBlocks(planningBlocks)),
  
    buildChecklistHtml(
      "Books & Resources",
      courseFields["Books"],
      courseFields["Link Page"]
    ),
  
    buildChecklistHtml(
      "Supplies",
      courseFields["Supplies"],
      courseFields["Supply List Link"]
    ),
  
    buildQuickLinksHtml(courseFields)
  
  ].filter(Boolean).join("");
}

function buildChecklistHtml(title, value, linkUrl = "") {
  const items = normalizeArray(value);

  if (!items.length && !linkUrl) return "";

  const checklist = items.length
    ? `<ul>${items.map(item =>
        `<li>☐ ${escapeHtml(item)}</li>`
      ).join("")}</ul>`
    : "";

  const linkHtml = linkUrl
    ? `<p><a href="${escapeHtml(linkUrl)}">Click this text for full ${escapeHtml(title)} details</a></p>`
    : "";

  return `
    <h2>${escapeHtml(title)}</h2>
    ${linkHtml}
    ${checklist}
  `;
}

function buildQuickLinksHtml(courseFields) {
  const linkPage = normalizeText(courseFields["Link Page"]);
  if (!linkPage) return "";

  return `<h2>Quick Links</h2><a href="${escapeHtml(linkPage)}">Click this text for course quick links</a>`;
}

function normalizeSubject(value) {
  const subjects = normalizeArray(value);
  return subjects.join(",");
}

function gradeFilterToSyllabirdGrades(value) {
  const text = Array.isArray(value)
    ? value.map(item => String(item ?? "")).join(",")
    : String(value ?? "");

  const map = {
    G1: "FIRSTGRADE",
    G2: "SECONDGRADE",
    G3: "THIRDGRADE",
    G4: "FOURTHGRADE",
    G5: "FIFTHGRADE",
    G6: "SIXTHGRADE",
    G7: "SEVENTHGRADE",
    G8: "EIGHTHGRADE",
    G9: "NINTHGRADE",
    G10: "TENTHGRADE",
    G11: "ELEVENTHGRADE",
    G12: "TWELFTHGRADE"
  };

  const matches = text.match(/G(?:10|11|12|[1-9])/g) || [];

  const converted = [...new Set(matches)]
    .map(grade => map[grade])
    .filter(Boolean);

  return `[${converted.map(grade => `'${grade}'`).join(", ")}]`;
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
  return `{'Monday': ${days.monday ? "True" : "False"}, 'Tuesday': ${days.tuesday ? "True" : "False"}, 'Wednesday': ${days.wednesday ? "True" : "False"}, 'Thursday': ${days.thursday ? "True" : "False"}, 'Friday': ${days.friday ? "True" : "False"}, 'Saturday': False, 'Sunday': False}`;
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

  const trackerTemplate = normalizeRichText(
    fields["Syllabird Tracker Template"]
  );

  const syllabirdStatus = normalizeText(
    fields["Syllabird Status"]
  );

  if (syllabirdStatus === "Do Not Import") {
    return false;
  }

  return (
    (lessonIds.length > 0 || trackerTemplate) &&
    (courseType === "Course" || courseType === "Topic")
  );
}

function buildCourseRow(record, headerLookup, lessonDetailsById) {
  const fields = record.fields || {};

  const setId = normalizeText(fields.setID) || record.id;
  const name = normalizeText(fields["Lesson Set Name"]);
  const matchedHeaderRecords = getMatchedHeaderRecords(fields, setId, headerLookup);

  const defaultDays = inferDefaultDays(fields);

  const numberOfDaysPerWeek =
    Number(normalizeText(fields["perWeek"]) || 0) ||
    countActiveDays(defaultDays);
  
  const syllabirdDays =
    normalizeText(fields["Syllabird Days"]) ||
    formatSyllabirdDays(defaultDays);
  
  const numberOfWeeks = getMaxWeekForCourse(fields, lessonDetailsById);

  return {
    course_custom_id: `alveary-${record.id}`,
    course_name: name,
    course_numberOfDaysPerWeek: numberOfDaysPerWeek,
    course_numberOfWeeks: numberOfWeeks,
    course_subjects: normalizeSubject(fields["Subject"]),
    course_gradeYears: gradeFilterToSyllabirdGrades(fields["Grade Filter"]),
    course_defaultDaysOfTheWeek: syllabirdDays,
    course_gradingStyle: "UNGRADED",
    course_color: "",
    course_picture: "",
    course_credits: "",
    course_description: buildCourseDescription(matchedHeaderRecords, fields),
    course_introduction: buildCourseIntroduction(matchedHeaderRecords, fields)
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
