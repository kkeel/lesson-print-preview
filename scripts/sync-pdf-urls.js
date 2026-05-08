import fs from "fs";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const TABLE_NAME = "Lesson Plan Sets";
const PDF_FIELD_NAME = "PDF Link URL";
const PUBLIC_PDF_BASE_URL = "https://planning.alveary.org/pdf/lesson-plans";

const INDEX_PATH = "./data/packet-index.json";

if (!AIRTABLE_TOKEN) throw new Error("Missing AIRTABLE_TOKEN");
if (!AIRTABLE_BASE_ID) throw new Error("Missing AIRTABLE_BASE_ID");
if (!fs.existsSync(INDEX_PATH)) throw new Error(`Missing ${INDEX_PATH}`);

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function updateBatch(records) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ records })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtable update failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function main() {
  const packets = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));

  const records = packets.map(packet => {
    const slug = slugify(packet.lessonSetName || packet.title || packet.id);
    const filename = `${packet.id}-${slug}.pdf`;
    const pdfUrl = `${PUBLIC_PDF_BASE_URL}/${filename}`;

    return {
      id: packet.id,
      fields: {
        [PDF_FIELD_NAME]: pdfUrl
      }
    };
  });

  const batches = chunkArray(records, 10);

  console.log(`Updating ${records.length} Airtable records...`);

  for (const [index, batch] of batches.entries()) {
    await updateBatch(batch);
    console.log(`Updated batch ${index + 1} of ${batches.length}`);
  }

  console.log("Done syncing PDF URLs to Airtable.");
}

main();
