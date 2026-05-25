function renderModernLanguageLessonsSection(section) {
  return `
    <div class="page-flow ml-lessons-section section-break">
      <section class="flow-block">
        <h1 class="lesson-page-title">${escapeHtml(section.title || "")}</h1>
        <div class="term-banner">Modern Language Lessons</div>

        <div class="ml-lesson-sets">
          ${(section.lessonSets || []).map(lessonSet => renderMLLessonSet(lessonSet)).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderMLLessonSet(lessonSet) {
  return `
    <section class="ml-lesson-set">
      <h2 class="ml-lesson-set-title">${escapeHtml(lessonSet.title || "")}</h2>

      <div class="ml-lesson-list">
        ${(lessonSet.lessons || []).map(lesson => renderMLLesson(lesson)).join("")}
      </div>
    </section>
  `;
}

function renderMLLesson(lesson) {
  return `
    <article class="ml-lesson-card">
      <div class="ml-lesson-toprow">
        <div class="ml-lesson-week">${escapeHtml(lesson.weekLabel || "")}</div>
        <div class="ml-lesson-type">${escapeHtml(lesson.lessonType || "")}</div>
      </div>

      <h3 class="ml-lesson-title">${escapeHtml(lesson.title || "")}</h3>

      ${lesson.subtitle ? `
        <div class="ml-lesson-subtitle">${escapeHtml(lesson.subtitle)}</div>
      ` : ""}

      <div class="ml-lesson-meta">
        ${renderMLMetaBlock("Materials", lesson.materials)}
        ${renderMLMetaBlock("Prep", lesson.prep)}
        ${renderMLMetaBlock("Phrase of the Week", lesson.phraseOfWeek)}
        ${renderMLMetaBlock("Lesson", lesson.instructions)}
        ${renderMLMetaBlock("Grammar", lesson.grammarInstructions)}
        ${renderMLMetaBlock("Practice", lesson.practiceInstructions)}
        ${renderMLMetaBlock("Cultural Connection", lesson.cctBlock)}
      </div>
    </article>
  `;
}

function renderMLMetaBlock(label, content) {
  const text = String(content || "").trim();

  if (!text) return "";

  return `
    <section class="ml-meta-block">
      <div class="ml-meta-label">${escapeHtml(label)}</div>
      <div class="ml-meta-content">${formatInlineRichText(text).replace(/\n/g, "<br>")}</div>
    </section>
  `;
}
