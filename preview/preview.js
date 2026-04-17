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

function renderPacket(data) {
  let html = "";

  if (!data.sections || !Array.isArray(data.sections)) {
    throw new Error("Missing sections array in JSON");
  }

  data.sections.forEach(section => {
    html += renderSection(section);
  });

  preview.innerHTML = html;
}

function renderSection(section) {
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

function renderHeaderSection(section) {
  let html = `<div class="page-flow header-section">`;

  (section.items || []).forEach(item => {
    html += renderHeaderItem(item);
  });

  html += `</div>`;
  return html;
}

function renderHeaderItem(item) {
  if (item.kind === "cover") {
    return `
      <section class="flow-block cover-block">
        <h1>${item.title || ""}</h1>
        <h2>${item.subtitle || ""}</h2>
      </section>
    `;
  }

  if (item.kind === "about" || item.kind === "scheduling" || item.kind === "planning-prep") {
    return `
      <section class="flow-block header-block">
        <h2>${item.title || ""}</h2>
        <p>${item.content || ""}</p>
      </section>
    `;
  }

  if (item.kind === "book-reference" || item.kind === "supply-reference") {
    return `
      <section class="flow-block header-block reference-block">
        <h2>${item.title || ""}</h2>
        <p>${item.content || ""}</p>
        <p><a href="${item.url || "#"}" target="_blank">${item.linkLabel || ""}</a></p>
        <div class="qr-placeholder">QR Placeholder</div>
      </section>
    `;
  }

  if (item.kind === "quick-links") {
    return `
      <section class="flow-block header-block">
        <h2>${item.title || ""}</h2>
        <p>${item.content || ""}</p>
        <ul>
          ${(item.links || []).map(link => `
            <li><a href="${link.url}" target="_blank">${link.label}</a></li>
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
            ${item.image ? `<img src="${item.image}" alt="${item.title || ""}">` : `<div class="image-placeholder">Image</div>`}
          </div>
          <div class="howto-content">
            <div class="howto-prompt">${item.prompt || ""}</div>
            <h2>${item.title || ""}</h2>
            <p>${item.content || ""}</p>
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
        <div class="term-banner">${termGroup.term || ""}</div>
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
        <div class="lesson-course">${lesson.courseTitle || ""}</div>
        <div class="lesson-linkbox">
          <a href="${lesson.linkReference?.url || "#"}" target="_blank">${lesson.linkReference?.label || ""}</a>
          <div class="qr-placeholder small">QR</div>
        </div>
      </div>

      <div class="lesson-meta">${term || ""}</div>
      <h2>WEEK ${lesson.week || ""} ⬚ ${lesson.duration || ""} ${lesson.courseTitle || ""} - Lesson ${lesson.lessonNumber || ""}</h2>
      <h3>${lesson.title || ""}</h3>

      ${(lesson.materials || []).length ? `
        <p><strong>Materials:</strong> ${(lesson.materials || []).join("; ")}</p>
      ` : ""}

      ${(lesson.blocks || []).map(block => `
        <div class="lesson-block-item">
          <p><strong>${block.label || ""}</strong></p>
          <p>${block.content || ""}</p>
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
        <h2>${item.term || ""}</h2>
        <h3>${item.title || ""}</h3>
        <p>${item.content || ""}</p>
      </section>
    `;
  });

  html += `</div>`;
  return html;
}
