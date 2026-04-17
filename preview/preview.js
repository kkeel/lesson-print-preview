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

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
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
    return renderHeaderSection(section);
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
  const subject = section.subject || packetData.subject || "";
  const lessonSetName = packetData.lessonSetName || "";
  const subtitleLines = subtitle
    ? subtitle.split("\n").map(line => line.trim()).filter(Boolean)
    : [];

  return `
    <div class="page-flow cover-section">
      <section class="flow-block cover-block">
        <div class="cover-top-rule"></div>

        <div class="cover-inner">
          <div class="cover-brand-line">Alveary Lesson Plan</div>

          ${gradeText ? `<div class="cover-grade-line">${escapeHtml(gradeText)}</div>` : ""}

          ${subject ? `<div class="cover-subject">${escapeHtml(subject)}</div>` : ""}

          <h1>${escapeHtml(title)}</h1>

          ${subtitleLines.length ? `
            <div class="cover-topic-stack">
              ${subtitleLines.map(line => `<div class="cover-topic-line">${escapeHtml(line)}</div>`).join("")}
            </div>
          ` : ""}

          ${lessonSetName && lessonSetName !== title
            ? `<div class="cover-lesson-set-name">${escapeHtml(lessonSetName)}</div>`
            : ""}

          <div class="cover-footer-line">©2025 Charlotte Mason Institute®</div>
        </div>
      </section>
    </div>
  `;
}

function renderHeaderSection(section) {
  let html = `<div class="page-flow header-section">`;

  (section.items || []).forEach(item => {
    html += renderHeaderItem(item);
  });

  html += `</div>`;
  return html;
}

function renderHeaderItem(item) {
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
    return `
      <section class="flow-block header-block">
        <h2>${escapeHtml(item.title || "")}</h2>
        <p>${nl2br(item.content || "")}</p>
        <ul>
          ${(item.links || []).map(link => `
            <li><a href="${escapeHtml(link.url || "#")}" target="_blank">${escapeHtml(link.label || "")}</a></li>
          `).join("")}
        </ul>
      </section>
    `;
  }

  return "";
}

function renderHowToSection(section) {
  let html = `<div class="page-flow howto-section section-break">`;

  (section.items || []).forEach(item => {
    html += `
      <section class="flow-block howto-block">
        <div class="howto-grid">
          <div class="howto-image">
            ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || "")}">` : `<div class="image-placeholder">Image</div>`}
          </div>
          <div class="howto-content">
            <div class="howto-prompt">${escapeHtml(item.prompt || "")}</div>
            <h2>${escapeHtml(item.title || "")}</h2>
            <p>${nl2br(item.content || "")}</p>
          </div>
        </div>
      </section>
    `;
  });

  html += `</div>`;
  return html;
}

function renderLessonsSection(section) {
  let html = "";

  (section.terms || []).forEach((termGroup, index) => {
    html += `
      <div class="page-flow lessons-section ${index === 0 ? "section-break" : "term-start"}">
        <div class="term-banner">${escapeHtml(termGroup.term || "")}</div>
        ${(termGroup.lessons || []).map(lesson => renderLesson(lesson, termGroup.term)).join("")}
      </div>
    `;
  });

  return html;
}

function renderLesson(lesson, term) {
  return `
    <section class="flow-block lesson-block">
      <div class="lesson-topbar">
        <div class="lesson-course">${escapeHtml(lesson.courseTitle || "")}</div>
        <div class="lesson-linkbox">
          <a href="${escapeHtml(lesson.linkReference?.url || "#")}" target="_blank">${escapeHtml(lesson.linkReference?.label || "")}</a>
          <div class="qr-placeholder small">QR</div>
        </div>
      </div>

      <div class="lesson-meta">${escapeHtml(term || "")}</div>
      <h2>WEEK ${escapeHtml(lesson.week || "")} ⬚ ${escapeHtml(lesson.duration || "")} ${escapeHtml(lesson.courseTitle || "")} - Lesson ${escapeHtml(lesson.lessonNumber || "")}</h2>
      <h3>${escapeHtml(lesson.title || "")}</h3>

      ${(lesson.materials || []).length ? `
        <p><strong>Materials:</strong> ${(lesson.materials || []).map(escapeHtml).join("; ")}</p>
      ` : ""}

      ${(lesson.blocks || []).map(block => `
        <div class="lesson-block-item">
          <p><strong>${escapeHtml(block.label || "")}</strong></p>
          <p>${nl2br(block.content || "")}</p>
        </div>
      `).join("")}
    </section>
  `;
}

function renderExamsSection(section) {
  let html = `<div class="page-flow exams-section section-break">`;

  (section.items || []).forEach(item => {
    html += `
      <section class="flow-block exam-block">
        <h2>${escapeHtml(item.term || "")}</h2>
        <h3>${escapeHtml(item.title || "")}</h3>
        <p>${nl2br(item.content || "")}</p>
      </section>
    `;
  });

  html += `</div>`;
  return html;
}
