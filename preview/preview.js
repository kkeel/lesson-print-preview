const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const preview = document.getElementById("preview");

if (!id) {
  preview.innerHTML = "<p>No lesson plan set selected.</p>";
} else {
  fetch(`../data/packets/${id}.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      renderPacket(data);
    })
    .catch(error => {
      preview.innerHTML = `
        <p>Could not load preview for ${id}.</p>
        <pre>${error.message}</pre>
      `;
      console.error(error);
    });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function qrCodeUrl(value, size = 160) {
  const url = String(value || "").trim();
  if (!url || url === "#") return "";

  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
}

function formatInlineRichText(value) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

function formatTeacherNotes(value) {
  return String(value ?? "")
    .split("\n")
    .map(line => {
      const trimmed = line.trim();

      if (!trimmed) return "";

      // Bold all-caps note headers like: • VOCABULARY
      if (/^[•·-]?\s*[A-Z][A-Z\s&/-]{2,}$/.test(trimmed)) {
        return `<strong>${formatInlineRichText(trimmed)}</strong>`;
      }

      // Bold vocabulary-style terms at the beginning of a line:
      // Color Palette: ...
      // Linear Perspective: ...
      return formatInlineRichText(line).replace(
        /^(\s*(?:[•·-]\s*)?)([^:<]{2,45}:)/,
        '$1<strong>$2</strong>'
      );
    })
    .join("<br>");
}

function isLessonCalloutLine(line) {
  return (
    line.startsWith("⍞ Materials:") ||
    line.startsWith("⍞ Art Print Resource:") ||
    line.startsWith("Vocabulary:")
  );
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function formatExamContent(value) {
  const lines = String(value ?? "").split("\n");

  function isQuestionLine(text) {
    return (
      text.startsWith("·") ||
      text.startsWith("•") ||
      text.startsWith("-") ||
      /^[a-z]\)/i.test(text) ||
      /^OR$/i.test(text)
    );
  }

  function nextNonBlankLine(index) {
    for (let i = index + 1; i < lines.length; i++) {
      const text = lines[i].trim();
      if (text) return text;
    }
    return "";
  }

  return lines.map((line, index) => {
    const text = line.trim();

    if (!text) {
      return `<div class="exam-line-spacer"></div>`;
    }

    const separatedBefore = index === 0 || !lines[index - 1].trim();
    const nextText = nextNonBlankLine(index);
    const looksLikeShortHeader =
      text.length <= 60 &&
      !/[.!?]$/.test(text) &&
      !/^Tell\b/i.test(text) &&
      !/^Discuss\b/i.test(text) &&
      !/^Explain\b/i.test(text) &&
      !/^Describe\b/i.test(text) &&
      !/^Create\b/i.test(text) &&
      !/^Choose\b/i.test(text);

    const isTopicHeading =
      separatedBefore &&
      looksLikeShortHeader &&
      isQuestionLine(nextText);

    if (isTopicHeading) {
      return `<div class="exam-topic-heading">${escapeHtml(text)}</div>`;
    }

    return `<div class="exam-question-line">${escapeHtml(text)}</div>`;
  }).join("");
}

function formatLessonBody(value) {
  return formatInlineRichText(value)
    .replace(/\\\./g, ".")
    .replace(/\n/g, "<br>")
    .replace(/(<br>|^)\s*(➜\s*[^<]+)/g, '$1<span class="lesson-section-heading">$2</span>');
}

function cleanLessonText(value) {
  return String(value ?? "").replace(/\\\./g, ".");
}

function booksToLines(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  // New preferred separator from Airtable.
  if (text.includes("||")) {
    return text
      .split("||")
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => escapeHtml(item))
      .join("<br>");
  }

  // Preserve real line breaks if the JSON already has them.
  if (text.includes("\n")) {
    return nl2br(text);
  }

  // Fallback: leave text as-is so book titles with commas do not break.
  return escapeHtml(text);
}

function weeklyCellToLines(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  return text
    .split("*")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => escapeHtml(item))
    .join("<br>");
}

function renderPacket(data) {
  let html = "";

  if (!data.sections || !Array.isArray(data.sections)) {
    throw new Error("Missing sections array in JSON");
  }

  data.sections.forEach(section => {
    html += renderSection(section, data);
  });

  preview.innerHTML = html;
}

function renderSection(section, packetData) {
  if (section.type === "cover") {
    return renderCoverSection(section, packetData);
  }
  
  if (section.type === "header") {
    return renderHeaderSection(section, packetData);
  }

  if (section.type === "howto") {
    return renderHowToSection(section);
  }

  if (section.type === "lessons") {
    return renderLessonsSection(section);
  }

  if (section.type === "exams") {
    return renderExamsSection(section);
  }

  return "";
}

function renderCoverSection(section, packetData) {
  const title = section.title || packetData.title || "";
  const subtitle = section.subtitle || "";
  const gradeText = section.gradeText || packetData.gradeText || "";

  return `
    <div class="page-flow cover-section">
      <section class="flow-block cover-block">
        <div class="cover-inner">
          <div class="cover-header-row">
            <div class="cover-brand-line">Alveary Lesson Plan</div>
            ${gradeText ? `<div class="cover-grade-line">${escapeHtml(gradeText)}</div>` : ""}
          </div>

          <div class="cover-top-rule"></div>

          <div class="cover-main">
            ${title ? `<div class="cover-title-main">${escapeHtml(title)}</div>` : ""}
            ${subtitle ? `<div class="cover-subtitle-main">${escapeHtml(subtitle)}</div>` : ""}
          </div>

          <div class="cover-footer">
            <img src="../images/Alveary Greens.png" alt="Alveary logo" class="cover-logo" />
            <div class="cover-footer-line">©2026 Charlotte Mason Institute®</div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderHeaderSection(section, packetData) {
  let html = `<div class="page-flow header-section">`;
  const headerEditUrl = section.editUrl || "";

  html += renderHeaderIntro(packetData);

  (section.items || []).forEach(item => {
    html += renderHeaderItem(item, headerEditUrl);
  });

  html += `</div>`;
  return html;
}

function renderHeaderIntro(packetData) {
  const title = packetData.subject || "";
  const lessonSetName = packetData.lessonSetName || "";
  const gradeText = packetData.gradeText || "";

  return `
    <section class="flow-block header-page-intro">
      <div class="header-page-toprow">
        <div class="header-page-brand">
          <img src="../images/Alveary Greens.png" alt="Alveary logo" class="header-page-logo" />
        </div>

        <div class="header-page-title-pill">
          ${escapeHtml(title)}
        </div>
      </div>

      <div class="header-page-subbar">
        <div class="header-page-subbar-title">${escapeHtml(lessonSetName || title)}</div>
        <div class="header-page-subbar-grade">${escapeHtml(gradeText)}</div>
      </div>
    </section>
  `;
}

function renderHeaderItem(item, headerEditUrl = "") {
  if (item.kind === "about-group" || item.kind === "tips-group") {
    const iconSrc =
      item.kind === "about-group"
        ? "../images/header_icons/About the Course.png"
        : "../images/header_icons/Placement & Combining Tips.png";
  
    return `
      <section class="flow-block header-block header-group-block">
        ${headerEditUrl ? `
          <a href="${escapeHtml(headerEditUrl)}" target="_blank" class="preview-only edit-button header-margin-edit">Edit</a>
        ` : ""}
        <div class="header-panel">
          <div class="header-panel-icon-col">
            <img src="${iconSrc}" alt="${escapeHtml(item.entries?.[0]?.title || item.title || "")}" class="header-panel-icon" />
          </div>
  
          <div class="header-panel-content">
            ${(item.entries || []).map(entry => `
              <div class="header-entry">
                ${entry.title ? `<h3 class="header-entry-title">${escapeHtml(entry.title)}</h3>` : ""}
                <p>${nl2br(entry.content || "")}</p>
              </div>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  if (item.kind === "planning-prep-group") {
    const iconSrc = "../images/header_icons/Planning & Prep.png";
  
    return `
      <section class="flow-block header-block header-group-block">
        ${headerEditUrl ? `
          <a href="${escapeHtml(headerEditUrl)}" target="_blank" class="preview-only edit-button header-margin-edit">Edit</a>
        ` : ""}
        <div class="header-panel">
          <div class="header-panel-icon-col">
            <img src="${iconSrc}" alt="Planning & Prep" class="header-panel-icon" />
          </div>
  
          <div class="header-panel-content planning-prep-content">
            <h3 class="header-entry-title">Planning & Prep</h3>
  
            ${(item.entries || []).map(entry => `
              <div class="planning-prep-entry">
                ${entry.title ? `<h4 class="planning-prep-subtitle">${escapeHtml(entry.title)}</h4>` : ""}
                <p>${nl2br(entry.content || "")}</p>
              </div>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  if (item.kind === "books-resources") {
    const iconSrc = "../images/header_icons/Books & Resources.png";
    const linkUrl = item.linkUrl || "#";
  
    return `
      <section class="flow-block header-block header-group-block">
        ${headerEditUrl ? `
          <a href="${escapeHtml(headerEditUrl)}" target="_blank" class="preview-only edit-button header-margin-edit">Edit</a>
        ` : ""}
        <div class="header-panel">
          <div class="header-panel-icon-col">
            <img src="${iconSrc}" alt="Books & Resources" class="header-panel-icon" />
          </div>
  
          <div class="header-panel-content books-resources-content">
            <h3 class="header-entry-title">Books & Resources</h3>
  
            <p class="books-resources-intro">
              For book rationales and purchase options, click the Book List link or<br>
              scan the QR code below.
            </p>
  
            <p class="books-resources-link-line">
              ∞ <a href="${escapeHtml(linkUrl)}" target="_blank">View Book List Details</a>
            </p>
  
            <div class="books-resources-list">
              ${(item.groups || []).map(group => `
                <div class="books-resource-group ${group.type === "course" ? "books-resource-course" : "books-resource-topic"}">
                  <h4>${escapeHtml(group.title || "")}</h4>
  
                  ${(group.books || []).map(book => {
                    const title = typeof book === "string" ? book : book.title;
                    const resourceId = typeof book === "string" ? "" : book.resourceId;
                    const imgSrc = resourceId ? `../images/resource_covers/${escapeHtml(resourceId)}.webp` : "";
                  
                    return `
                      <div class="books-resource-book">
                        ${imgSrc ? `<img src="${imgSrc}" alt="" class="books-resource-cover" />` : `<div class="books-resource-cover-placeholder"></div>`}
                        <div class="books-resource-title">${escapeHtml(title || "")}</div>
                      </div>
                    `;
                  }).join("")}
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </section>
    `;
  }

    if (item.kind === "supplies-resources") {
      const iconSrc = "../images/header_icons/Supplies.png";
      const linkUrl = item.linkUrl || "#";
      const basicSuppliesUrl = item.basicSuppliesUrl || "#";
      const hasSupplyGroups = (item.groups || []).some(group => (group.supplies || []).length);
  
      return `
        <section class="flow-block header-block header-group-block">
          ${headerEditUrl ? `
            <a href="${escapeHtml(headerEditUrl)}" target="_blank" class="preview-only edit-button header-margin-edit">Edit</a>
          ` : ""}
          <div class="header-panel">
            <div class="header-panel-icon-col">
              <img src="${iconSrc}" alt="Supplies" class="header-panel-icon" />
            </div>
  
            <div class="header-panel-content supplies-resources-content">
              <h3 class="header-entry-title">Supplies</h3>
  
              <p class="supplies-resources-intro">
                For supply list details and basic supplies helpful to have on hand, click the links or<br>
                scan the QR code below.
              </p>
  
              <p class="supplies-resources-link-line">
                ∞ <a href="${escapeHtml(basicSuppliesUrl)}" target="_blank">View Basic Supplies</a>
              </p>
  
              ${hasSupplyGroups ? `
                <p class="supplies-resources-link-line">
                  ∞ <a href="${escapeHtml(linkUrl)}" target="_blank">View Supply List Details</a>
                </p>
  
                <div class="supplies-resources-list">
                  ${(item.groups || []).map(group => {
                    const supplies = group.supplies || [];
  
                    if (!supplies.length) return "";
  
                    return `
                      <div class="supplies-resource-group ${group.type === "course" ? "supplies-resource-course" : "supplies-resource-topic"}">
                        <h4>${escapeHtml(group.title || "")}</h4>
  
                        ${supplies.map(supply => {
                          const title = typeof supply === "string" ? supply : supply.title;
                          const supplyId = typeof supply === "string" ? "" : supply.supplyId;
                          const imgSrc = supplyId ? `../images/supply_covers/${escapeHtml(supplyId)}.webp` : "";
  
                          return `
                            <div class="supplies-resource-supply">
                              ${imgSrc ? `<img src="${imgSrc}" alt="" class="supplies-resource-cover" />` : `<div class="supplies-resource-cover-placeholder"></div>`}
                              <div class="supplies-resource-title">${escapeHtml(title || "")}</div>
                            </div>
                          `;
                        }).join("")}
                      </div>
                    `;
                  }).join("")}
                </div>
              ` : `
                <p class="supplies-resources-empty">(No Subject Supplies Assigned)</p>
              `}
            </div>
          </div>
        </section>
      `;
    }

  if (item.kind === "scheduling") {
    const iconSrc = "../images/header_icons/Scheduling.png";
  
    return `
      <section class="flow-block header-block header-group-block">
        ${headerEditUrl ? `
          <a href="${escapeHtml(headerEditUrl)}" target="_blank" class="preview-only edit-button header-margin-edit">Edit</a>
        ` : ""}
        <div class="header-panel">
          <div class="header-panel-icon-col">
            <img src="${iconSrc}" alt="Scheduling" class="header-panel-icon" />
          </div>
  
          <div class="header-panel-content">
            <h3 class="header-entry-title">Scheduling</h3>
  
            <table class="schedule-table">
              <thead>
                <tr>
                  <th>GRADE</th>
                  <th>SCHEDULE INFO.</th>
                  <th>BOOKS</th>
                </tr>
              </thead>
              <tbody>
                ${(item.rows || []).map(row => `
                  <tr class="${row.rowType || ""}">
                    <td class="schedule-grade-cell">${escapeHtml(row.grade || "")}</td>
                    <td class="schedule-info-cell">${nl2br(row.scheduleInfo || "")}</td>
                    <td class="schedule-books-cell">${booksToLines(row.books || "")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            ${item.weeklyView?.rows?.length ? `
              <div class="weekly-view-block">
                <h4 class="weekly-view-title">Sample Weekly View</h4>
            
                <div class="weekly-view-grid">
                  <div class="weekly-view-day-header">Day 1</div>
                  <div class="weekly-view-day-header">Day 2</div>
                  <div class="weekly-view-day-header">Day 3</div>
                  <div class="weekly-view-day-header">Day 4</div>
                  <div class="weekly-view-day-header">Day 5</div>
                
                  ${item.weeklyView.rows.map(row => `
                    <div class="weekly-view-row-full">
                      ${nl2br(row.label || "")}
                    </div>
                
                    ${(row.days || []).map(day => `
                      <div class="weekly-view-cell">
                        ${weeklyCellToLines(day)}
                      </div>
                    `).join("")}
                  `).join("")}
                </div>
              </div>
            ` : ""}
          </div>
        </div>
      </section>
    `;
  }

  if (item.kind === "about" || item.kind === "scheduling" || item.kind === "planning-prep" || item.kind === "text") {
    return `
      <section class="flow-block header-block">
        <h2>${escapeHtml(item.title || "")}</h2>
        <p>${nl2br(item.content || "")}</p>
      </section>
    `;
  }

  if (item.kind === "book-reference" || item.kind === "supply-reference") {
    return `
      <section class="flow-block header-block reference-block">
        <h2>${escapeHtml(item.title || "")}</h2>
        <p>${nl2br(item.content || "")}</p>
        <p><a href="${escapeHtml(item.url || "#")}" target="_blank">${escapeHtml(item.linkLabel || "")}</a></p>
        <div class="qr-placeholder">QR Placeholder</div>
      </section>
    `;
  }

    if (item.kind === "quick-links") {
      const iconSrc = "../images/header_icons/Quick Links.png";
      const linkPageUrl = item.linkPageUrl || "#";
      const groups = item.groups || [];
      const hasLinks = groups.some(group => (group.links || []).length);
  
      return `
        <section class="flow-block header-block header-group-block">
          ${headerEditUrl ? `
            <a href="${escapeHtml(headerEditUrl)}" target="_blank" class="preview-only edit-button header-margin-edit">Edit</a>
          ` : ""}
          <div class="header-panel">
            <div class="header-panel-icon-col">
              <img src="${iconSrc}" alt="Quick Links" class="header-panel-icon" />
            </div>
  
            <div class="header-panel-content quick-links-content">
              <div class="quick-links-layout">
                <div class="quick-links-main">
                  <h3 class="header-entry-title">Quick Links</h3>
  
                  ${hasLinks ? `
                    <div class="quick-links-list">
                      ${groups.map(group => {
                        const links = group.links || [];
                        const isCourseGroup = group.type === "course";
                        
                        if (!links.length && !isCourseGroup) return "";
  
                        return `
                          <div class="quick-links-group ${group.type === "course" ? "quick-links-course" : "quick-links-topic"}">
                            <h4>${escapeHtml(group.title || "")}</h4>
  
                            ${links.length ? links.map(link => `
                              <div class="quick-link-row">
                                <span class="quick-link-symbol">∞</span>
                                <a href="${escapeHtml(link.url || "#")}" target="_blank">${escapeHtml(link.label || "")}</a>
                              </div>
                            `).join("") : ""}
                          </div>
                        `;
                      }).join("")}
                    </div>
                  ` : `
                    <p class="quick-links-empty">(No Quick Links Assigned)</p>
                  `}
                </div>
  
                <div class="quick-links-side">
                  <a href="${escapeHtml(linkPageUrl)}" target="_blank" class="quick-links-page-link">
                    Click THIS text<br>
                    or scan the QR<br>
                    code for links.
                  </a>
  
                  ${qrCodeUrl(linkPageUrl, 180) ? `
                    <img
                      src="${escapeHtml(qrCodeUrl(linkPageUrl, 180))}"
                      alt="QR code for Quick Links"
                      class="quick-links-qr-placeholder"
                    />
                  ` : `
                    <div class="quick-links-qr-placeholder">QR</div>
                  `}
                </div>
              </div>
            </div>
          </div>
        </section>
      `;
    }

  return "";
}

function renderHowToSection(section) {
  return (section.pages || []).map((page, pageIndex) => `
    <div class="page-flow howto-section section-break">
      <section class="flow-block howto-page-header">
        <h1 class="howto-page-title">${escapeHtml(page.title || "")}</h1>
        <div class="howto-page-subtitle">${escapeHtml(page.subtitle || "How To Teach")}</div>
      </section>

      <div class="howto-block-list">
        ${(page.blocks || []).map(block => `
          <section class="flow-block howto-block">
            ${page.editUrl ? `
              <a href="${escapeHtml(page.editUrl)}" target="_blank" class="preview-only edit-button howto-margin-edit">Edit</a>
            ` : ""}
            <div class="howto-panel">
              <div class="howto-icon-col">
                ${block.image ? `
                  <img src="${escapeHtml(block.image)}" alt="${escapeHtml(block.prompt || "")}" class="howto-icon" />
                ` : `
                  <div class="howto-icon-placeholder"></div>
                `}
              </div>

              <div class="howto-content">
                ${block.prompt ? `<h2 class="howto-prompt-title">${escapeHtml(block.prompt)}</h2>` : ""}
                <p>${nl2br(block.text || "")}</p>
              </div>
            </div>
          </section>
        `).join("")}
      </div>
    </div>
  `).join("");
}

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
                      <div class="lesson-page-qr-placeholder">QR</div>
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
  const subtitle = bodyLines[0] && !isLessonCalloutLine(bodyLines[0])
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

function renderExamsSection(section) {
  let html = `
    <div class="page-flow exams-section section-break">
      <section class="flow-block exam-page-header">
        <h1 class="exam-page-title">${escapeHtml(section.title || "")}</h1>
        <div class="exam-page-subtitle">Examination</div>
      </section>

      <div class="exam-term-list">
  `;

  (section.terms || []).forEach(term => {
    html += `
      <section class="exam-term-block">
        <div class="exam-term-label">${escapeHtml(term.term || "")}</div>

        <div class="exam-content">
          ${formatExamContent(term.content || "")}
        </div>
      </section>
    `;
  });

  html += `
      </div>
    </div>
  `;

  return html;
}
