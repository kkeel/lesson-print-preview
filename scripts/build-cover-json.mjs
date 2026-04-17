import fs from "node:fs/promises";
import path from "node:path";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Update these only if your names differ
const TABLE_NAME = "Lesson Plan Sets";
const VIEW_NAME = "Cover Page";

const FIELDS = [
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
  "Topic Connection Lookup"
];

if (!AIRTABLE_TOKEN) {
  throw new Error("Missing AIRTABLE_TOKEN environment variable.");
}

if (!AIRTABLE_BASE_ID) {
  throw new Error("Missing AIRTABLE_BASE_ID environment variable.");
}

async function fetchAllRecords() {
  const allRecords = [];
  let offset = "";

  while (true) {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`
    );

    url.searchParams.set("view", VIEW_NAME);

    for (const field of FIELDS) {
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

function buildPacket(record) {
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

  // Replace these two field names if your lookup fields are named differently
  const courseConnectionNames = normalizeArray(fields["Course Connection Lookup"]);
  const topicConnectionNames = normalizeArray(fields["Topic Connection Lookup"]);

  const isTopicRow = courseConnectionIds.length > 0;
  const hasTopics = topicConnectionIds.length > 0;
  const isStandaloneCourse = !isTopicRow && !hasTopics;

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
          {
            kind: "text",
            title: "About the Course",
            content: ""
          }
        ]
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

  const records = await fetchAllRecords();

  const packets = records.map(buildPacket);
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
