const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const jumpTarget = params.get("jump");
const mlVariant = params.get("variant") || "";
const mlTopic = params.get("topic") || "";
const mlLesson = params.get("lesson") || "";

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

  const sectionsToRender = mlLesson
    ? data.sections.filter(section => section.type === "modern-language-lessons")
    : data.sections;
  
  sectionsToRender.forEach(section => {
    html += renderSection(section, data);
  });

  preview.innerHTML = html;
  renderMLPreviewControls(data);
  
  if (jumpTarget) {
    setTimeout(() => {
      jumpToPreviewAnchor(jumpTarget);
    }, 60);
  }
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
    return renderModernLanguageLessonsSection(section, {
      viewMode: mlViewMode,
      variant: mlVariant,
      topic: mlTopic,
      lesson: mlLesson
    });
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

    ${mlViewMode === "topic" ? `
      <div class="ml-preview-control-group">
        <label for="ml-jump-topic">Topic</label>
        <select id="ml-jump-topic">
          <option value="">Choose topic...</option>
          ${buildMLTopicOptions(mlSection)}
        </select>
      </div>
    ` : ""}

        <div class="ml-preview-control-group">
          <label for="ml-jump-section">Section</label>
    
          <select id="ml-jump-section">
            <option value="">Choose section...</option>
    
            <option value="ml-section-headers">Header Pages</option>
            <option value="ml-section-howto">How To Pages</option>
            <option value="ml-section-lessons">Lessons</option>
    
            ${hasMLResourceType(mlSection, "stories")
              ? `<option value="ml-appendix-storylines">Storylines</option>`
              : ""
            }
    
            ${hasMLResourceType(mlSection, "songsRhymes")
              ? `<option value="ml-appendix-songs">Songs & Rhymes</option>`
              : ""
            }
    
            ${hasMLResourceType(mlSection, "glossary")
              ? `<option value="ml-appendix-glossary">Vocabulary Glossary</option>`
              : ""
            }

            ${hasMLStudentLiteraturePages(mlSection)
              ? `<option value="ml-student-literature-pages">Storyboard / Copywork</option>`
              : ""
            }
          </select>
        </div>
        
    <div class="ml-preview-control-group">
      <label for="ml-jump-term">Term</label>
      <select id="ml-jump-term">
        <option value="">Choose term...</option>
        ${buildMLTermOptions(mlSection)}
      </select>
    </div>

    ${mlViewMode === "course" ? `
      <div class="ml-preview-control-group">
        <label for="ml-jump-week">Week</label>
        <select id="ml-jump-week">
          <option value="">Choose week...</option>
          ${buildMLWeekOptions(mlSection)}
        </select>
      </div>
    ` : ""}

    <div class="ml-preview-control-group">
      <label for="ml-jump-lesson">Lesson</label>
      <select id="ml-jump-lesson">
        <option value="">Choose lesson...</option>
        ${mlViewMode === "topic"
          ? buildMLTopicLessonOptions(mlSection)
          : buildMLLessonOptions(mlSection)
        }
      </select>
    </div>
  `;

  document.body.appendChild(controls);

  document.getElementById("ml-view-mode")?.addEventListener("change", event => {
    mlViewMode = event.target.value || "course";
    renderPacket(currentPacketData);
  });

  document.getElementById("ml-jump-topic")?.addEventListener("change", event => {
    updateMLTopicModeLessonOptions(mlSection);
    jumpToPreviewAnchor(event.target.value);
  });

  document.getElementById("ml-jump-section")?.addEventListener("change", event => {
    jumpToPreviewAnchor(event.target.value);
  });

  document.getElementById("ml-jump-term")?.addEventListener("change", event => {
    const term = event.target.value || "";

    if (mlViewMode === "course") {
      updateMLCourseModeOptions(mlSection);
      jumpToPreviewAnchor(term ? `ml-term-${term}` : "");
      return;
    }

    updateMLTopicModeLessonOptions(mlSection);
    jumpToFirstTopicTerm(term);
  });

  document.getElementById("ml-jump-week")?.addEventListener("change", event => {
    updateMLCourseModeOptions(mlSection);
    jumpToPreviewAnchor(event.target.value);
  });

  document.getElementById("ml-jump-lesson")?.addEventListener("change", event => {
    jumpToPreviewAnchor(event.target.value);
  });
}

function hasMLResourceType(section, resourceKey) {
  return (section.lessonSets || []).some(lessonSet =>
    (lessonSet.resources?.[resourceKey] || []).length
  );
}

function hasMLStudentLiteraturePages(section) {
  return (section.lessonSets || []).some(lessonSet => {
    const lessonSetTitle = String(lessonSet.title || "").toLowerCase();

    if (!lessonSetTitle.includes("literature")) return false;

    return (lessonSet.lessons || []).some(lesson =>
      (lesson.sentences || []).length
    );
  });
}

function buildMLTermOptions(section) {
  const terms = new Map();

  (section.weeklyLessons || []).forEach(week => {
    if (!week.term) return;
    terms.set(String(week.term), `Term ${week.term}`);
  });

  return [...terms.entries()]
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
}

function buildMLWeekOptions(section, selectedTerm = "") {
  return (section.weeklyLessons || [])
    .filter(week => !selectedTerm || String(week.term || "") === String(selectedTerm))
    .map(week => {
      const label = week.weekLabel || `Week ${week.week || ""}`;
      return `<option value="ml-week-${escapeHtml(week.week || "")}">${escapeHtml(label)}</option>`;
    })
    .join("");
}

function buildMLLessonOptions(section, selectedTerm = "", selectedWeek = "") {
  const lessons = [];

  (section.weeklyLessons || []).forEach(week => {
    if (selectedTerm && String(week.term || "") !== String(selectedTerm)) return;
    if (selectedWeek && String(week.week || "") !== String(selectedWeek)) return;

    (week.lessons || []).forEach(lesson => {
      lessons.push({
        value: `ml-lesson-${lesson.id}`,
        label: lesson.title || "Untitled lesson"
      });
    });
  });

  return lessons
    .map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
    .join("");
}

function buildMLTopicOptions(section) {
  return (section.lessonSets || [])
    .filter(lessonSet => lessonSet.title)
    .map(lessonSet => `
      <option value="ml-topic-${slugifyPreviewAnchor(lessonSet.title)}">
        ${escapeHtml(lessonSet.title)}
      </option>
    `)
    .join("");
}

function buildMLTopicLessonOptions(section, selectedTopic = "", selectedTerm = "") {
  const lessons = [];

  (section.lessonSets || []).forEach(lessonSet => {
    const topicAnchor = `ml-topic-${slugifyPreviewAnchor(lessonSet.title || "")}`;

    if (selectedTopic && selectedTopic !== topicAnchor) return;

    (lessonSet.lessons || []).forEach(lesson => {
      if (selectedTerm && String(lesson.term || "") !== String(selectedTerm)) return;

      lessons.push({
        value: `ml-lesson-${lesson.id}`,
        label: `${lesson.weekLabel || `Week ${lesson.week || ""}`} — ${lesson.title || "Untitled lesson"}`
      });
    });
  });

  return lessons
    .map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
    .join("");
}

function updateMLCourseModeOptions(section) {
  const term = document.getElementById("ml-jump-term")?.value || "";
  const weekAnchor = document.getElementById("ml-jump-week")?.value || "";
  const selectedWeek = weekAnchor.replace("ml-week-", "");

  const weekSelect = document.getElementById("ml-jump-week");
  const lessonSelect = document.getElementById("ml-jump-lesson");

  if (weekSelect) {
    weekSelect.innerHTML = `
      <option value="">Choose week...</option>
      ${buildMLWeekOptions(section, term)}
    `;

    if (weekAnchor) weekSelect.value = weekAnchor;
  }

  if (lessonSelect) {
    lessonSelect.innerHTML = `
      <option value="">Choose lesson...</option>
      ${buildMLLessonOptions(section, term, selectedWeek)}
    `;
  }
}

function updateMLTopicModeLessonOptions(section) {
  const selectedTopic = document.getElementById("ml-jump-topic")?.value || "";
  const selectedTerm = document.getElementById("ml-jump-term")?.value || "";
  const lessonSelect = document.getElementById("ml-jump-lesson");

  if (!lessonSelect) return;

  lessonSelect.innerHTML = `
    <option value="">Choose lesson...</option>
    ${buildMLTopicLessonOptions(section, selectedTopic, selectedTerm)}
  `;
}

function jumpToFirstTopicTerm(term) {
  if (!term) return;

  const target = document.querySelector(`[data-ml-topic-term="${CSS.escape(term)}"]`);
  if (!target) return;

  target.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
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
