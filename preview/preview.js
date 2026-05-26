const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const preview = document.getElementById("preview");

let currentPacketData = null;
let mlViewMode = params.get("mlView") || "course";

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
      currentPacketData = data;
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
    html += renderSection(section, data);
  });

  preview.innerHTML = html;
  renderMLPreviewControls(data);
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

  if (section.type === "modern-language-lessons") {
    return renderModernLanguageLessonsSection(section, { viewMode: mlViewMode });
  }

  if (section.type === "exams") {
    return renderExamsSection(section);
  }

  return "";
}

function getModernLanguageSection(data) {
  return (data.sections || []).find(section => section.type === "modern-language-lessons");
}

function renderMLPreviewControls(data) {
  const mlSection = getModernLanguageSection(data);

  const existing = document.getElementById("ml-preview-controls");
  if (existing) existing.remove();

  if (!mlSection) return;

  const controls = document.createElement("aside");
  controls.id = "ml-preview-controls";
  controls.className = "ml-preview-controls preview-only";

  controls.innerHTML = `
    <div class="ml-preview-controls-title">Modern Language View</div>

    <div class="ml-preview-control-group">
      <label for="ml-view-mode">View mode</label>
      <select id="ml-view-mode">
        <option value="course" ${mlViewMode === "course" ? "selected" : ""}>Course / Weekly</option>
        <option value="topic" ${mlViewMode === "topic" ? "selected" : ""}>Topic</option>
      </select>
    </div>

    <div class="ml-preview-control-group">
      <label for="ml-jump-term">Jump to term</label>
      <select id="ml-jump-term">
        <option value="">Choose term...</option>
        ${buildMLTermOptions(mlSection)}
      </select>
    </div>

    <div class="ml-preview-control-group">
      <label for="ml-jump-week">Jump to week</label>
      <select id="ml-jump-week">
        <option value="">Choose week...</option>
        ${buildMLWeekOptions(mlSection)}
      </select>
    </div>

    <div class="ml-preview-control-group">
      <label for="ml-jump-topic">Jump to topic</label>
      <select id="ml-jump-topic">
        <option value="">Choose topic...</option>
        ${buildMLTopicOptions(mlSection)}
      </select>
    </div>
  `;

  document.body.appendChild(controls);

  document.getElementById("ml-view-mode")?.addEventListener("change", event => {
    mlViewMode = event.target.value || "course";
    renderPacket(currentPacketData);
  });

  document.getElementById("ml-jump-term")?.addEventListener("change", event => {
    jumpToPreviewAnchor(event.target.value);
  });

  document.getElementById("ml-jump-week")?.addEventListener("change", event => {
    jumpToPreviewAnchor(event.target.value);
  });

  document.getElementById("ml-jump-topic")?.addEventListener("change", event => {
    jumpToPreviewAnchor(event.target.value);
  });
}

function buildMLTermOptions(section) {
  const terms = new Map();

  (section.weeklyLessons || []).forEach(week => {
    if (!week.term) return;
    terms.set(`ml-term-${week.term}`, `Term ${week.term}`);
  });

  return [...terms.entries()]
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
}

function buildMLWeekOptions(section) {
  return (section.weeklyLessons || [])
    .map(week => {
      const label = `Term ${week.term || ""} - ${week.weekLabel || `Week ${week.week || ""}`}`;
      return `<option value="ml-week-${escapeHtml(week.week || "")}">${escapeHtml(label)}</option>`;
    })
    .join("");
}

function buildMLTopicOptions(section) {
  const topics = new Map();

  (section.lessonSets || []).forEach(lessonSet => {
    if (!lessonSet.title) return;
    topics.set(
      `ml-topic-${slugifyPreviewAnchor(lessonSet.title)}`,
      lessonSet.title
    );
  });

  return [...topics.entries()]
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
}

function jumpToPreviewAnchor(anchorId) {
  if (!anchorId) return;

  const target = document.getElementById(anchorId);
  if (!target) return;

  target.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function slugifyPreviewAnchor(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
