function renderModernLanguageLessonsSection(section, options = {}) {
  const preparedSection = prepareMLSectionForRender(section, options);

  if (options.viewMode === "topic") {
    return renderMLByLessonSet(preparedSection);
  }

  if (preparedSection.weeklyLessons?.length) {
    return renderMLWeeklyLessons(preparedSection);
  }

  return renderMLByLessonSet(preparedSection);
}

function prepareMLSectionForRender(section, options = {}) {
  const variant = String(options.variant || "").trim();
  const topic = String(options.topic || "").trim();
  const lessonId = String(options.lesson || "").trim();

  let lessonSets = (section.lessonSets || []).map(lessonSet => ({
    ...lessonSet,
    lessons: [...(lessonSet.lessons || [])]
  }));

  if (variant === "g1-3") {
    lessonSets = lessonSets.filter(lessonSet => {
      const title = String(lessonSet.title || "").toLowerCase();

      return (
        !title.includes("grammar") &&
        !title.includes("literature extension")
      );
    });
  }

  if (topic) {
    lessonSets = lessonSets.filter(lessonSet => {
      const titleSlug = slugifyPreviewAnchor(lessonSet.title || "");
      const topicSlug = slugifyPreviewAnchor(topic);
  
      return titleSlug === topicSlug;
    });
  }

  if (lessonId) {
    lessonSets = lessonSets
      .map(lessonSet => ({
        ...lessonSet,
        lessons: (lessonSet.lessons || []).filter(lesson => lesson.id === lessonId)
      }))
      .filter(lessonSet => lessonSet.lessons.length);
  }

  return {
    ...section,
    lessonSets,
    weeklyLessons: buildMLWeeklyLessonsFromLessonSets(lessonSets)
  };
}

function buildMLWeeklyLessonsFromLessonSets(lessonSets = []) {
  const weeksByKey = new Map();

  lessonSets.forEach(lessonSet => {
    (lessonSet.lessons || []).forEach(lesson => {
      const weekKey = String(lesson.week || "").trim();
      if (!weekKey) return;

      if (!weeksByKey.has(weekKey)) {
        weeksByKey.set(weekKey, {
          week: lesson.week,
          weekLabel: lesson.weekLabel,
          term: lesson.term,
          lessons: []
        });
      }

      weeksByKey.get(weekKey).lessons.push({
        ...lesson,
        lessonSetId: lessonSet.id,
        lessonSetTitle: lessonSet.title,
        language: lessonSet.language
      });
    });
  });

  return Array.from(weeksByKey.values())
    .sort((a, b) => Number(a.week || 0) - Number(b.week || 0))
    .map(week => ({
      ...week,
      lessons: week.lessons.sort(sortMLWeeklyLessons)
    }));
}

function sortMLWeeklyLessons(a = {}, b = {}) {
  const typeOrder = [
    "Picture Study",
    "Grammar",
    "Literature",
    "Literature Extension",
    "Songs, Rhymes & Conversations",
    "Songs, Rhymes, & Conversations",
    "Cultural"
  ];

  const getOrder = title => {
    const index = typeOrder.findIndex(type =>
      String(title || "").toLowerCase().includes(type.toLowerCase())
    );

    return index === -1 ? 999 : index;
  };

  return getOrder(a.lessonSetTitle) - getOrder(b.lessonSetTitle);
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
    <section
        class="ml-week-block"
        id="ml-week-${escapeHtml(week.week || "")}"
        data-ml-term="${escapeHtml(week.term || "")}"
      >
      <div class="ml-week-banner">
        <div class="ml-week-banner-term" id="ml-term-${escapeHtml(week.term || "")}">
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
        <div class="ml-lesson-sets">
          ${(section.lessonSets || []).map(lessonSet => `
            <section class="ml-lesson-set" id="ml-topic-${slugifyPreviewAnchor(lessonSet.title || "")}">
              <h1 class="lesson-page-title ml-topic-page-title">${escapeHtml(lessonSet.title || "")}</h1>

              ${renderMLTopicTerms(lessonSet)}
            </section>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderMLTopicTerms(lessonSet) {
  const termsByNumber = new Map();

  (lessonSet.lessons || []).forEach(lesson => {
    const term = String(lesson.term || "").trim() || "0";

    if (!termsByNumber.has(term)) {
      termsByNumber.set(term, []);
    }

    termsByNumber.get(term).push(lesson);
  });

  return [...termsByNumber.entries()]
    .sort((a, b) => Number(a[0] || 0) - Number(b[0] || 0))
    .map(([term, lessons]) => `
      <section
        class="ml-topic-term-block"
        id="ml-topic-term-${escapeHtml(term)}-${slugifyPreviewAnchor(lessonSet.title || "")}"
        data-ml-topic-term="${escapeHtml(term)}"
      >
        <div class="ml-topic-term-banner" id="ml-term-${escapeHtml(term)}">
          Term ${escapeHtml(term)}
        </div>

        <div class="ml-topic-term-lessons">
          ${lessons
            .sort((a, b) => Number(a.week || 0) - Number(b.week || 0) || Number(a.sequence || 0) - Number(b.sequence || 0))
            .map(lesson => renderMLLesson({
              ...lesson,
              lessonSetId: lessonSet.id,
              lessonSetTitle: lessonSet.title,
              language: lessonSet.language
            }))
            .join("")}
        </div>
      </section>
    `).join("");
}

function renderMLLesson(lesson) {
  return `
    <article
      class="ml-lesson-card"
      id="ml-lesson-${escapeHtml(lesson.id || "")}"
    >
      ${lesson.editUrl ? `
        <a href="${escapeHtml(lesson.editUrl)}" target="_blank" class="preview-only edit-button ml-lesson-margin-edit">Edit</a>
      ` : ""}
    
      <div class="ml-lesson-main">
        <div class="ml-lesson-heading-row">
          <div class="ml-lesson-title-line">
            ⬚ ${formatMLLessonTitle(lesson.title || "")}
          </div>
        
          <div class="ml-topic-meta">
            <div class="ml-topic-label">
              ${escapeHtml(lesson.lessonSetTitle || lesson.language || "")}
            </div>
          
            ${lesson.weekLabel ? `
              <div class="ml-week-meta">
                ${escapeHtml(lesson.weekLabel)}
              </div>
            ` : ""}
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
          ${renderMLVocabGrid(sortMLItemsBySet(lesson.vocab), lesson)}
          ${renderMLSentenceGrid(sortMLItemsBySet(lesson.sentences))}
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

function renderMLVocabGrid(vocab = [], lesson = {}) {
  if (!Array.isArray(vocab) || !vocab.length) return "";

  const sets = groupMLItemsBySet(vocab);

  if (sets.length > 1) {
    return `
      <section class="ml-resource-review-grid ml-vocab-review-grid">
        ${sets.map(([setLabel, setItems]) => {
          const title = buildMLResourceTitle(setItems, "Vocabulary", {
            typeField: "type",
            setField: "set"
          });

          return renderMLResourceGrid({
            title,
            items: setItems,
            blockClass: "ml-vocab-block ml-vocab-review-card",
            primaryKey: "text",
            translationKey: "translation"
          });
        }).join("")}
      </section>
    `;
  }

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

  return [...charts]
    .sort(sortMLGrammarCharts)
    .map(chart => {
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
                  ${headers.single ? `
                    <th colspan="2">${escapeHtml(headers.single)}</th>
                  ` : `
                    <th>${escapeHtml(headers.col1)}</th>
                    <th>${escapeHtml(headers.col2)}</th>
                  `}
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

  if (col1 && col2) return { col1, col2, single: "" };
  if (col1 && !col2) return { col1: "", col2: "", single: col1 };
  if (!col1 && col2) return { col1: "", col2: "", single: col2 };

  return { col1: "", col2: "", single: fallback };
}

function sortMLGrammarCharts(a = {}, b = {}) {
  const aType = String(a.chartType || "").toLowerCase();
  const bType = String(b.chartType || "").toLowerCase();

  const typeRank = type => type.includes("practice") ? 2 : 1;

  const aTypeRank = typeRank(aType);
  const bTypeRank = typeRank(bType);

  if (aTypeRank !== bTypeRank) return aTypeRank - bTypeRank;

  const aSet = getMLSetNumber(a.set);
  const bSet = getMLSetNumber(b.set);

  if (aSet !== bSet) return aSet - bSet;

  return String(a.name || "").localeCompare(String(b.name || ""));
}

function getMLSetNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 999;
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

function groupMLItemsBySet(items = []) {
  const groups = new Map();

  items.forEach(item => {
    const setLabel = String(item.set || "Set").trim();

    if (!groups.has(setLabel)) {
      groups.set(setLabel, []);
    }

    groups.get(setLabel).push(item);
  });

  return [...groups.entries()]
    .sort((a, b) => getMLSetNumber(a[0]) - getMLSetNumber(b[0]))
    .map(([setLabel, setItems]) => [
      setLabel,
      sortMLItemsBySet(setItems)
    ]);
}

function sortMLItemsBySet(items = []) {
  return [...items].sort((a, b) => {
    const aSet = getMLSetNumber(a.set);
    const bSet = getMLSetNumber(b.set);

    if (aSet !== bSet) return aSet - bSet;

    return Number(a.sequence || 0) - Number(b.sequence || 0);
  });
}
