import fs from "node:fs/promises";
import path from "node:path";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const LESSONS_TABLE_NAME = "Lessons";
const LESSONS_VIEW_NAME = "Figure Things Out";

const OUTPUT_DIR = "./data/history-charts";

const LESSON_FIELDS = [
  "Lesson Title",
  "lessonID",
  "setID (from Lesson Plan Sets)",
  "Lesson Set Title",
  "Country Label",
  "Grade Filter",
  "Term",
  "Week",
  "Week:",
  "Teacher Notes",
  "History Chart Prompts"
];

if (!AIRTABLE_TOKEN) throw new Error("Missing AIRTABLE_TOKEN.");
if (!AIRTABLE_BASE_ID) throw new Error("Missing AIRTABLE_BASE_ID.");

async function fetchAllRecords(tableName, viewName, fields) {
  const allRecords = [];
  let offset = "";

  while (true) {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
    );

    if (viewName) url.searchParams.set("view", viewName);

    for (const field of fields) {
      url.searchParams.append("fields[]", field);
    }

    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable request failed: ${response.status} ${await response.text()}`);
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

function normalizeNumber(value) {
  const num = Number(normalizeText(value));
  return Number.isFinite(num) ? num : 0;
}

function parseGrades(value) {
  return normalizeText(value)
    .split(",")
    .map(item => item.trim().toUpperCase())
    .map(item => item.replace(/^G/, ""))
    .filter(item => ["4", "5", "6", "7", "8"].includes(item));
}

function getCountryTargets(countryLabel) {
  const label = normalizeText(countryLabel).toLowerCase();

  if (label.includes("u.s") || label === "us") return ["us"];
  if (label.includes("canada")) return ["canada"];

  return ["us", "canada"];
}

function extractImportantDatesBlocks(teacherNotes) {
  const text = normalizeText(teacherNotes);
  if (!text) return [];

  const normalized = text.replace(/\r\n/g, "\n");

  const markerRegex = /(?:^|\n)\s*[•*-]?\s*IMPORTANT DATES\s*\n/gi;
  const matches = [...normalized.matchAll(markerRegex)];

  if (!matches.length) return [];

  const blocks = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length
      ? matches[i + 1].index
      : normalized.length;

    let block = normalized.slice(start, end).trim();

    // Stop if another teacher-note heading starts after the important dates text.
    block = block
      .split(/\n\s*(?:★|•)\s*[A-Z][A-Z\s&/.-]{2,}\s*\n/)[0]
      .trim();

    if (block) blocks.push(block);
  }

  return blocks;
}

function emptyChart(grade, country) {
  return {
    grade: Number(grade),
    country,
    title: `Important Dates Grade ${grade} (${country === "us" ? "U.S." : "Canada"})`,
    terms: []
  };
}

function addEntry(chart, entry) {
  let term = chart.terms.find(t => t.termNumber === entry.termNumber);

  if (!term) {
    term = {
      termNumber: entry.termNumber,
      termLabel: `Term ${entry.termNumber}`,
      weeks: []
    };
    chart.terms.push(term);
  }

  let week = term.weeks.find(w => w.weekNumber === entry.weekNumber);

  if (!week) {
    week = {
      weekNumber: entry.weekNumber,
      weekLabel: entry.weekLabel || `Week ${entry.weekNumber}`,
      items: []
    };
    term.weeks.push(week);
  }

  week.items.push({
    lessonId: entry.lessonId,
    lessonTitle: entry.lessonTitle,
    lessonSetTitle: entry.lessonSetTitle,
    text: entry.text
  });
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const records = await fetchAllRecords(
    LESSONS_TABLE_NAME,
    LESSONS_VIEW_NAME,
    LESSON_FIELDS
  );

  const charts = new Map();
  const seen = new Set();

  for (const record of records) {
    const fields = record.fields || {};

    const hasHistoryPrompt = normalizeText(fields["History Chart Prompts"])
      .toLowerCase()
      .includes("important dates");

    if (!hasHistoryPrompt) continue;

    const importantDateBlocks = extractImportantDatesBlocks(fields["Teacher Notes"]);
    if (!importantDateBlocks.length) continue;

    const grades = parseGrades(fields["Grade Filter"]);
    const countries = getCountryTargets(fields["Country Label"]);

    const lessonId = normalizeText(fields["lessonID"]) || record.id;
    const lessonTitle = normalizeText(fields["Lesson Title"]);
    const lessonSetTitle = normalizeText(fields["Lesson Set Title"]);
    const termNumber = normalizeNumber(fields["Term"]);
    const weekNumber = normalizeNumber(fields["Week"]);
    const weekLabel = normalizeText(fields["Week:"]);

    for (const grade of grades) {
      for (const country of countries) {
        const chartKey = `grade-${grade}-${country}`;

        if (!charts.has(chartKey)) {
          charts.set(chartKey, emptyChart(grade, country));
        }

        for (const text of importantDateBlocks) {
          const dedupeKey = [
            chartKey,
            lessonId,
            text.toLowerCase().replace(/\s+/g, " ")
          ].join("|");

          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          addEntry(charts.get(chartKey), {
            lessonId,
            lessonTitle,
            lessonSetTitle,
            termNumber,
            weekNumber,
            weekLabel,
            text
          });
        }
      }
    }
  }

  for (const chart of charts.values()) {
    chart.terms.sort((a, b) => a.termNumber - b.termNumber);

    for (const term of chart.terms) {
      term.weeks.sort((a, b) => a.weekNumber - b.weekNumber);

      for (const week of term.weeks) {
        week.items.sort((a, b) =>
          String(a.lessonSetTitle).localeCompare(String(b.lessonSetTitle))
        );
      }
    }

    const filename = `grade-${chart.grade}-${chart.country}.json`;
    await fs.writeFile(
      path.join(OUTPUT_DIR, filename),
      JSON.stringify(chart, null, 2)
    );

    console.log(`Wrote ${filename}`);
  }

  console.log(`Built ${charts.size} history chart JSON file(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
