import fs from "node:fs/promises";
import path from "node:path";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const LESSON_TABLE_NAME = "Lesson Plan Sets";
const LESSON_VIEW_NAME = "Cover Page";

const HEADER_TABLE_NAME = "Header Pages";
const HEADER_VIEW_NAME = "Header Print";

const QUICK_LINKS_TABLE_NAME = "Quick Links";
const QUICK_LINKS_VIEW_NAME = "Grid view";

const HOW_TO_TABLE_NAME = "How To Pages";
const HOW_TO_VIEW_NAME = "Grid view";

const HOW_TO_IMAGE_TABLE_NAME = "How To Image Bank";
const HOW_TO_IMAGE_VIEW_NAME = "Grid view";

const LESSONS_TABLE_NAME = "Lessons";
const LESSONS_VIEW_NAME = "Grid view";

const COURSE_LESSONS_TABLE_NAME = "Course Lessons";
const COURSE_LESSONS_VIEW_NAME = "Grid view";

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
  "Header Edit URL",
  "Grade",
  "Schedule Info.",
  "Books",
  "Resource IDs",
  "Book List Link",
  "Supplies",
  "Supply IDs",
  "Supply List Link",
  "Link Page",
  "SS Row Lables",
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "How To Pages",
  "Lessons",
  "Term 1 Exams",
  "Term 2 Exams",
  "Term 3 Exams"
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
  "Reminders_Export",
  "Quick Links Connections"
];

const QUICK_LINK_FIELDS = [
  "Link Label",
  "Link URL",
  "Quick Link Sort"
];

const HOW_TO_FIELDS = [
  "Teach/Approach",
  "How To Edit URL",
  ...Array.from({ length: 15 }, (_, i) => `Prompt ${i + 1}`),
  ...Array.from({ length: 15 }, (_, i) => `Text ${i + 1}`),
  ...Array.from({ length: 15 }, (_, i) => `Image ID ${i + 1}`)
];

const LESSON_DETAIL_FIELDS = [
  "Term",
  "Week",
  "Week:",
  "Lesson Sequence",
  "Lesson Label",
  "Lesson Title",
  "Lesson Body",
  "Teacher Notes",
  "Lesson_WritingURL",
  "URL 1",
  "URL 2",
  "URL 3",
  "URL 4",
  "URL 5",
  "Text 1",
  "Text 2",
  "Text 3",
  "Text 4",
  "Text 5"
];

const COURSE_LESSON_FIELDS = [
  "Course",
  "Term",
  "Week",
  "Week Label",
  "Slot Order",
  "Lesson Sequence",
  "Sort",
  "Lesson Title",
  "Lesson Body",
  "Teacher Notes",
  "Lesson_WritingURL",
  "URL 1",
  "URL 2",
  "URL 3",
  "URL 4",
  "URL 5",
  "Text 1",
  "Text 2",
  "Text 3",
  "Text 4",
  "Text 5"
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

function splitResourceIds(value) {
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

function pairBooksWithIds(bookTitles, resourceIds) {
  return bookTitles.map((title, index) => ({
    title,
    resourceId: resourceIds[index] || ""
  }));
}

function uniqueBookObjects(books) {
  const seen = new Set();
  const result = [];

  for (const book of books) {
    const key = String(book?.title || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(book);
  }

  return sortBookResources(result);
}

function ourWorkSortValue(book) {
  const text = String(book || "");

  if (!text.toLowerCase().startsWith("our work:")) {
    return 999;
  }

  if (text.includes("Grades 1-2")) return 1;
  if (text.includes("Grade 3")) return 3;
  if (text.includes("Grades 4-6")) return 4;
  if (text.includes("Grades 7-8")) return 7;
  if (text.includes("Grades 9-12")) return 9;

  return 998;
}

function sortBookResources(books) {
  return [...books].sort((a, b) => {
    const aTitle = typeof a === "string" ? a : a.title;
    const bTitle = typeof b === "string" ? b : b.title;

    const aIsOurWork = String(aTitle).toLowerCase().startsWith("our work:");
    const bIsOurWork = String(bTitle).toLowerCase().startsWith("our work:");

    if (aIsOurWork && bIsOurWork) {
      return ourWorkSortValue(aTitle) - ourWorkSortValue(bTitle);
    }

    if (aIsOurWork) return -1;
    if (bIsOurWork) return 1;

    return 0;
  });
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

  return sortBookResources(result);
}

function getBookObjectsFromRecord(record) {
  const fields = record?.fields || {};
  const titles = splitBooks(fields["Books"]);
  const ids = splitResourceIds(fields["Resource IDs"]);

  return pairBooksWithIds(titles, ids);
}

function buildBooksResources(packetRecord, allLessonRecordsById) {
  const fields = packetRecord.fields || {};

  const linkUrl = normalizeText(fields["Book List Link"]);
  const lessonSetName = normalizeText(fields["Lesson Set Name"]);
  const courseBooks = getBookObjectsFromRecord(packetRecord);

  const courseIds = normalizeArray(fields["Course Connection"]);
  const topicIds = normalizeArray(fields["Topic Connection"]);
  const isTopic = courseIds.length > 0;

  const groups = [];

  if (isTopic) {
    const parentCourseBooks = [];

    for (const courseId of courseIds) {
      const courseRecord = allLessonRecordsById.get(courseId);
      if (!courseRecord) continue;

      parentCourseBooks.push(...getBookObjectsFromRecord(courseRecord));
    }

    const combinedBooks = uniqueBookObjects([
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

  else if (!topicIds.length) {
    groups.push({
      title: lessonSetName,
      type: "course",
      books: uniqueBookObjects(courseBooks)
    });
  }

  else {
    groups.push({
      title: lessonSetName,
      type: "course",
      books: uniqueBookObjects(courseBooks)
    });

    for (const topicId of topicIds) {
      const topicRecord = allLessonRecordsById.get(topicId);
      if (!topicRecord) continue;

      const topicFields = topicRecord.fields || {};
      const topicTitle = normalizeText(topicFields["Lesson Set Name"]);
      const topicBooks = uniqueBookObjects(getBookObjectsFromRecord(topicRecord));

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

function splitSupplies(value) {
  return splitBooks(value);
}

function splitSupplyIds(value) {
  return splitResourceIds(value);
}

function pairSuppliesWithIds(supplyTitles, supplyIds) {
  return supplyTitles.map((title, index) => ({
    title,
    supplyId: supplyIds[index] || ""
  }));
}

function uniqueSupplyObjects(supplies) {
  const seen = new Set();
  const result = [];

  for (const supply of supplies) {
    const key = String(supply?.title || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(supply);
  }

  return result;
}

function getSupplyObjectsFromRecord(record) {
  const fields = record?.fields || {};
  const titles = splitSupplies(fields["Supplies"]);
  const ids = splitSupplyIds(fields["Supply IDs"]);

  return pairSuppliesWithIds(titles, ids);
}

function buildSuppliesResources(packetRecord, allLessonRecordsById) {
  const fields = packetRecord.fields || {};

  const linkUrl = normalizeText(fields["Supply List Link"]);
  const lessonSetName = normalizeText(fields["Lesson Set Name"]);
  const courseSupplies = getSupplyObjectsFromRecord(packetRecord);

  const courseIds = normalizeArray(fields["Course Connection"]);
  const topicIds = normalizeArray(fields["Topic Connection"]);
  const isTopic = courseIds.length > 0;

  const groups = [];

  if (isTopic) {
    const combinedSupplies = uniqueSupplyObjects(courseSupplies);

    if (combinedSupplies.length) {
      groups.push({
        title: lessonSetName,
        type: "topic",
        supplies: combinedSupplies
      });
    }
  }

  else if (!topicIds.length) {
    if (courseSupplies.length) {
      groups.push({
        title: lessonSetName,
        type: "course",
        supplies: uniqueSupplyObjects(courseSupplies)
      });
    }
  }

  else {
    groups.push({
      title: lessonSetName,
      type: "course",
      supplies: uniqueSupplyObjects(courseSupplies)
    });

    for (const topicId of topicIds) {
      const topicRecord = allLessonRecordsById.get(topicId);
      if (!topicRecord) continue;

      const topicFields = topicRecord.fields || {};
      const topicTitle = normalizeText(topicFields["Lesson Set Name"]);
      const topicSupplies = uniqueSupplyObjects(getSupplyObjectsFromRecord(topicRecord));

      if (!topicSupplies.length) continue;

      groups.push({
        title: topicTitle,
        type: "topic",
        supplies: topicSupplies
      });
    }
  }

  return {
    kind: "supplies-resources",
    title: "Supplies",
    linkUrl,
    basicSuppliesUrl: "#",
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

function sortQuickLinks(links) {
  return [...links].sort((a, b) => {
    const aSort = Number(a.sort || 999999);
    const bSort = Number(b.sort || 999999);

    if (aSort !== bSort) return aSort - bSort;

    return String(a.label || "").localeCompare(String(b.label || ""));
  });
}

function getQuickLinksFromHeaderRecords(headerRecords, headerLookup) {
  const quickLinksById = headerLookup.quickLinksById || new Map();
  const links = [];

  for (const headerRecord of headerRecords || []) {
    const headerFields = headerRecord.fields || {};
    const quickLinkIds = normalizeArray(headerFields["Quick Links Connections"]);

    for (const quickLinkId of quickLinkIds) {
      const quickLinkRecord = quickLinksById.get(quickLinkId);
      if (!quickLinkRecord) continue;

      const qf = quickLinkRecord.fields || {};
      const label = normalizeText(qf["Link Label"]);
      const url = normalizeText(qf["Link URL"]);
      const sort = normalizeText(qf["Quick Link Sort"]);

      if (!label && !url) continue;

      links.push({
        label,
        url: url || "#",
        sort
      });
    }
  }

  return sortQuickLinks(links);
}

function buildQuickLinksResources(packetRecord, headerRecords, headerLookup) {
  const fields = packetRecord.fields || {};

  const linkPageUrl = normalizeText(fields["Link Page"]) || "#";
  const lessonSetName = normalizeText(fields["Lesson Set Name"]);

  const courseIds = normalizeArray(fields["Course Connection"]);
  const topicIds = normalizeArray(fields["Topic Connection"]);
  const isTopic = courseIds.length > 0;

  const groups = [];

  if (isTopic) {
    const links = getQuickLinksFromHeaderRecords(headerRecords, headerLookup);

    if (links.length) {
      groups.push({
        title: lessonSetName,
        type: "topic",
        links
      });
    }
  }

  else if (!topicIds.length) {
    const links = getQuickLinksFromHeaderRecords(headerRecords, headerLookup);

    if (links.length) {
      groups.push({
        title: lessonSetName,
        type: "course",
        links
      });
    }
  }

      else {
        const courseLinks = getQuickLinksFromHeaderRecords(headerRecords, headerLookup);
        const topicGroups = [];
    
        for (const topicId of topicIds) {
          const topicRecord = headerLookup.lessonRecordsById?.get(topicId);
          if (!topicRecord) continue;
    
          const topicFields = topicRecord.fields || {};
          const topicTitle = normalizeText(topicFields["Lesson Set Name"]);
    
          const topicHeaderRecords = getMatchedHeaderRecords(
            topicFields,
            normalizeText(topicFields.setID) || topicRecord.id,
            headerLookup
          );
    
          const topicLinks = getQuickLinksFromHeaderRecords(topicHeaderRecords, headerLookup);
    
          if (!topicLinks.length) continue;
    
          topicGroups.push({
            title: topicTitle,
            type: "topic",
            links: topicLinks
          });
        }
    
        if (courseLinks.length || topicGroups.length) {
          groups.push({
            title: lessonSetName,
            type: "course",
            links: courseLinks
          });
    
          groups.push(...topicGroups);
        }
      }

  return {
    kind: "quick-links",
    title: "Quick Links",
    linkPageUrl,
    groups
  };
}

function buildHowToSection(packetRecord, headerLookup) {
  const fields = packetRecord.fields || {};
  const howToIds = normalizeArray(fields["How To Pages"]);
  const howToById = headerLookup.howToById || new Map();

  if (!howToIds.length) return null;

  const pages = [];

  for (const howToId of howToIds) {
    const record = howToById.get(howToId);
    if (!record) continue;

    const rf = record.fields || {};
    const teachApproach = normalizeText(rf["Teach/Approach"]);

    const blocks = [];

    for (let i = 1; i <= 15; i++) {
      const prompt = normalizeText(rf[`Prompt ${i}`]);
      const text = normalizeRichText(rf[`Text ${i}`]);
      const imageId = normalizeText(rf[`Image ID ${i}`]);

      if (!prompt && !text && !imageId) continue;

      blocks.push({
        prompt,
        text,
        imageId,
        image: imageId
          ? `../images/howto_images/${imageId}.webp`
          : ""
      });
    }

    if (!blocks.length) continue;

    pages.push({
      title: normalizeText(fields["Lesson Set Name"]),
      subtitle: teachApproach,
      editUrl: normalizeText(rf["How To Edit URL"]),
      blocks
    });
  }

  if (!pages.length) return null;

  return {
    type: "howto",
    pages
  };
}

function buildLessonsSection(packetRecord, headerLookup) {
  const fields = packetRecord.fields || {};
  const setId = normalizeText(fields.setID) || packetRecord.id;

  const lessonDetailsById = headerLookup.lessonDetailsById || new Map();
  const courseLessonsMap = headerLookup.courseLessonsByCourseId || new Map();

  const isCourseWithTopics =
    normalizeArray(fields["Topic Connection"]).length > 0 &&
    normalizeArray(fields["Course Connection"]).length === 0;

  let lessons = [];

  // ---------------------------------------
  // 1. COURSE WITH TOPICS → use Course Lessons if available
  // ---------------------------------------
  if (isCourseWithTopics) {
    const courseLessonRecords = courseLessonsMap.get(setId) || [];

    if (courseLessonRecords.length) {
      lessons = courseLessonRecords.map(record => {
        const lf = record.fields || {};

        return {
          lessonId: record.id,
          termNumber: Number(normalizeText(lf["Term"]) || 0),
          termLabel: lf["Term"] ? `Term ${lf["Term"]}` : "",
          weekNumber: Number(normalizeText(lf["Week"]) || 0),
          weekLabel: normalizeText(lf["Week Label"]),
          sequence: Number(normalizeText(lf["Lesson Sequence"]) || 0),
          sort: Number(normalizeText(lf["Sort"]) || 0),
          lessonLabel: "",
          title: normalizeText(lf["Lesson Title"]),
          body: normalizeRichText(lf["Lesson Body"]),
          teacherNotes: normalizeRichText(lf["Teacher Notes"]),
          editUrl: normalizeText(lf["Lesson_WritingURL"]),
          links: buildLessonLinks(lf)
        };
      });
    }
  }

  // ---------------------------------------
  // 2. FALLBACK → Topic packets & standalone courses
  // ---------------------------------------
  if (!lessons.length) {
    const lessonIds = normalizeArray(fields["Lessons"]);

    for (const lessonId of lessonIds) {
      const lessonRecord = lessonDetailsById.get(lessonId);
      if (!lessonRecord) continue;

      const lf = lessonRecord.fields || {};

      lessons.push({
        lessonId: lessonRecord.id,
        termNumber: Number(normalizeText(lf["Term"]) || 0),
        termLabel: lf["Term"] ? `Term ${lf["Term"]}` : "",
        weekNumber: Number(normalizeText(lf["Week"]) || 0),
        weekLabel: normalizeText(lf["Week:"]),
        sequence: Number(normalizeText(lf["Lesson Sequence"]) || 0),
        lessonLabel: normalizeText(lf["Lesson Label"]),
        title: normalizeText(lf["Lesson Title"]),
        body: normalizeRichText(lf["Lesson Body"]),
        teacherNotes: normalizeRichText(lf["Teacher Notes"]),
        editUrl: normalizeText(lf["Lesson_WritingURL"]),
        links: buildLessonLinks(lf)
      });
    }
  }

  if (!lessons.length) return null;

  // ---------------------------------------
  // SORT
  // ---------------------------------------
  const sortedLessons = lessons.sort((a, b) => {
    if (a.termNumber !== b.termNumber) return a.termNumber - b.termNumber;
  
    const aSort = Number(a.sort || 0);
    const bSort = Number(b.sort || 0);
  
    if (aSort || bSort) return aSort - bSort;
  
    if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
    return a.sequence - b.sequence;
  });

  // ---------------------------------------
  // GROUP INTO TERMS
  // ---------------------------------------
  const termsByNumber = new Map();

  for (const lesson of sortedLessons) {
    const key = lesson.termNumber || 0;

    if (!termsByNumber.has(key)) {
      termsByNumber.set(key, {
        termNumber: lesson.termNumber,
        term: lesson.termLabel || "Term",
        lessons: []
      });
    }

    termsByNumber.get(key).lessons.push(lesson);
  }

  const terms = [...termsByNumber.values()].filter(term => term.lessons.length);

  if (!terms.length) return null;

  return {
    type: "lessons",
    title: normalizeText(fields["Lesson Set Name"]),
    linkPageUrl: normalizeText(fields["Link Page"]) || "#",
    terms
  };
}

function buildLessonLinks(fields) {
  const links = [];

  for (let i = 1; i <= 5; i += 1) {
    const url = normalizeText(fields[`URL ${i}`]);
    const text = normalizeText(fields[`Text ${i}`]);

    if (!url) continue;

    links.push({
      text: text || url,
      url
    });
  }

  return links;
}

function slugifyAnchorPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildLessonAnchor(lesson) {
  return [
    "term",
    lesson.termNumber || 0,
    "week",
    lesson.weekNumber || 0,
    "lesson",
    slugifyAnchorPart(lesson.lessonLabel || lesson.sequence || lesson.lessonId)
  ].join("-");
}

function buildLinkPage(packet) {
  const lessonSection = (packet.sections || []).find(section => section.type === "lessons");

  if (!lessonSection) return null;

  const terms = [];

  for (const term of lessonSection.terms || []) {
    const weeksByNumber = new Map();

    for (const lesson of term.lessons || []) {
      const links = lesson.links || [];

      if (!links.length) continue;

      const weekKey = lesson.weekNumber || 0;

      if (!weeksByNumber.has(weekKey)) {
        weeksByNumber.set(weekKey, {
          weekNumber: lesson.weekNumber,
          weekLabel: lesson.weekLabel || "",
          lessons: []
        });
      }

      const anchor = buildLessonAnchor(lesson);

      weeksByNumber.get(weekKey).lessons.push({
        lessonId: lesson.lessonId,
        termNumber: lesson.termNumber,
        termLabel: lesson.termLabel,
        weekNumber: lesson.weekNumber,
        weekLabel: lesson.weekLabel,
        sequence: lesson.sequence,
        sort: lesson.sort || 0,
        lessonLabel: lesson.lessonLabel,
        title: lesson.title,
        anchor,
        links
      });
    }

    const weeks = [...weeksByNumber.values()]
      .map(week => ({
        ...week,
        lessons: week.lessons.sort((a, b) => {
          const aSort = Number(a.sort || 0);
          const bSort = Number(b.sort || 0);

          if (aSort || bSort) return aSort - bSort;
          return Number(a.sequence || 0) - Number(b.sequence || 0);
        })
      }))
      .filter(week => week.lessons.length)
      .sort((a, b) => Number(a.weekNumber || 0) - Number(b.weekNumber || 0));

    if (!weeks.length) continue;

    terms.push({
      termNumber: term.termNumber,
      term: term.term,
      weeks
    });
  }

  if (!terms.length) return null;

  return {
    id: packet.id,
    title: packet.title,
    lessonSetName: packet.lessonSetName,
    subject: packet.subject,
    gradeText: packet.gradeText,
    sortId: packet.sortId,
    rowType: packet.rowType,
    hasTopics: packet.hasTopics,
    isStandaloneCourse: packet.isStandaloneCourse,
    courseConnectionNames: packet.courseConnectionNames || [],
    topicConnectionNames: packet.topicConnectionNames || [],
    updatedAt: new Date().toISOString(),
    terms
  };
}

function buildExamsSection(record) {
  const fields = record.fields || {};

  const terms = [
    {
      term: "Term 1",
      content: normalizeRichText(fields["Term 1 Exams"])
    },
    {
      term: "Term 2",
      content: normalizeRichText(fields["Term 2 Exams"])
    },
    {
      term: "Term 3",
      content: normalizeRichText(fields["Term 3 Exams"])
    }
  ].filter(term => term.content && term.content.trim());

  if (!terms.length) return null;

  return {
    type: "exams",
    title: normalizeText(fields["Lesson Set Name"]),
    hasExams: true,
    terms
  };
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
        editUrl: normalizeText(fields["Header Edit URL"]),
        items: [
          ...headerItems.filter(item => item.kind !== "planning-prep-group"),
        
          {
            kind: "scheduling",
            title: "Scheduling",
            rows: buildSchedulingRows(record, headerLookup.lessonRecordsById || new Map()),
            weeklyView: buildWeeklyView(record)
          },
        
          ...headerItems.filter(item => item.kind === "planning-prep-group"),
        
          buildBooksResources(record, headerLookup.lessonRecordsById || new Map()),
          buildSuppliesResources(record, headerLookup.lessonRecordsById || new Map()),
          buildQuickLinksResources(record, matchedHeaderRecords, headerLookup)
        ].filter(Boolean)
      },
      buildHowToSection(record, headerLookup),
      buildLessonsSection(record, headerLookup),
      buildExamsSection(record)
    ].filter(Boolean)
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
  const linkPagesDir = path.join(dataDir, "link-pages");
  
  await ensureDir(dataDir);
  await ensureDir(packetsDir);
  await ensureDir(linkPagesDir);

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

  const quickLinkRecords = await fetchAllRecords(
    QUICK_LINKS_TABLE_NAME,
    QUICK_LINKS_VIEW_NAME,
    QUICK_LINK_FIELDS
  );

  const howToRecords = await fetchAllRecords(
    HOW_TO_TABLE_NAME,
    HOW_TO_VIEW_NAME,
    HOW_TO_FIELDS
  );
  
  const howToImageRecords = await fetchAllRecords(
    HOW_TO_IMAGE_TABLE_NAME,
    HOW_TO_IMAGE_VIEW_NAME,
    ["Image"]
  );

  const lessonDetailRecords = await fetchAllRecords(
    LESSONS_TABLE_NAME,
    LESSONS_VIEW_NAME,
    LESSON_DETAIL_FIELDS
  );

  const courseLessonRecords = await fetchAllRecords(
    COURSE_LESSONS_TABLE_NAME,
    COURSE_LESSONS_VIEW_NAME,
    COURSE_LESSON_FIELDS
  );
  
  const howToById = new Map(howToRecords.map(r => [r.id, r]));
  const howToImagesById = new Map(howToImageRecords.map(r => [r.id, r]));
  
  const headerLookup = buildHeaderLookup(headerRecords);
  
  headerLookup.courseLessonsByCourseId = new Map();
  
    for (const record of courseLessonRecords) {
      const fields = record.fields || {};
      const courseIds = normalizeArray(fields["Course"]);
    
      for (const courseId of courseIds) {
        if (!headerLookup.courseLessonsByCourseId.has(courseId)) {
          headerLookup.courseLessonsByCourseId.set(courseId, []);
        }
        headerLookup.courseLessonsByCourseId.get(courseId).push(record);
      }
    }
  
  headerLookup.howToById = howToById;
  headerLookup.howToImagesById = howToImagesById;

  headerLookup.quickLinksById = new Map(
    quickLinkRecords.map(record => [record.id, record])
  );
  headerLookup.lessonRecordsById = lessonRecordsById;

  headerLookup.lessonDetailsById = new Map(
    lessonDetailRecords.map(record => [record.id, record])
  );

  const packets = lessonRecords.map(record => buildPacket(record, headerLookup));
  const index = packets.map(buildIndexItem);

  const linkPages = [];

  for (const packet of packets) {
    const filePath = path.join(packetsDir, `${packet.id}.json`);
    await writeJson(filePath, packet);
  
    const linkPage = buildLinkPage(packet);
  
    if (linkPage) {
      const linkPagePath = path.join(linkPagesDir, `${packet.id}.json`);
      await writeJson(linkPagePath, linkPage);
  
      linkPages.push({
        id: linkPage.id,
        title: linkPage.title,
        lessonSetName: linkPage.lessonSetName,
        subject: linkPage.subject,
        gradeText: linkPage.gradeText,
        sortId: linkPage.sortId,
        rowType: linkPage.rowType,
        hasTopics: linkPage.hasTopics,
        isStandaloneCourse: linkPage.isStandaloneCourse,
        courseConnectionNames: linkPage.courseConnectionNames,
        topicConnectionNames: linkPage.topicConnectionNames,
        linkPageUrl: `./links.html?id=${encodeURIComponent(linkPage.id)}`
      });
    }
  }
  
  await writeJson(path.join(dataDir, "packet-index.json"), index);
  await writeJson(path.join(dataDir, "link-page-index.json"), linkPages);
  
  console.log(`Built ${packets.length} packet JSON file(s).`);
  console.log(`Built ${linkPages.length} link page JSON file(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
