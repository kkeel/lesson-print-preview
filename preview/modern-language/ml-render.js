function renderModernLanguageLessonsSection(section) {
  if (section.weeklyLessons?.length) {
    return renderMLWeeklyLessons(section);
  }

  return renderMLByLessonSet(section);
}

function renderMLWeeklyLessons(section) {
  return `
    <div class="page-flow ml-lessons-section section-break">
      <section class="flow-block">
        <h1 class="lesson-page-title">${escapeHtml(section.title || "")}</h1>

        <div class="ml-week-list">
          ${(section.weeklyLessons || []).map(week => renderMLWeek(week)).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderMLWeek(week) {
  return `
    <section class="ml-week-block">
      <div class="ml-week-banner">
        <div class="ml-week-banner-term">
          Term ${escapeHtml(week.term || "")}
        </div>
      
        <div class="ml-week-banner-week">
          ${escapeHtml(week.weekLabel || `Week ${week.week || ""}`)}
        </div>
      </div>

      <div class="ml-week-lessons">
        ${(week.lessons || []).map(lesson => renderMLLesson(lesson)).join("")}
      </div>
    </section>
  `;
}

function renderMLByLessonSet(section) {
  return `
    <div class="page-flow ml-lessons-section section-break">
      <section class="flow-block">
        <h1 class="lesson-page-title">${escapeHtml(section.title || "")}</h1>

        <div class="ml-lesson-sets">
          ${(section.lessonSets || []).map(lessonSet => `
            <section class="ml-lesson-set">
              <h2 class="ml-lesson-set-title">${escapeHtml(lessonSet.title || "")}</h2>
              ${(lessonSet.lessons || []).map(lesson => renderMLLesson(lesson)).join("")}
            </section>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderMLLesson(lesson) {
  return `
    <article class="ml-lesson-card">
      <div class="ml-lesson-main">
        <div class="ml-lesson-heading-row">
          <div class="ml-lesson-title-line">
            ⬚ ${formatMLLessonTitle(lesson.title || "")}
          </div>
        
          <div class="ml-topic-label">
            ${escapeHtml(lesson.lessonSetTitle || lesson.language || "")}
          </div>
        </div>

        ${lesson.subtitle ? `
          <div class="ml-lesson-subtitle-line">${formatInlineRichText(lesson.subtitle)}</div>
        ` : ""}

        ${lesson.materials ? `
          <div class="ml-lesson-materials-box">${formatInlineRichText(lesson.materials).replace(/\n/g, "<br>")}</div>
        ` : ""}

        <div class="ml-lesson-body">
          ${renderMLTextBlock(lesson.prep)}
          ${renderMLPhraseBlock(lesson.phraseOfWeek)}
          ${renderMLTextBlock(lesson.instructions)}
          ${renderMLTextBlock(lesson.cctBlock)}
          ${renderMLVocabGrid(lesson.vocab)}
          ${renderMLSentenceGrid(lesson.sentences)}
          ${renderMLGrammarCharts(lesson.grammarCharts)}
        </div>
      </div>
    </article>
  `;
}

function renderMLTextBlock(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  return `
    <div class="ml-text-block">
      ${formatInlineRichText(text).replace(/\n/g, "<br>")}
    </div>
  `;
}

function renderMLPhraseBlock(value) {
  const text = String(value || "")
    .replace(/\n\s+\n/g, "\n\n")
    .replace(/\n\s+/g, "\n")
    .trim();

  if (!text) return "";

  return `
    <div class="ml-text-block">
      ${formatInlineRichText(text).replace(/\n/g, "<br>")}
    </div>
  `;
}

function formatMLLessonTitle(title) {
  let text = escapeHtml(title || "");

  text = text.replace(
    /(Songs,\s*Rhymes(?:,)?\s*(?:&amp;|&)\s*)Conversations/i,
    "$1<br>Conversations"
  );

  return text;
}

function renderMLVocabGrid(vocab = []) {
  if (!Array.isArray(vocab) || !vocab.length) return "";

  const title = buildMLResourceTitle(vocab, "Vocabulary", {
    typeField: "type",
    setField: "set"
  });

  return renderMLResourceGrid({
    title,
    items: vocab,
    blockClass: "ml-vocab-block",
    primaryKey: "text",
    translationKey: "translation"
  });
}

function renderMLSentenceGrid(sentences = []) {
  if (!Array.isArray(sentences) || !sentences.length) return "";

  const title = buildMLResourceTitle(sentences, "Sentences", {
    typeField: "sentenceType",
    setField: "set"
  });

  return renderMLResourceGrid({
    title,
    items: sentences,
    blockClass: "ml-sentence-block",
    primaryKey: "sentence",
    translationKey: "translation"
  });
}

function renderMLGrammarCharts(charts = []) {
  if (!Array.isArray(charts) || !charts.length) return "";

  return charts.map(chart => {
    const rows = Array.isArray(chart.rows) ? chart.rows : [];
    const chartTypeClass = getMLGrammarChartTypeClass(chart.chartType);
    const headingInfo = splitMLGrammarInstructions(chart.formattedInstructions);
    const headers = buildMLGrammarHeaders(chart);

    return `
      <section class="ml-grammar-block ${chartTypeClass}">
        ${headingInfo.heading ? `
          <div class="ml-grammar-heading">
            ${escapeHtml(headingInfo.heading)}
          </div>
        ` : ""}

        ${headingInfo.body ? `
          <div class="ml-grammar-instructions">
            ${formatInlineRichText(headingInfo.body).replace(/\n/g, "<br>")}
          </div>
        ` : ""}

        ${rows.length ? `
          <table class="ml-grammar-table">
            <thead>
              <tr>
                <th>${escapeHtml(headers.col1)}</th>
                <th>${escapeHtml(headers.col2)}</th>
              </tr>
            </thead>

            <tbody>
              ${rows.map(row => `
                <tr>
                  <td>
                    <div class="ml-grammar-primary">${escapeHtml(row.col1 || "")}</div>
                    ${row.col1Translation ? `
                      <div class="ml-grammar-translation">${escapeHtml(row.col1Translation)}</div>
                    ` : ""}
                  </td>

                  <td>
                    <div class="ml-grammar-primary">${escapeHtml(row.col2 || "")}</div>
                    ${row.col2Translation ? `
                      <div class="ml-grammar-translation">${escapeHtml(row.col2Translation)}</div>
                    ` : ""}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}
      </section>
    `;
  }).join("");
}

function splitMLGrammarInstructions(value) {
  const text = String(value || "").trim();
  if (!text) return { heading: "", body: "" };

  const lines = text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);

  return {
    heading: lines[0] || "",
    body: lines.slice(1).join("\n")
  };
}

function getMLGrammarChartTypeClass(chartType) {
  const type = String(chartType || "").toLowerCase();

  if (type.includes("practice")) return "ml-grammar-practice";
  return "ml-grammar-example";
}

function buildMLGrammarHeaders(chart = {}) {
  const chartType = String(chart.chartType || "").toLowerCase();
  const fallback = chartType.includes("practice") ? "Practice:" : "Examples:";

  const col1 = String(chart.col1Header || "").trim();
  const col2 = String(chart.col2Header || "").trim();

  if (col1 && col2) return { col1, col2 };
  if (col1 && !col2) return { col1, col2: col1 };
  if (!col1 && col2) return { col1: col2, col2 };

  return { col1: fallback, col2: fallback };
}

function buildMLGrammarTitle(chart = {}) {
  const parts = [];

  if (chart.type) {
    parts.push(chart.type);
  } else {
    parts.push("Grammar");
  }

  if (chart.set) {
    parts.push(chart.set);
  }

  return parts.join(" - ");
}

function renderMLResourceGrid({ title, items, blockClass, primaryKey, translationKey }) {
  return `
    <section class="ml-resource-block ${blockClass || ""}">
      <div class="ml-resource-title">${escapeHtml(title || "")}</div>

      <div class="ml-resource-grid">
        ${items.map(item => `
          <div class="ml-resource-item ${item.image ? "has-image" : ""}">
            <div class="ml-resource-image-slot">
              ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" />` : ""}
            </div>

            <div class="ml-resource-primary">${escapeHtml(item[primaryKey] || "")}</div>
            <div class="ml-resource-translation">${escapeHtml(item[translationKey] || "")}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function buildMLResourceTitle(items = [], fallback, options = {}) {
  const typeField = options.typeField || "type";
  const setField = options.setField || "set";

  const types = [...new Set(
    items
      .map(item => String(item[typeField] || "").trim())
      .filter(Boolean)
  )];

  const sets = [...new Set(
    items
      .map(item => String(item[setField] || "").trim())
      .filter(Boolean)
  )];

  const typeLabel = types.length === 1 ? types[0] : fallback;
  const setLabel = sets.length === 1 ? sets[0] : sets.join(", ");

  return [typeLabel, setLabel].filter(Boolean).join(" - ");
}
