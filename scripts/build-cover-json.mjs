import fs from "node:fs/promises";
import path from "node:path";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const LESSON_TABLE_NAME = "Lesson Plan Sets";
const LESSON_VIEW_NAME = "Cover Page";

const HEADER_TABLE_NAME = "Header Pages";
const HEADER_VIEW_NAME = "Header Print";

const LESSON_FIELDS = [
  "Lesson Set Name",
  "setID",
  "Cover Title",
  "Cover Subtitle",
  "Grade Text",
  "Subject",
  "Sort_ID",
  "Course Connection",
  "Topic Connection",
  "Course Connection Lookup",
  "Topic Connection Lookup",
  "Connect Header Pages",
  "Grade",
  "Schedule Info.",
  "Books",
  "Book List Link",
  "SS Row Lables",
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5"
];

const HEADER_FIELDS = [
  "headerID",
  "Connect Lesson Plans",
  "Subject",
  "Course/Topic Description (LP)",
  "About_Export",
  "Combining & Placement Tips (LP)",
  "General_Export",
  "Special_Export",
  "Term_Export",
  "Reminders_Export"
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

    if (!data.offset) {
      break;
    }

    offset = data.offset;
  }

  return allRecords;
}

function normalizeText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value).trim();
}

function normalizeLineBreakText(value) {
  if (value == null) return "";

  if (Array.isArray(value)) {
    return value
      .map(item => String(item ?? "").trim())
      .filter(item => item && item.toLowerCase() !== "null")
      .join("\n");
  }

  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";
  return text;
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

function normalizeArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map(item => String(item).trim())
      .filter(Boolean);
  }
  return String(value)
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function splitWeeklyRollup(value) {
  if (value == null) return [];

  return String(value)
    .split("||")
    .map(item => item.trim());
}

function normalizeSubject(value) {
  const arr = normalizeArray(value);
  return arr[0] || "";
}

function joinNonEmptyBlocks(blocks) {
  return blocks
    .map(block => String(block ?? "").trim())
    .filter(block => block && block.toLowerCase() !== "null")
    .join("\n\n");
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

function getMatchedHeaderRecords(lessonFields, lessonSetId, headerLookup) {
  const linkedHeaderIds = normalizeArray(lessonFields["Connect Header Pages"]);

  const matchedByLinkedIds = linkedHeaderIds
    .map(id => headerLookup.byHeaderId.get(id))
    .filter(Boolean);

  if (matchedByLinkedIds.length) {
    return matchedByLinkedIds;
  }

  return headerLookup.byLessonPlanId.get(lessonSetId) || [];
}

function buildAboutEntries(headerRecords) {
  const entries = [];

  for (const record of headerRecords) {
    const fields = record.fields || {};

    const courseTopicDescription = normalizeRichText(fields["Course/Topic Description (LP)"]);
    const aboutExport = normalizeRichText(fields["About_Export"]);

    const combinedContent = joinNonEmptyBlocks([
      courseTopicDescription,
      aboutExport
    ]);

    if (!combinedContent) continue;

    entries.push({
      title: "About the Course",
      content: combinedContent
    });
  }

  return entries;
}

const PLANNING_PREP_DISCLAIMER = [
  "Permission to print for non-commercial use. See Alveary group use policy to use lessons\nin a group context.",
  "LINKS: Click text or scan the QR code in the top corner of the lesson plan pages to view\nonline resources associated with the lessons.",
  "Responsibility for previewing all links rests with the teacher. All links were checked at the\ntime of publication; however, websites change frequently and may contain objectionable\ncontent. Please report broken links by contacting us through our website."
].join("\n\n");

function buildPlacementEntries(headerRecords) {
  const entries = [];

  for (const record of headerRecords) {
    const fields = record.fields || {};

    const content = normalizeRichText(fields["Combining & Placement Tips (LP)"]);
    if (!content) continue;

    entries.push({
      title: "Placement & Combining Tips",
      content
    });
  }

  return entries;
}

function buildPlanningPrepEntries(headerRecords) {
  const entries = [];

  for (const record of headerRecords) {
    const fields = record.fields || {};

    const generalExport = normalizeRichText(fields["General_Export"]);
    const specialExport = normalizeRichText(fields["Special_Export"]);
    const termExport = normalizeRichText(fields["Term_Export"]);
    const remindersExport = normalizeRichText(fields["Reminders_Export"]);

    const recordEntries = [
      {
        title: "",
        content: PLANNING_PREP_DISCLAIMER
      }
    ];

    if (generalExport) {
      recordEntries.push({
        title: "",
        content: generalExport
      });
    }

    if (specialExport) {
      recordEntries.push({
        title: "Special Topics & Field Trips",
        content: specialExport
      });
    }

    if (termExport) {
      recordEntries.push({
        title: "Term Prep & Teacher Tips",
        content: termExport
      });
    }

    if (remindersExport) {
      recordEntries.push({
        title: "Reminders",
        content: remindersExport
      });
    }

    entries.push(...recordEntries);
  }

  return entries;
}

function buildHeaderItems(headerRecords) {
  const aboutEntries = buildAboutEntries(headerRecords);
  const placementEntries = buildPlacementEntries(headerRecords);
  const planningPrepEntries = buildPlanningPrepEntries(headerRecords);

  const items = [];

  if (aboutEntries.length) {
    items.push({
      kind: "about-group",
      title: "About the Course",
      entries: aboutEntries
    });
  }

  if (placementEntries.length) {
    items.push({
      kind: "tips-group",
      title: "Placement & Combining Tips",
      entries: placementEntries
    });
  }

  if (planningPrepEntries.length) {
    items.push({
      kind: "planning-prep-group",
      title: "Planning & Prep",
      entries: planningPrepEntries
    });
  }

  return items;
}

function buildSchedulingRows(packetRecord, allLessonRecordsById) {
  const rows = [];

  const fields = packetRecord.fields || {};

  const grade = normalizeText(fields["Grade"]);
  const scheduleInfo = normalizeLineBreakText(fields["Schedule Info."]);
  const books = normalizeLineBreakText(fields["Books"]);

  const topicIds = normalizeArray(fields["Topic Connection"]);
  const isTopic = normalizeArray(fields["Course Connection"]).length > 0;

  // -----------------------------
  // 1. TOPIC PACKET
  // -----------------------------
  if (isTopic) {
    rows.push({
      rowType: "topic-packet",
      label: normalizeText(fields["Lesson Set Name"]),
      grade,
      scheduleInfo,
      books
    });
    return rows;
  }

  // -----------------------------
  // 2. STANDALONE COURSE
  // -----------------------------
  if (!topicIds.length) {
    rows.push({
      rowType: "standalone-course",
      label: normalizeText(fields["Lesson Set Name"]),
      grade,
      scheduleInfo,
      books
    });
    return rows;
  }

  // -----------------------------
  // 3. COURSE WITH TOPICS
  // -----------------------------
  let hasTopicRows = false;

  for (const topicId of topicIds) {
    const topicRecord = allLessonRecordsById.get(topicId);
    if (!topicRecord) continue;

    const tf = topicRecord.fields || {};

    const tGrade = normalizeText(tf["Grade"]);
    const tSchedule = normalizeLineBreakText(tf["Schedule Info."]);
    const tBooks = normalizeLineBreakText(tf["Books"]);

    if (!tGrade && !tSchedule && !tBooks) continue;

    hasTopicRows = true;

    rows.push({
      rowType: "topic",
      label: normalizeText(tf["Lesson Set Name"]),
      grade: tGrade,
      scheduleInfo: tSchedule,
      books: tBooks
    });
  }

  // -----------------------------
  // 4. HYBRID COURSE (shared books)
  // -----------------------------
  if (hasTopicRows && books) {
    rows.push({
      rowType: "course-books",
      label: normalizeText(fields["Lesson Set Name"]),
      grade: "",
      scheduleInfo: "Shared course resources",
      books
    });
  }

  return rows;
}

function splitBooks(value) {
  const text = normalizeLineBreakText(value);
  if (!text) return [];

  if (text.includes("||")) {
    return text
      .split("||")
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (text.includes("\n")) {
    return text
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [text];
}

function uniqueBooks(books) {
  const seen = new Set();
  const result = [];

  for (const book of books) {
    const key = String(book || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(book);
  }

  return result;
}

function buildBooksResources(packetRecord, allLessonRecordsById) {
  const fields = packetRecord.fields || {};

  const linkUrl = normalizeText(fields["Book List Link"]);
  const lessonSetName = normalizeText(fields["Lesson Set Name"]);
  const courseBooks = splitBooks(fields["Books"]);

  const courseIds = normalizeArray(fields["Course Connection"]);
  const topicIds = normalizeArray(fields["Topic Connection"]);
  const isTopic = courseIds.length > 0;

  const groups = [];

  // -----------------------------
  // 1. TOPIC PACKET
  // Include parent course-level books, but do NOT show course header.
  // De-dupe so music PDFs/resources do not repeat.
  // -----------------------------
  if (isTopic) {
    const parentCourseBooks = [];

    for (const courseId of courseIds) {
      const courseRecord = allLessonRecordsById.get(courseId);
      if (!courseRecord) continue;

      parentCourseBooks.push(...splitBooks(courseRecord.fields?.["Books"]));
    }

    const combinedBooks = uniqueBooks([
      ...parentCourseBooks,
      ...courseBooks
    ]);

    if (combinedBooks.length) {
      groups.push({
        title: lessonSetName,
        type: "topic",
        books: combinedBooks
      });
    }
  }

  // -----------------------------
  // 2. STANDALONE COURSE
  // -----------------------------
  else if (!topicIds.length) {
    groups.push({
      title: lessonSetName,
      type: "course",
      books: uniqueBooks(courseBooks)
    });
  }

  // -----------------------------
  // 3. COURSE WITH TOPICS
  // Always show the course heading, even if no course-level books.
  // -----------------------------
  else {
    groups.push({
      title: lessonSetName,
      type: "course",
      books: uniqueBooks(courseBooks)
    });

    for (const topicId of topicIds) {
      const topicRecord = allLessonRecordsById.get(topicId);
      if (!topicRecord) continue;

      const topicFields = topicRecord.fields || {};
      const topicTitle = normalizeText(topicFields["Lesson Set Name"]);
      const topicBooks = uniqueBooks(splitBooks(topicFields["Books"]));

      if (!topicBooks.length) continue;

      groups.push({
        title: topicTitle,
        type: "topic",
        books: topicBooks
      });
    }
  }

  if (!groups.length && !linkUrl) return null;

  return {
    kind: "books-resources",
    title: "Books & Resources",
    linkUrl,
    groups
  };
}

function buildWeeklyView(record) {
  const fields = record.fields || {};

  const labels = splitWeeklyRollup(fields["SS Row Lables"]);
  const day1 = splitWeeklyRollup(fields["Day 1"]);
  const day2 = splitWeeklyRollup(fields["Day 2"]);
  const day3 = splitWeeklyRollup(fields["Day 3"]);
  const day4 = splitWeeklyRollup(fields["Day 4"]);
  const day5 = splitWeeklyRollup(fields["Day 5"]);

  const rowCount = Math.max(
    labels.length,
    day1.length,
    day2.length,
    day3.length,
    day4.length,
    day5.length
  );

  const rows = [];

  for (let i = 0; i < rowCount; i += 1) {
    const label = labels[i] ?? "";
    const days = [
      day1[i] ?? "",
      day2[i] ?? "",
      day3[i] ?? "",
      day4[i] ?? "",
      day5[i] ?? ""
    ];

    if (!label && days.every(day => !day)) continue;

    rows.push({ label, days });
  }

  return rows.length ? { rows } : null;
}

function buildPacket(record, headerLookup) {
  const fields = record.fields || {};

  const setId = normalizeText(fields.setID) || record.id;
  const lessonSetName = normalizeText(fields["Lesson Set Name"]);
  const coverTitle = normalizeText(fields["Cover Title"]) || lessonSetName;
  const coverSubtitle = normalizeText(fields["Cover Subtitle"]);
  const gradeText = normalizeText(fields["Grade Text"]);
  const subject = normalizeSubject(fields["Subject"]);
  const sortId = normalizeText(fields["Sort_ID"]);

  const courseConnectionIds = normalizeArray(fields["Course Connection"]);
  const topicConnectionIds = normalizeArray(fields["Topic Connection"]);
  const courseConnectionNames = normalizeArray(fields["Course Connection Lookup"]);
  const topicConnectionNames = normalizeArray(fields["Topic Connection Lookup"]);

  const isTopicRow = courseConnectionIds.length > 0;
  const hasTopics = topicConnectionIds.length > 0;
  const isStandaloneCourse = !isTopicRow && !hasTopics;

  const matchedHeaderRecords = getMatchedHeaderRecords(fields, setId, headerLookup);
  const headerItems = buildHeaderItems(matchedHeaderRecords);

  return {
    id: setId,
    title: coverTitle,
    lessonSetName,
    subject,
    sortId,
    gradeText,
    rowType: isTopicRow ? "topic" : "course",
    hasTopics,
    isStandaloneCourse,
    courseConnectionIds,
    topicConnectionIds,
    courseConnectionNames,
    topicConnectionNames,
    templateType: "standard",
    sections: [
      {
        type: "cover",
        title: coverTitle,
        subtitle: coverSubtitle,
        gradeText,
        subject,
        sortId
      },
      {
        type: "header",
        items: [
          ...headerItems.filter(item => item.kind !== "planning-prep-group"),
        
          {
            kind: "scheduling",
            title: "Scheduling",
            rows: buildSchedulingRows(record, headerLookup.lessonRecordsById || new Map()),
            weeklyView: buildWeeklyView(record)
          },
        
          ...headerItems.filter(item => item.kind === "planning-prep-group"),
        
          buildBooksResources(record, headerLookup.lessonRecordsById || new Map())
        ].filter(Boolean)
      }
    ]
  };
}

function buildIndexItem(packet) {
  return {
    id: packet.id,
    title: packet.title,
    lessonSetName: packet.lessonSetName,
    subtitle: packet.sections?.[0]?.subtitle || "",
    gradeText: packet.gradeText || "",
    subject: packet.subject || "",
    sortId: packet.sortId || "",
    rowType: packet.rowType || "",
    hasTopics: !!packet.hasTopics,
    isStandaloneCourse: !!packet.isStandaloneCourse,
    courseConnectionNames: packet.courseConnectionNames || [],
    topicConnectionNames: packet.topicConnectionNames || [],
    previewUrl: `./preview/index.html?id=${encodeURIComponent(packet.id)}`
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function main() {
  const repoRoot = process.cwd();
  const dataDir = path.join(repoRoot, "data");
  const packetsDir = path.join(dataDir, "packets");

  await ensureDir(dataDir);
  await ensureDir(packetsDir);

  const lessonRecords = await fetchAllRecords(
    LESSON_TABLE_NAME,
    LESSON_VIEW_NAME,
    LESSON_FIELDS
  );

  const lessonRecordsById = new Map(
    lessonRecords.map(r => [r.id, r])
  );

  const headerRecords = await fetchAllRecords(
    HEADER_TABLE_NAME,
    HEADER_VIEW_NAME,
    HEADER_FIELDS
  );

  const headerLookup = buildHeaderLookup(headerRecords);
  headerLookup.lessonRecordsById = lessonRecordsById;

  const packets = lessonRecords.map(record => buildPacket(record, headerLookup));
  const index = packets.map(buildIndexItem);

  for (const packet of packets) {
    const filePath = path.join(packetsDir, `${packet.id}.json`);
    await writeJson(filePath, packet);
  }

  await writeJson(path.join(dataDir, "packet-index.json"), index);

  console.log(`Built ${packets.length} packet JSON file(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
