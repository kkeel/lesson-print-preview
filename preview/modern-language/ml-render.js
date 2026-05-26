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
          ${renderMLTextBlock(lesson.grammarInstructions)}
          ${renderMLTextBlock(lesson.practiceInstructions)}
          ${renderMLTextBlock(lesson.cctBlock)}
          ${renderMLVocabTable(lesson.vocab)}
          ${renderMLSentenceTable(lesson.sentences)}
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

function renderMLVocabTable(vocab = []) {
  if (!Array.isArray(vocab) || !vocab.length) return "";

  return `
    <section class="ml-resource-block">
      <div class="ml-resource-title">Vocabulary</div>

      <table class="ml-resource-table ml-vocab-table">
        <tbody>
          ${vocab.map(item => `
            <tr>
              <td class="ml-resource-primary">${escapeHtml(item.text || "")}</td>
              <td class="ml-resource-translation">${escapeHtml(item.translation || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderMLSentenceTable(sentences = []) {
  if (!Array.isArray(sentences) || !sentences.length) return "";

  return `
    <section class="ml-resource-block">
      <div class="ml-resource-title">Sentences</div>

      <table class="ml-resource-table ml-sentence-table">
        <tbody>
          ${sentences.map(item => `
            <tr>
              <td class="ml-resource-primary">${escapeHtml(item.sentence || "")}</td>
              <td class="ml-resource-translation">${escapeHtml(item.translation || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}
