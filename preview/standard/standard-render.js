function renderLessonsSection(section) {
  let html = "";

  (section.terms || []).forEach((termGroup, index) => {
    const termTitle = termGroup.term || "";

    html += `
      <div class="page-flow lessons-section ${index === 0 ? "section-break" : "term-start"}">

        <!-- Normal preview layout -->
        <div class="lesson-preview-flow">
          <div class="lesson-page-header">
            <h1 class="lesson-page-title">${escapeHtml(section.title || "")}</h1>

            <div class="lesson-page-linkbox">
              <a href="${escapeHtml(section.linkPageUrl || "#")}" target="_blank">
                Click THIS text or<br>
                scan the QR code<br>
                for links.
              </a>
              ${qrCodeUrl(section.linkPageUrl, 140) ? `
                <img
                  src="${escapeHtml(qrCodeUrl(section.linkPageUrl, 140))}"
                  alt="QR code for lesson links"
                  class="lesson-page-qr-placeholder"
                />
              ` : `
                <div class="lesson-page-qr-placeholder">QR</div>
              `}
            </div>
          </div>

          <div class="term-banner">${escapeHtml(termTitle)}</div>

          <div class="lesson-list">
            ${(termGroup.lessons || []).map(lesson => renderLesson(lesson)).join("")}
          </div>
        </div>

        <!-- PDF print layout: table header repeats on each printed page -->
        <table class="lesson-print-table">
          <thead>
            <tr>
              <th>
                <div class="lesson-print-repeat-header">
                  <div class="lesson-page-header lesson-page-header--print">
                    <h1 class="lesson-page-title">${escapeHtml(section.title || "")}</h1>

                    <div class="lesson-page-linkbox">
                      <a href="${escapeHtml(section.linkPageUrl || "#")}" target="_blank">
                        Click THIS text or<br>
                        scan the QR code<br>
                        for links.
                      </a>
                      ${qrCodeUrl(section.linkPageUrl, 140) ? `
                        <img
                          src="${escapeHtml(qrCodeUrl(section.linkPageUrl, 140))}"
                          alt="QR code for lesson links"
                          class="lesson-page-qr-placeholder"
                        />
                      ` : `
                        <div class="lesson-page-qr-placeholder">QR</div>
                      `}
                    </div>
                  </div>

                  <div class="term-banner">${escapeHtml(termTitle)}</div>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <div class="lesson-list">
                  ${(termGroup.lessons || []).map(lesson => renderLesson(lesson)).join("")}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

      </div>
    `;
  });

  return html;
}

function renderLesson(lesson) {
  const title = lesson.title || "";
  const body = cleanLessonText(lesson.body || "");
  const teacherNotes = lesson.teacherNotes || "";
  const hasTeacherNotes = String(teacherNotes).trim().length > 0;
  const editUrl = lesson.editUrl || "";
  
  const bodyLines = body.split("\n");
  const firstBodyLine = (bodyLines[0] || "").trim();

  const subtitle =
    firstBodyLine &&
    !isLessonCalloutLine(firstBodyLine) &&
    !firstBodyLine.startsWith("➜")
      ? bodyLines.shift()
      : "";
  
  const calloutLines = [];
  
  for (let i = bodyLines.length - 1; i >= 0; i--) {
    if (isLessonCalloutLine(bodyLines[i])) {
      calloutLines.unshift(bodyLines.splice(i, 1)[0]);
    }
  }
  
  const callout = calloutLines.join("\n");
  const remainingBody = bodyLines.join("\n");

  return `
    <section class="flow-block lesson-block">
      ${editUrl ? `
        <a href="${escapeHtml(editUrl)}" target="_blank" class="preview-only edit-button lesson-margin-edit">Edit</a>
      ` : ""}
      
      <div class="lesson-week-col">
        ${escapeHtml(lesson.weekLabel || "")}
      </div>

      <div class="lesson-main-col">

        <div class="lesson-opening-block">
          <div class="lesson-title-line">
            ⬚ ${escapeHtml(title)}
          </div>
          
          ${subtitle ? `
            <div class="lesson-subtitle-line">${formatInlineRichText(subtitle)}</div>
          ` : ""}
          
          ${callout ? `
            <div class="lesson-materials-box">${formatInlineRichText(callout).replace(/\n/g, "<br>")}</div>
          ` : ""}
        </div>
        
        <div class="lesson-body">
          ${formatLessonBody(remainingBody)}
        </div>
      </div>

        <aside class="lesson-notes-col ${hasTeacherNotes ? "" : "lesson-notes-empty"}">
          ${hasTeacherNotes ? formatTeacherNotes(teacherNotes) : ""}
        </aside>
    </section>
  `;
}
