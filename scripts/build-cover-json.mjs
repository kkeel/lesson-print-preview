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
  "Connect Header Pages"
];

const HEADER_FIELDS = [
  "headerID",
  "Connect Lesson Plans",
  "Subject",
  "Course/Topic Description (LP)",
  "About_Export",
  "Combining & Placement Tips (LP)"
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

function normalizeSubject(value) {
  const arr = normalizeArray(value);
  return arr[0] || "";
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

function buildAboutEntries(headerRecords, lessonSetName, coverTitle) {
  const entries = [];

  for (const record of headerRecords) {
    const fields = record.fields || {};
    const label =
      normalizeText(fields["Course/Topic Description (LP)"]) ||
      normalizeText(fields["Subject"]);
    const content = normalizeText(fields["About_Export"]);

    if (!content) continue;

    const normalizedLabel = label.trim().toLowerCase();
    const normalizedLessonSet = lessonSetName.trim().toLowerCase();
    const normalizedCoverTitle = coverTitle.trim().toLowerCase();

    const isPrimary =
      normalizedLabel === normalizedLessonSet ||
      normalizedLabel === normalizedCoverTitle;

    entries.push({
      title: isPrimary || !label ? "About the Course" : `About ${label}`,
      label,
      content
    });
  }

  return entries;
}

function buildPlacementEntries(headerRecords) {
  const entries = [];

  for (const record of headerRecords) {
    const fields = record.fields || {};
    const label =
      normalizeText(fields["Course/Topic Description (LP)"]) ||
      normalizeText(fields["Subject"]);
    const content = normalizeText(fields["Combining & Placement Tips (LP)"]);

    if (!content) continue;

    entries.push({
      title: label || "Placement & Combining Tips",
      label,
      content
    });
  }

  return entries;
}

function buildHeaderItems(headerRecords, lessonSetName, coverTitle) {
  const aboutEntries = buildAboutEntries(headerRecords, lessonSetName, coverTitle);
  const placementEntries = buildPlacementEntries(headerRecords);

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

  return items;
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
  const headerItems = buildHeaderItems(matchedHeaderRecords, lessonSetName, coverTitle);

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
        items: headerItems
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

  const headerRecords = await fetchAllRecords(
    HEADER_TABLE_NAME,
    HEADER_VIEW_NAME,
    HEADER_FIELDS
  );

  const headerLookup = buildHeaderLookup(headerRecords);

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
