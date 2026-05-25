function renderModernLanguageLessonsSection(section) {
  return `
    <div class="page-flow ml-lessons-section section-break">
      <section class="flow-block">
        <h1 class="lesson-page-title">${escapeHtml(section.title || "")}</h1>
        <div class="term-banner">Modern Language Lessons</div>

        <div class="lesson-list">
          ${(section.lessonSets || []).map(lessonSet => `
            <section class="flow-block lesson-block">
              <div class="lesson-week-col">
                ${escapeHtml(lessonSet.language || "")}
              </div>

              <div class="lesson-main-col">
                <div class="lesson-title-line">
                  ⬚ ${escapeHtml(lessonSet.title || "")}
                </div>

                <div class="lesson-body">
                  ${escapeHtml((lessonSet.lessons || []).length)} lesson(s)
                </div>
              </div>

              <aside class="lesson-notes-col">
                ${escapeHtml(lessonSet.perWeek || "")}x/week<br>
                ${escapeHtml(lessonSet.weeksTotal || "")} weeks
              </aside>
            </section>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}
