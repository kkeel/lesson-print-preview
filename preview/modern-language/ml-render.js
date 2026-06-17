function renderModernLanguageLessonsSection(section, options = {}) {
  const preparedSection = prepareMLSectionForRender(section, options);

  if (options.referencesOnly) {
    return renderMLTeacherReferences(preparedSection);
  }

  if (options.studentNotebook) {
    return renderMLStudentNotebookPrint(preparedSection, options.studentNotebook);
  }

  if (options.mlReference) {
    return renderMLReferencePrint(preparedSection, options.mlReference);
  }

  if (options.viewMode === "topic") {
    return renderMLByLessonSet(preparedSection, {
      includeReferences: options.includeTeacherReferences !== false
    });
  }
  
  if (preparedSection.weeklyLessons?.length) {
    return renderMLWeeklyLessons(preparedSection, {
      includeReferences: options.includeTeacherReferences !== false && !options.lesson
    });
  }
  
  return renderMLByLessonSet(preparedSection, {
    includeReferences: options.includeTeacherReferences !== false && !options.lesson
  });
}

function prepareMLSectionForRender(section, options = {}) {
  const variant = String(options.variant || "").trim();
  const topic = String(options.topic || "").trim();
  const lessonId = String(options.lesson || "").trim();

  const allLessonSets = (section.lessonSets || []).map(lessonSet => ({
    ...lessonSet,
    lessons: [...(lessonSet.lessons || [])]
  }));

  let lessonSets = [...allLessonSets];

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

  const appendixLessonSets = getMLAppendixLessonSets(allLessonSets, lessonSets, {
    ...options,
    sampleMode: options.sampleMode === true || section.sampleMode === true
  });

  return {
    ...section,
    lessonSets,
    weeklyLessons: buildMLWeeklyLessonsFromLessonSets(lessonSets),
    appendices: buildMLAppendices(appendixLessonSets, {
      ...options,
      sampleMode: options.sampleMode === true || section.sampleMode === true
    })
  };
}

function getMLAppendixLessonSets(allLessonSets = [], lessonSets = [], options = {}) {
  const topic = String(options.topic || "").toLowerCase();

  if (!topic) return lessonSets;

  if (topic.includes("picture") && topic.includes("grammar")) {
    return allLessonSets.filter(lessonSet =>
      String(lessonSet.title || "").toLowerCase().includes("picture") &&
      !String(lessonSet.title || "").toLowerCase().includes("grammar")
    );
  }

  if (topic.includes("literature extension")) {
    return allLessonSets.filter(lessonSet => {
      const title = String(lessonSet.title || "").toLowerCase();
      return title.includes("literature") && !title.includes("extension");
    });
  }

  return lessonSets;
}

function getMLSampleSetKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function collectMLSampleSetsByType(lessonSets = []) {
  const sets = {
    picture: new Set(),
    literature: new Set(),
    story: new Set(),
    conversation: new Set(),
    grammar: new Set()
  };

  lessonSets.forEach(lessonSet => {
    const lessonSetTitle = String(lessonSet.title || "").toLowerCase();

    (lessonSet.lessons || []).forEach(lesson => {
      (lesson.vocab || []).forEach(item => {
        const set = getMLSampleSetKey(item.set);
        if (!set) return;

        const type = String(item.type || "").toLowerCase();

        if (type.includes("literature") || lessonSetTitle.includes("literature")) {
          sets.literature.add(set);
          return;
        }

        if (type.includes("picture") || lessonSetTitle.includes("picture")) {
          sets.picture.add(set);
          return;
        }
      });

      (lesson.sentences || []).forEach(item => {
        const set = getMLSampleSetKey(item.set);
        if (!set) return;

        const type = [
          item.type,
          item.sentenceType,
          lessonSetTitle
        ].join(" ").toLowerCase();

        if (type.includes("conversation")) {
          sets.conversation.add(set);
          return;
        }

        if (type.includes("story") || type.includes("literature")) {
          sets.story.add(set);
          sets.literature.add(set);
          return;
        }

        if (type.includes("picture")) {
          sets.picture.add(set);
        }
      });

      (lesson.grammarCharts || []).forEach(item => {
        const set = getMLSampleSetKey(item.set);
        if (set) sets.grammar.add(set);
      });
    });
  });

  return sets;
}

function filterMLStoryForSample(story, sampleSetsByType) {
  const lines = (story.lines || []).filter(line => {
    const set = getMLSampleSetKey(line.set);
    return set && sampleSetsByType.story.has(set);
  });

  if (!lines.length) return null;

  return {
    ...story,
    lines
  };
}

function shouldKeepMLGlossaryItemForSample(item, sampleSetsByType) {
  const set = getMLSampleSetKey(item.set);
  if (!set) return false;

  const type = String(item.type || "").toLowerCase();

  if (type.includes("literature")) {
    return sampleSetsByType.literature.has(set);
  }

  if (type.includes("picture")) {
    return sampleSetsByType.picture.has(set);
  }

  if (type.includes("grammar")) {
    return sampleSetsByType.grammar.has(set);
  }

  return (
    sampleSetsByType.picture.has(set) ||
    sampleSetsByType.literature.has(set) ||
    sampleSetsByType.grammar.has(set)
  );
}

function buildMLAppendices(lessonSets = [], options = {}) {
  const seenStoryIds = new Set();
  const seenSongIds = new Set();
  const seenGlossaryIds = new Set();
  const seenConversationIds = new Set();

  const isSampleMode = options.sampleMode === true;
  const sampleSetsByType = isSampleMode
    ? collectMLSampleSetsByType(lessonSets)
    : null;

  const stories = [];
  const songsRhymes = [];
  const glossary = [];
  const conversationLines = [];

  lessonSets.forEach(lessonSet => {
    const resources = lessonSet.resources || {};

    (resources.stories || []).forEach(story => {
      if (seenStoryIds.has(story.id)) return;

      const storyForAppendix = isSampleMode
        ? filterMLStoryForSample(story, sampleSetsByType)
        : story;

      if (!storyForAppendix) return;

      seenStoryIds.add(story.id);

      stories.push({
        ...storyForAppendix,
        lessonSetTitle: lessonSet.title,
        language: lessonSet.language
      });
    });

    (resources.songsRhymes || []).forEach(song => {
      if (seenSongIds.has(song.id)) return;

      if (isSampleMode && songsRhymes.length >= 1) return;

      seenSongIds.add(song.id);

      songsRhymes.push({
        ...song,
        lessonSetTitle: lessonSet.title,
        language: lessonSet.language
      });
    });

    (resources.glossary || []).forEach(item => {
      if (seenGlossaryIds.has(item.id)) return;

      if (isSampleMode && !shouldKeepMLGlossaryItemForSample(item, sampleSetsByType)) {
        return;
      }

      seenGlossaryIds.add(item.id);

      glossary.push({
        ...item,
        lessonSetTitle: lessonSet.title,
        language: lessonSet.language
      });
    });

    (lessonSet.lessons || []).forEach(lesson => {
      (lesson.sentences || []).forEach(sentence => {
        const sentenceType = String(sentence.sentenceType || "").toLowerCase();

        if (!sentenceType.includes("conversation")) return;

        if (isSampleMode) {
          const set = getMLSampleSetKey(sentence.set);
          if (!set || !sampleSetsByType.conversation.has(set)) return;
        }

        const id = sentence.id || `${sentence.sentence || ""}-${sentence.translation || ""}-${sentence.set || ""}`;
        if (seenConversationIds.has(id)) return;

        seenConversationIds.add(id);

        conversationLines.push({
          ...sentence,
          id,
          lessonSetTitle: lessonSet.title,
          language: sentence.language || lesson.language || lessonSet.language
        });
      });
    });
  });

  stories.sort((a, b) => {
    const aSet = getMLStoryFirstSet(a);
    const bSet = getMLStoryFirstSet(b);
  
    if (aSet !== bSet) return aSet - bSet;
  
    return String(a.title || "").localeCompare(String(b.title || ""));
  });

  songsRhymes.sort((a, b) => {
    const aSequence = Number(a.sequence || 0);
    const bSequence = Number(b.sequence || 0);
  
    if (aSequence !== bSequence) return aSequence - bSequence;
  
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  
  return {
    stories,
    songsRhymes,
    glossary,
    conversationLines,
    studentLiteraturePages: buildMLStudentLiteraturePages(lessonSets)
  };
}

function buildMLStudentLiteraturePages(lessonSets = []) {
  const pagesByKey = new Map();

  lessonSets.forEach(lessonSet => {
    const lessonSetTitle = String(lessonSet.title || "").toLowerCase();

    if (!lessonSetTitle.includes("literature")) return;

    (lessonSet.lessons || []).forEach(lesson => {
      const lessonType = String(lesson.lessonType || "").toLowerCase();
      const lessonNumber = Number(lesson.sequence || lesson.lessonNumber || 0);

      if (lessonType.includes("exam")) return;

      // Week 11 / Term review lessons have storyline sentences for review,
      // but should not generate student notebook storyboard/copywork pages.
      if ([11, 23, 35].includes(lessonNumber)) return;

      const storyLines = (lesson.sentences || [])
        .filter(line =>
          String(line.type || "").toLowerCase().includes("literature") ||
          String(line.sentenceType || "").toLowerCase().includes("story")
        )
        .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
        .slice(0, 6);

      if (!storyLines.length) return;

      const lessonLabel =
        lesson.lessonLabel ||
        (lesson.sequence ? `Lesson ${lesson.sequence}` : "Lesson");

      const key = [
        lesson.language || lessonSet.language || "",
        lesson.term || "",
        lesson.week || "",
        lesson.subtitle || "",
        storyLines.map(line => line.id || line.sentence).join("|")
      ].join("::");

      if (pagesByKey.has(key)) return;

      pagesByKey.set(key, {
        id: lesson.id,
        lessonNumber: lessonLabel,
        title: lesson.title,
        subtitle: lesson.subtitle,
        language: lesson.language || lessonSet.language,
        term: lesson.term,
        week: lesson.week,
        weekLabel: lesson.weekLabel,
        lines: storyLines
      });
    });
  });

  return [...pagesByKey.values()]
    .sort((a, b) => Number(a.week || 0) - Number(b.week || 0));
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

function renderMLWeeklyLessons(section, options = {}) {
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

    ${options.includeReferences ? `
      ${renderMLDividerPage("References")}
      ${renderMLAppendices(section.appendices)}
    ` : ""}
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

function renderMLByLessonSet(section, options = {}) {
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

    ${options.includeReferences ? `
    ${renderMLDividerPage("References")}
    ${renderMLAppendices(section.appendices)}
  ` : ""}
  `;
}

function renderMLStoryResource(story) {
  const languageLabel = story.language || "Spanish/French";
  const groupedLines = groupMLStoryLinesByWeek(story.lines || []);

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
        ${groupedLines.map(group => `
          <section class="ml-story-week-group">
            <h3 class="ml-story-week-title">
              ${escapeHtml(group.weekLabel)}
            </h3>

            <div class="ml-story-week-lines">
              ${group.lines.map(renderMLStoryLine).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    </article>
  `;
}

function groupMLStoryLinesByWeek(lines = []) {
  const groups = new Map();

  [...lines]
    .sort((a, b) => {
      const aLine = Number(a.lineNumber || a.sequence || 0);
      const bLine = Number(b.lineNumber || b.sequence || 0);

      if (aLine && bLine && aLine !== bLine) return aLine - bLine;

      return String(a.sentence || "").localeCompare(String(b.sentence || ""));
    })
    .forEach(line => {
      const setNumber = getMLSetNumber(line.set);
      const weekLabel = setNumber && setNumber !== 999
        ? `Week ${setNumber}`
        : (line.set || "Week");

      if (!groups.has(weekLabel)) {
        groups.set(weekLabel, {
          weekLabel,
          lines: []
        });
      }

      groups.get(weekLabel).lines.push(line);
    });

  return [...groups.values()];
}

function formatMLStoryReference(line = {}) {
  const lineNumber = Number(line.lineNumber || line.sequence || 0);

  if (!lineNumber) {
    return line.reference || "";
  }

  return String(lineNumber);
}

function getMLLineBadgeClass(line = {}) {
  const weekNumber = Number(line.week || 0);

  if (weekNumber && weekNumber % 2 === 0) {
    return "ml-line-number-badge ml-line-number-badge-light";
  }

  return "ml-line-number-badge ml-line-number-badge-dark";
}

function renderMLStoryLine(line) {
  return `
    <div class="ml-story-line">
      <div class="ml-story-language-col">
        <div class="ml-story-line-inner">
          <div class="ml-story-reference ${getMLLineBadgeClass(line)}">
            ${escapeHtml(formatMLStoryReference(line))}
          </div>

          <div class="ml-story-text">
            ${escapeHtml(line.sentence || "")}
          </div>
        </div>
      </div>

      <div class="ml-story-translation-col">
        <div class="ml-story-line-inner">
          <div class="ml-story-reference ml-story-reference-spacer"></div>

          <div class="ml-story-text">
            ${escapeHtml(line.translation || "")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMLStudentLiteraturePages(pages = []) {
  if (!pages.length) return "";

  return `
    <section class="ml-student-literature-section section-break" id="ml-student-literature-pages">
      ${pages.map(page => `
        <div class="page-flow ml-student-page-flow ml-storyboard-copywork-page-flow">
          ${renderMLStoryboardCopyworkPage(page)}
        </div>
      `).join("")}
    </section>
  `;
}

function renderMLStoryboardCopyworkPage(page = {}) {
  const slots = (page.lines || []).slice(0, 5);

  return `
    <section class="ml-student-page ml-storyboard-copywork-page">
      <header class="ml-student-page-header">
        ${escapeHtml(page.lessonNumber || "Lesson")} Storyboards & Copywork
      </header>

      <div class="ml-appendix-top-rule"></div>

      <div class="ml-storyboard-copywork-layout">
        <div class="ml-storyboard-mini-grid">
          <div class="ml-storyboard-mini-box"></div>
          <div class="ml-storyboard-mini-box"></div>
          <div class="ml-storyboard-mini-box"></div>
        </div>

        <div class="ml-copywork-slots ml-copywork-slots-combined">
          ${slots.map(renderMLCopyworkSlot).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderMLStoryboardPage(page = {}) {
  return `
    <section class="ml-student-page ml-storyboard-page">
      <header class="ml-student-page-header">
        Literature – ${escapeHtml(page.lessonNumber || "Lesson")} Storyboard
      </header>

      <div class="ml-appendix-top-rule"></div>

      <div class="ml-storyboard-boxes">
        <div class="ml-storyboard-box"></div>
        <div class="ml-storyboard-box"></div>
        <div class="ml-storyboard-box"></div>
      </div>
    </section>
  `;
}

function renderMLCopyworkPage(page = {}) {
  const slots = (page.lines || []).slice(0, 6);

  return `
    <section class="ml-student-page ml-copywork-page">
      <header class="ml-student-page-header">
        Literature – ${escapeHtml(page.lessonNumber || "Lesson")} Copywork
      </header>

      <div class="ml-appendix-top-rule"></div>

      <div class="ml-copywork-slots">
        ${slots.map(renderMLCopyworkSlot).join("")}
      </div>
    </section>
  `;
}

function renderMLCopyworkSlot(line) {
  const lineNumber = Number(line?.lineNumber || line?.sequence || 0);

  return `
    <div class="ml-copywork-slot">
      <div class="ml-copywork-prompt">
        ${lineNumber ? `
          <span class="${getMLLineBadgeClass(line)}">${escapeHtml(lineNumber)}</span>
        ` : ""}

        <span class="ml-copywork-prompt-text">
          ${line ? escapeHtml(line.sentence || "") : ""}
        </span>
      </div>

      <div class="ml-copywork-line-row">
        <div class="ml-copywork-guide-line"></div>
        <div class="ml-copywork-write-line"></div>
      </div>

      <div class="ml-copywork-line-row">
        <div class="ml-copywork-guide-line"></div>
        <div class="ml-copywork-write-line"></div>
      </div>
    </div>
  `;
}

function renderMLSongResource(song) {
  const languageLabel = song.language || "Spanish/French";

  return `
    <article class="ml-story-resource ml-song-resource">
      <div class="ml-appendix-top-rule"></div>

      <header class="ml-story-header">
        <h2 class="ml-story-title">
          ${escapeHtml(song.title || "")}
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

      <div class="ml-song-columns">
        <div class="ml-song-text">
          ${formatInlineRichText(song.text || "").replace(/\n/g, "<br>")}
        </div>

        <div class="ml-song-text ml-song-translation">
          ${formatInlineRichText(song.translation || "").replace(/\n/g, "<br>")}
        </div>
      </div>
    </article>
  `;
}

function renderMLGlossaryResources(items = []) {
  if (!items.length) return "";

  const sections = new Map();

  items.forEach(item => {
    const sectionKey = item.type || "Vocabulary";
    const setKey = item.set || "Set";

    if (!sections.has(sectionKey)) {
      sections.set(sectionKey, {
        type: sectionKey,
        language: item.language,
        sets: new Map()
      });
    }

    const section = sections.get(sectionKey);

    if (!section.sets.has(setKey)) {
      section.sets.set(setKey, {
        set: setKey,
        items: []
      });
    }

    section.sets.get(setKey).items.push(item);
  });

  return [...sections.values()]
    .sort((a, b) => sortMLGlossaryType(a.type) - sortMLGlossaryType(b.type))
    .map(renderMLGlossarySection)
    .join("");
}

function sortMLGlossaryType(type = "") {
  const value = String(type || "").toLowerCase();

  if (value.includes("picture")) return 1;
  if (value.includes("literature")) return 2;
  if (value.includes("grammar")) return 3;

  return 999;
}

function renderMLGlossarySection(section) {
  const sets = [...section.sets.values()]
    .sort((a, b) => getMLSetNumber(a.set) - getMLSetNumber(b.set));

  return `
    <article class="ml-glossary-section">
      <div class="ml-glossary-set-list">
        ${sets.map(renderMLGlossarySet).join("")}
      </div>
    </article>
  `;
}

function renderMLGlossarySet(setGroup) {
  return `
    <section class="ml-glossary-set">
      <h3 class="ml-glossary-set-title">
        ${escapeHtml(setGroup.set || "Set")}
      </h3>

      <div class="ml-glossary-grid">
        ${(setGroup.items || [])
          .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
          .map(item => `
            <div class="ml-glossary-row">
              <div class="ml-glossary-language">
                ${escapeHtml(item.text || "")}
              </div>

              <div class="ml-glossary-translation">
                ${escapeHtml(item.translation || "")}
              </div>
            </div>
          `).join("")}
      </div>
    </section>
  `;
}

function renderMLConversationResources(items = []) {
  if (!items.length) return "";

  const sets = groupMLItemsBySet(items);

  return `
    <article class="ml-conversation-section">
      <div class="ml-appendix-top-rule"></div>

      <div class="ml-conversation-set-pairs">
        ${sets.map(([setLabel, setItems]) => renderMLConversationSet({
          set: setLabel,
          items: setItems
        })).join("")}
      </div>
    </article>
  `;
}

function renderMLConversationSet(setGroup) {
  return `
    <section class="ml-conversation-set">
      <h3 class="ml-glossary-set-title">
        ${escapeHtml(setGroup.set || "Set")}
      </h3>

      <div class="ml-conversation-table">
        ${(setGroup.items || [])
          .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
          .map(item => `
            <div class="ml-conversation-line">
              <div class="ml-conversation-language">
                ${escapeHtml(item.sentence || "")}
              </div>

              <div class="ml-conversation-translation">
                ${escapeHtml(item.translation || "")}
              </div>
            </div>
          `).join("")}
      </div>
    </section>
  `;
}

function renderMLTeacherReferences(section) {
  const isSampleMode = section.sampleMode === true;
  const studentLiteraturePages = section.appendices?.studentLiteraturePages || [];

  return `
    ${isSampleMode && studentLiteraturePages.length ? `
      ${renderMLDividerPage("Student Work")}
      ${renderMLStudentLiteraturePages(studentLiteraturePages)}
    ` : ""}

    ${renderMLDividerPage("References")}
    ${renderMLAppendices(section.appendices)}
  `;
}

function renderMLDividerPage(title = "") {
  return `
    <div class="page-flow ml-divider-page section-break">
      <section class="ml-divider-inner">
        <div class="ml-divider-title">${escapeHtml(title)}</div>
      </section>
    </div>
  `;
}

function renderMLStudentNotebookPrint(section, notebookType = "full") {
  const hasStudentWork = (section.appendices.studentLiteraturePages || []).length;
  const includeReferences = notebookType !== "work-only";

  return `
    ${hasStudentWork ? `
      ${renderMLDividerPage("Student Work")}
      ${renderMLStudentLiteraturePages(section.appendices.studentLiteraturePages || [])}
    ` : ""}

    ${includeReferences ? `
      ${renderMLDividerPage("References")}
      ${renderMLAppendices(section.appendices, {
        includeSongs: true,
        includeStories: true,
        includePictureStudyVocab: true,
        includeLiteratureVocab: true,
        includeConversationLines: true,
        includeStudentLiteraturePages: false
      })}
    ` : ""}
  `;
}

function renderMLReferencePrint(section, referenceType = "full") {
  return renderMLAppendices(section.appendices, getMLAppendixOptionsForReference(referenceType));
}

function getMLAppendixOptionsForReference(referenceType = "full") {
  const none = {
    includeSongs: false,
    includeStories: false,
    includePictureStudyVocab: false,
    includeLiteratureVocab: false,
    includeConversationLines: false,
    includeStudentLiteraturePages: false
  };

  switch (referenceType) {
    case "songs-rhymes":
      return { ...none, includeSongs: true };

    case "storylines":
      return { ...none, includeStories: true };

    case "picture-study-vocab":
      return { ...none, includePictureStudyVocab: true };

    case "literature-vocab":
      return { ...none, includeLiteratureVocab: true };

    case "conversation-lines-phrases":
      return { ...none, includeConversationLines: true };

    case "full":
    default:
      return {
        ...none,
        includeSongs: true,
        includeStories: true,
        includePictureStudyVocab: true,
        includeLiteratureVocab: true,
        includeConversationLines: true
      };
  }
}

function filterMLGlossaryItems(items = [], options = {}) {
  return (items || []).filter(item => {
    const type = String(item.type || "").toLowerCase();

    if (type.includes("picture")) {
      return options.includePictureStudyVocab;
    }

    if (type.includes("literature")) {
      return options.includeLiteratureVocab;
    }

    return options.includePictureStudyVocab || options.includeLiteratureVocab;
  });
}

function renderMLAppendices(appendices = {}, options = {}) {
  const includeStories = options.includeStories ?? true;
  const includeSongs = options.includeSongs ?? true;
  const includeConversationLines = options.includeConversationLines ?? true;
  const includeStudentLiteraturePages = options.includeStudentLiteraturePages ?? false;

  const glossaryItems = filterMLGlossaryItems(appendices.glossary || [], {
    includePictureStudyVocab: options.includePictureStudyVocab ?? true,
    includeLiteratureVocab: options.includeLiteratureVocab ?? true
  });

  const stories = includeStories ? (appendices.stories || []) : [];
  const songsRhymes = includeSongs ? (appendices.songsRhymes || []) : [];
  const conversationLines = includeConversationLines ? (appendices.conversationLines || []) : [];
  const studentLiteraturePages = includeStudentLiteraturePages
    ? (appendices.studentLiteraturePages || [])
    : [];

  const pictureStudyGlossary = glossaryItems.filter(item =>
    String(item.type || "").toLowerCase().includes("picture")
  );

  const literatureGlossary = glossaryItems.filter(item =>
    String(item.type || "").toLowerCase().includes("literature")
  );

  const hasStories = stories.length;
  const hasSongs = songsRhymes.length;
  const hasPictureStudyGlossary = pictureStudyGlossary.length;
  const hasLiteratureGlossary = literatureGlossary.length;
  const hasConversationLines = conversationLines.length;
  const hasStudentLiteraturePages = studentLiteraturePages.length;

  if (
    !hasStories &&
    !hasSongs &&
    !hasPictureStudyGlossary &&
    !hasLiteratureGlossary &&
    !hasConversationLines &&
    !hasStudentLiteraturePages
  ) {
    return "";
  }

  return `
    <section class="ml-appendices">
      ${hasSongs ? `
        <div class="page-flow ml-appendix-page ml-appendix-songs section-break" id="ml-appendix-songs">
          <section class="ml-appendix-block ml-songs-appendix">
            <h1 class="lesson-page-title ml-appendix-title">
              Songs & Rhymes
            </h1>
      
            <div class="ml-song-list">
              ${songsRhymes.map(renderMLSongResource).join("")}
            </div>
          </section>
        </div>
      ` : ""}

      ${hasStories ? `
        <div class="page-flow ml-appendix-page ml-appendix-storylines section-break" id="ml-appendix-storylines">
          <section class="ml-appendix-block ml-storylines-appendix">
            <h1 class="lesson-page-title ml-appendix-title">
              Storylines
            </h1>
          
            <div class="ml-story-list">
              ${stories.map(renderMLStoryResource).join("")}
            </div>
          </section>
        </div>
      ` : ""}

      ${hasPictureStudyGlossary ? `
        <div class="page-flow ml-appendix-page ml-appendix-glossary section-break" id="ml-appendix-picture-study-vocab">
          <section class="ml-appendix-block ml-glossary-appendix">
            <h1 class="lesson-page-title ml-appendix-title">
              Picture Study Vocab
            </h1>

            <div class="ml-appendix-top-rule"></div>
      
            <div class="ml-glossary-list">
              ${renderMLGlossaryResources(pictureStudyGlossary)}
            </div>
          </section>
        </div>
      ` : ""}

      ${hasLiteratureGlossary ? `
        <div class="page-flow ml-appendix-page ml-appendix-glossary section-break" id="ml-appendix-literature-vocab">
          <section class="ml-appendix-block ml-glossary-appendix">
            <h1 class="lesson-page-title ml-appendix-title">
              Literature Vocab
            </h1>

            <div class="ml-appendix-top-rule"></div>
      
            <div class="ml-glossary-list">
              ${renderMLGlossaryResources(literatureGlossary)}
            </div>
          </section>
        </div>
      ` : ""}

      ${hasConversationLines ? `
        <div class="page-flow ml-appendix-page ml-appendix-conversations section-break" id="ml-appendix-conversations">
          <section class="ml-appendix-block ml-conversations-appendix">
            <h1 class="lesson-page-title ml-appendix-title">
              Conversation Lines & Phrases
            </h1>
      
            <div class="ml-glossary-list ml-conversation-list">
              ${renderMLConversationResources(conversationLines)}
            </div>
          </section>
        </div>
      ` : ""}

      ${hasStudentLiteraturePages ? `
        ${renderMLStudentLiteraturePages(studentLiteraturePages)}
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
        <div class="ml-lesson-opening-block">
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
        </div>

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

  if (
    !phraseLine ||
    phraseLine === "-" ||
    phraseLine === "–" ||
    phraseLine === "—"
  ) {
    return "";
  }

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
  let text = escapeHtml(title || "").replace(/\n/g, "<br>");

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

  let typeLabel = types.length === 1 ? types[0] : fallback;

  const typeLower = typeLabel.toLowerCase();
  
  if (typeLower.includes("picture")) {
    typeLabel = "Picture Study Vocab";
  } else if (typeLower.includes("literature")) {
    typeLabel = "Literature Vocab";
  } else if (typeLower.includes("conversation")) {
    typeLabel = "Conversation Lines & Phrases";
  } else if (typeLower.includes("song")) {
    typeLabel = "Songs & Rhymes";
  }
  
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
