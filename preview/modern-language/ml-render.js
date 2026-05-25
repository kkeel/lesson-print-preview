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
        <div class="term-banner">Modern Language Lessons</div>

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
        <div class="term-banner">Modern Language Lessons</div>

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
        <div class="ml-topic-label">
          ${escapeHtml(lesson.lessonSetTitle || lesson.language || "")}
        </div>

        <div class="ml-lesson-title-line">⬚ ${escapeHtml(lesson.title || "")}</div>

        ${lesson.subtitle ? `
          <div class="ml-lesson-subtitle-line">${formatInlineRichText(lesson.subtitle)}</div>
        ` : ""}

        ${lesson.materials ? `
          <div class="ml-lesson-materials-box">${formatInlineRichText(lesson.materials).replace(/\n/g, "<br>")}</div>
        ` : ""}

        <div class="ml-lesson-body">
          ${renderMLTextBlock(lesson.prep)}
          ${renderMLTextBlock(lesson.phraseOfWeek)}
          ${renderMLTextBlock(lesson.instructions)}
          ${renderMLTextBlock(lesson.grammarInstructions)}
          ${renderMLTextBlock(lesson.practiceInstructions)}
          ${renderMLTextBlock(lesson.cctBlock)}
        </div>
      </div>

      <aside class="ml-lesson-notes">
        ${lesson.lessonType ? `<strong>${escapeHtml(lesson.lessonType)}</strong><br>` : ""}
        ${lesson.lessonLabel ? `${escapeHtml(lesson.lessonLabel)}<br>` : ""}
        ${lesson.weekLabel ? `${escapeHtml(lesson.weekLabel)}` : ""}
      </aside>
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
