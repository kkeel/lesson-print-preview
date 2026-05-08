// scripts/syllabird/buildOut.mjs

import fs from "node:fs/promises";
import path from "node:path";

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

      if (row.some(cell => cell !== "")) {
        rows.push(row);
      }

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

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(","))
  ].join("\n") + "\n";
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function main() {
  const repoRoot = process.cwd();
  const exportDir = path.join(repoRoot, "exports", "syllabird");

  const coursesPath = path.join(exportDir, "courses.csv");
  const assignmentsPath = path.join(exportDir, "assignments.csv");
  const outputPath = path.join(exportDir, "out.csv");

  const courses = parseCsv(await readText(coursesPath));
  const assignments = parseCsv(await readText(assignmentsPath));

  const coursesById = new Map(
    courses.map(course => [course.course_custom_id, course])
  );

  const courseHeaders = courses.length ? Object.keys(courses[0]) : [];
  const assignmentHeaders = assignments.length ? Object.keys(assignments[0]) : [];

  const headers = [
    ...courseHeaders,
    ...assignmentHeaders.filter(header => !courseHeaders.includes(header))
  ];

  const rows = assignments.map(assignment => {
    const course = coursesById.get(assignment.course_custom_id) || {};

    return {
      ...course,
      ...assignment
    };
  });

  await fs.writeFile(outputPath, toCsv(headers, rows), "utf8");

  console.log(`Built ${rows.length} Syllabird combined row(s).`);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
