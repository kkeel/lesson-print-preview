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
    weeklyLessons: buildMLWeeklyLessonsFromLessonSets(lessonSets),
    appendices: buildMLAppendices(lessonSets, options)
  };
}

function buildMLAppendices(lessonSets = [], options = {}) {
  const seenStoryIds = new Set();
  const seenSongIds = new Set();
  const seenGlossaryIds = new Set();

  const stories = [];
  const songsRhymes = [];
  const glossary = [];

  lessonSets.forEach(lessonSet => {
    const resources = lessonSet.resources || {};

    (resources.stories || []).forEach(story => {
      if (seenStoryIds.has(story.id)) return;

      seenStoryIds.add(story.id);

      stories.push({
        ...story,
        lessonSetTitle: lessonSet.title,
        language: lessonSet.language
      });
    });

    (resources.songsRhymes || []).forEach(song => {
      if (seenSongIds.has(song.id)) return;

      seenSongIds.add(song.id);

      songsRhymes.push({
        ...song,
        lessonSetTitle: lessonSet.title,
        language: lessonSet.language
      });
    });

    (resources.glossary || []).forEach(item => {
      if (seenGlossaryIds.has(item.id)) return;

      seenGlossaryIds.add(item.id);

      glossary.push({
        ...item,
        lessonSetTitle: lessonSet.title,
        language: lessonSet.language
      });
    });
  });

  stories.sort((a, b) => {
    const aSet = getMLStoryFirstSet(a);
    const bSet = getMLStoryFirstSet(b);
  
    if (aSet !== bSet) return aSet - bSet;
  
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  
  return {
    stories,
    songsRhymes,
    glossary
  };
}

function getMLStoryFirstSet(story = {}) {
  const firstLine = (story.lines || [])[0];

  if (!firstLine) return 999;

  return getMLSetNumber(firstLine.set);
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
    <div
      class="page-flow ml-lessons-section section-break"
      id="ml-section-lessons"
    >
      <section class="flow-block">
        <h1 class="lesson-page-title">${escapeHtml(section.title || "")}</h1>

        <div class="ml-week-list">
          ${(section.weeklyLessons || []).map(week => renderMLWeek(week)).join("")}
        </div>
      </section>
    </div>

    ${renderMLAppendices(section.appendices)}
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
    <div
      class="page-flow ml-lessons-section section-break"
      id="ml-section-lessons"
    >
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

    ${renderMLAppendices(section.appendices)}
  `;
}

function renderMLStoryResource(story) {
  const languageLabel = story.language || "Spanish/French";

  return `
    <article class="ml-story-resource">
      <div class="ml-appendix-top-rule"></div>

      <header class="ml-story-header">
        <h2 class="ml-story-title">
          ${escapeHtml(story.title || "")}
        </h2>
      </header>

      <div class="ml-story-column-headings">
        <div>
          <div class="ml-story-column-rule"></div>
          <div class="ml-story-column-label">${escapeHtml(languageLabel)}</div>
        </div>

        <div>
          <div class="ml-story-column-rule"></div>
          <div class="ml-story-column-label">English</div>
        </div>
      </div>

      <div class="ml-story-lines">
        ${(story.lines || [])
          .sort((a, b) => {
            const aSet = getMLSetNumber(a.set);
            const bSet = getMLSetNumber(b.set);

            if (aSet !== bSet) return aSet - bSet;

            return Number(a.lineNumber || 0) - Number(b.lineNumber || 0);
          })
          .map(renderMLStoryLine)
          .join("")}
      </div>
    </article>
  `;
}

function formatMLStoryReference(line = {}) {
  const setNumber = getMLSetNumber(line.set);
  const lineNumber = Number(line.lineNumber || 0);

  if (!setNumber || setNumber === 999 || !lineNumber) {
    return line.reference || "";
  }

  return `S${setNumber}.L${lineNumber}`;
}

function renderMLStoryLine(line) {
  return `
    <div class="ml-story-line">
      <div class="ml-story-language-col">
        <div class="ml-story-line-inner">
          <div class="ml-story-reference">
            ${escapeHtml(formatMLStoryReference(line))}
          </div>

          <div class="ml-story-text">
            ${escapeHtml(line.sentence || "")}
          </div>
        </div>
      </div>

      <div class="ml-story-translation-col">
        <div class="ml-story-line-inner">
          <div class="ml-story-reference">
            ${escapeHtml(formatMLStoryReference(line))}
          </div>

          <div class="ml-story-text">
            ${escapeHtml(line.translation || "")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMLAppendices(appendices = {}) {
  const hasStories = (appendices.stories || []).length;
  const hasSongs = (appendices.songsRhymes || []).length;
  const hasGlossary = (appendices.glossary || []).length;

  if (!hasStories && !hasSongs && !hasGlossary) {
    return "";
  }

  return `
    <section class="ml-appendices">
      ${hasStories ? `
        <div class="page-flow ml-appendix-page ml-appendix-storylines section-break" id="ml-appendix-storylines">
          <section class="ml-appendix-block ml-storylines-appendix">
            <div class="ml-story-list">
              ${(appendices.stories || []).map(renderMLStoryResource).join("")}
            </div>
          </section>
        </div>
      ` : ""}

      ${hasSongs ? `
        <div class="page-flow ml-appendix-page ml-appendix-songs section-break" id="ml-appendix-songs">
          <section class="ml-appendix-block">
            <h1 class="lesson-page-title">Songs & Rhymes</h1>

            <div class="ml-appendix-placeholder">
              Songs & Rhymes rendering coming next
            </div>
          </section>
        </div>
      ` : ""}

      ${hasGlossary ? `
        <div class="page-flow ml-appendix-page ml-appendix-glossary section-break" id="ml-appendix-glossary">
          <section class="ml-appendix-block">
            <h1 class="lesson-page-title">Vocabulary Glossary</h1>

            <div class="ml-appendix-placeholder">
              Glossary rendering coming next
            </div>
          </section>
        </div>
      ` : ""}
    </section>
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
          
            ${lesson.lessonLinksUrl ? `
              <img
                class="ml-lesson-links-qr"
                src="https://quickchart.io/qr?size=120&margin=1&text=${encodeURIComponent(lesson.lessonLinksUrl)}"
                alt="QR code for lesson links"
              />
            
              <a class="ml-lesson-links-url" href="${escapeHtml(lesson.lessonLinksUrl)}" target="_blank" rel="noopener">
                Lesson Links
              </a>
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
    .replace(/\r\n/g, "\n")
    .trim();

  if (!text) return "";

  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const heading = lines[0] || "";
  const phraseLine = lines.slice(1).join(" ").trim();

  const parts = phraseLine.split(/\s+-\s+/);
  const phrase = (parts[0] || "").trim();
  const translation = parts.slice(1).join(" - ").trim();

  return `
    <div class="ml-text-block">
      ${heading ? `${formatInlineRichText(heading)}<br>` : ""}
      ${translation ? `
        <strong>${formatInlineRichText(phrase)}</strong> - <em>${formatInlineRichText(translation)}</em>
      ` : formatInlineRichText(phraseLine)}
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

  const sets = groupMLItemsBySet(sentences);

  if (sets.length > 1) {
    return `
      <section class="ml-resource-stacked-review ml-sentence-review-stack">
        ${sets.map(([setLabel, setItems]) => {
          const title = buildMLResourceTitle(setItems, "Sentences", {
            typeField: "sentenceType",
            setField: "set"
          });

          return renderMLResourceGrid({
            title,
            items: setItems,
            blockClass: "ml-sentence-block ml-sentence-review-card",
            primaryKey: "sentence",
            translationKey: "translation"
          });
        }).join("")}
      </section>
    `;
  }

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
  const text = String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!text) return { heading: "", body: "" };

  const firstLineBreak = text.indexOf("\n");

  if (firstLineBreak === -1) {
    return {
      heading: text.trim(),
      body: ""
    };
  }

  return {
    heading: text.slice(0, firstLineBreak).trim(),
    body: text.slice(firstLineBreak + 1).trim()
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
