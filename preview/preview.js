const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const jumpTarget = params.get("jump");
const mlVariant = params.get("variant") || "";
const mlTopic = params.get("topic") || "";
const mlLesson = params.get("lesson") || "";
const mlStudentNotebook = params.get("studentNotebook") || "";
const mlReference = params.get("mlReference") || "";
const sampleMode = params.get("sample") === "1";
const SAMPLE_WEEK_COUNT = 3;

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

function getSampleLinkPageUrl(packetId) {
  return `https://planning.alveary.org/sample-links.html?id=${encodeURIComponent(packetId || "")}`;
}

function getSampleWeekNumbersFromLessons(lessons = []) {
  return [...new Set(
    lessons
      .map(lesson => Number(lesson.weekNumber || lesson.week || 0))
      .filter(Boolean)
  )]
    .sort((a, b) => a - b)
    .slice(0, SAMPLE_WEEK_COUNT);
}

function filterStandardLessonsForSample(section) {
  const allLessons = (section.terms || []).flatMap(term => term.lessons || []);
  const sampleWeeks = new Set(getSampleWeekNumbersFromLessons(allLessons).map(String));

  return {
    ...section,
    linkPageUrl: getSampleLinkPageUrl(id),
    terms: (section.terms || [])
      .map(term => ({
        ...term,
        lessons: (term.lessons || []).filter(lesson =>
          sampleWeeks.has(String(lesson.weekNumber || 0))
        )
      }))
      .filter(term => term.lessons.length)
  };
}

function filterModernLanguageForSample(section) {
  const allLessons = (section.lessonSets || []).flatMap(lessonSet => lessonSet.lessons || []);
  const sampleWeeks = new Set(getSampleWeekNumbersFromLessons(allLessons).map(String));

  return {
    ...section,
    lessonSets: (section.lessonSets || [])
      .map(lessonSet => ({
        ...lessonSet,
        lessons: (lessonSet.lessons || []).filter(lesson =>
          sampleWeeks.has(String(lesson.week || 0))
        )
      }))
      .filter(lessonSet => lessonSet.lessons.length),
    weeklyLessons: (section.weeklyLessons || []).filter(week =>
      sampleWeeks.has(String(week.week || 0))
    )
  };
}

function filterHeaderForSample(section) {
  return {
    ...section,
    items: (section.items || []).map(item => {
      if (item.kind !== "quick-links") return item;

      return {
        ...item,
        linkPageUrl: getSampleLinkPageUrl(id),
        sampleMode: true
      };
    })
  };
}

function filterSectionForSample(section) {
  if (!sampleMode) return section;

  if (section.type === "header") {
    return filterHeaderForSample(section);
  }

  if (section.type === "lessons") {
    return filterStandardLessonsForSample(section);
  }

  if (section.type === "modern-language-lessons") {
    return filterModernLanguageForSample(section);
  }

  return section;
}

function renderPacket(data) {
  let html = "";

  if (!data.sections || !Array.isArray(data.sections)) {
    throw new Error("Missing sections array in JSON");
  }

  const isMLSpecialPrint = Boolean(mlStudentNotebook || mlReference);

  const sectionsToRender = sampleMode
    ? data.sections
        .filter(section =>
          section.type === "cover" ||
          section.type === "header" ||
          section.type === "howto" ||
          section.type === "lessons" ||
          section.type === "modern-language-lessons"
        )
        .map(filterSectionForSample)
    : isMLSpecialPrint
      ? data.sections.filter(section =>
          section.type === "cover" ||
          section.type === "modern-language-lessons"
        )
      : mlLesson
        ? data.sections.filter(section => section.type === "modern-language-lessons")
        : data.sections;
  
    const shouldMoveMLReferences =
    !isMLSpecialPrint &&
    !mlLesson;

  let mlReferenceSection = null;

  sectionsToRender.forEach(section => {
    if (shouldMoveMLReferences && section.type === "modern-language-lessons") {
      mlReferenceSection = section;

      html += renderSection({
        ...section,
        suppressMLReferences: true
      }, data);

      return;
    }

    html += renderSection(section, data);
  });

  if (shouldMoveMLReferences && mlReferenceSection) {
    html += renderModernLanguageLessonsSection(mlReferenceSection, {
      viewMode: mlViewMode,
      variant: mlVariant,
      topic: mlTopic,
      lesson: "",
      studentNotebook: "",
      mlReference: "",
      referencesOnly: true
    });
  }

  updateMLPrintBodyClass();
  document.body.classList.toggle("sample-pdf-mode", sampleMode);
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
    return renderCoverSection(buildMLCoverSection(section, packetData), packetData);
  }

  if (section.type === "header") {
    return renderHeaderSection(section, packetData);
  }

  if (section.type === "howto") {
    return renderHowToSection(filterMLHowToSection(section, packetData));
  }

  if (section.type === "lessons") {
    return renderLessonsSection(section);
  }

  if (section.type === "modern-language-lessons") {
    return renderModernLanguageLessonsSection(section, {
      viewMode: mlViewMode,
      variant: mlVariant,
      topic: mlTopic,
      lesson: mlLesson,
      studentNotebook: mlStudentNotebook,
      mlReference,
      includeTeacherReferences: !section.suppressMLReferences
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

function getMLFilteredLessonSetsForCover(mlSection) {
  let lessonSets = [...(mlSection.lessonSets || [])];

  if (mlVariant === "g1-3") {
    lessonSets = lessonSets.filter(lessonSet => {
      const title = String(lessonSet.title || "").toLowerCase();

      return (
        !title.includes("grammar") &&
        !title.includes("literature extension")
      );
    });
  }

  if (mlTopic) {
    lessonSets = lessonSets.filter(lessonSet =>
      slugifyPreviewAnchor(lessonSet.title || "") === slugifyPreviewAnchor(mlTopic)
    );
  }

  return lessonSets;
}

function getMLTopicSubtitleLabel(title = "") {
  const value = String(title || "").toLowerCase();

  if (value.includes("picture") && value.includes("grammar")) {
    return "Picture Study Extension + Grammar (4th+)";
  }

  if (value.includes("picture")) {
    return "Picture Study";
  }

  if (value.includes("literature extension")) {
    return "Literature Extension (4th+)";
  }

  if (value.includes("literature")) {
    return "Literature";
  }

  if (value.includes("song") || value.includes("conversation")) {
    return "Songs, Rhymes, & Conversations";
  }

  return title;
}

function getMLReferenceSubtitle(referenceType = "") {
  switch (referenceType) {
    case "songs-rhymes":
      return "Songs & Rhymes";
    case "storylines":
      return "Storylines";
    case "picture-study-vocab":
      return "Picture Study Vocab";
    case "literature-vocab":
      return "Literature Vocab";
    case "conversation-lines-phrases":
      return "Conversation Lines & Phrases";
    case "full":
    default:
      return [
        "Songs & Rhymes",
        "Storylines",
        "Picture Study Vocab",
        "Literature Vocab",
        "Conversation Lines & Phrases"
      ].join("\n");
  }
}

function getMLCourseTitle(packetData, section = {}) {
  return packetData.title || section.title || "";
}

function getMLLanguageLabel(packetData, section = {}) {
  const title = getMLCourseTitle(packetData, section).toLowerCase();

  if (title.includes("french")) return "French";
  if (title.includes("spanish")) return "Spanish";

  return getMLCourseTitle(packetData, section);
}

function buildMLCoverSection(section, packetData) {
  const mlSection = getModernLanguageSection(packetData);

  if (!mlSection) return section;

  const courseTitle = getMLCourseTitle(packetData, section);
  const languageLabel = getMLLanguageLabel(packetData, section);

  if (mlStudentNotebook) {
    return {
      ...section,
      brandLine: "Student Notebook",
      title: "Student Notebook",
      subtitle: mlStudentNotebook === "work-only"
        ? `${courseTitle}: Student Work`
        : `${courseTitle}: Student Work\n${courseTitle}: References`
    };
  }

  if (mlReference) {
    return {
      ...section,
      brandLine: "Alveary Reference",
      title: mlReference === "full"
        ? `${languageLabel} References`
        : `${languageLabel} Reference`,
      subtitle: getMLReferenceSubtitle(mlReference)
    };
  }

  const lessonSets = getMLFilteredLessonSetsForCover(mlSection);
  const subtitle = lessonSets
    .map(lessonSet => getMLTopicSubtitleLabel(lessonSet.title || ""))
    .filter(Boolean)
    .filter((label, index, list) => list.indexOf(label) === index)
    .join("\n");

  return {
    ...section,
    brandLine: "Alveary Lesson Plan",
    title: courseTitle,
    subtitle
  };
}

function filterMLHowToSection(section, packetData) {
  if (mlViewMode !== "topic" || !mlTopic) return section;

  const topicLower = String(mlTopic || "").toLowerCase();
  const packetTitleLower = String(packetData.title || "").toLowerCase();

  const needsSpanishPicture =
    packetTitleLower.includes("spanish") &&
    topicLower.includes("picture");

  const needsFrenchPicture =
    packetTitleLower.includes("french") &&
    topicLower.includes("picture");

  const needsLiterature =
    topicLower.includes("literature");

  const needsSongs =
    topicLower.includes("song") ||
    topicLower.includes("rhyme") ||
    topicLower.includes("conversation");

  const pages = (section.pages || []).filter(page => {
    const text = [
      page.title,
      page.subtitle,
      ...(page.blocks || []).map(block => block.prompt)
    ].join(" ").toLowerCase();

    if (needsSpanishPicture) {
      return text.includes("spanish") && text.includes("picture");
    }

    if (needsFrenchPicture) {
      return text.includes("french") && text.includes("picture");
    }

    if (needsLiterature) {
      return text.includes("literature");
    }

    if (needsSongs) {
      return (
        text.includes("song") ||
        text.includes("rhyme") ||
        text.includes("conversation")
      );
    }

    return true;
  });

  return {
    ...section,
    pages
  };
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
              ? `
                <option value="ml-appendix-picture-study-vocab">Picture Study Vocab</option>
                <option value="ml-appendix-literature-vocab">Literature Vocab</option>
              `
              : ""
            }

            ${hasMLStudentLiteraturePages(mlSection)
              ? `<option value="ml-student-literature-pages">Storyboard / Copywork</option>`
              : ""
            }

            ${hasMLConversationLines(mlSection)
              ? `<option value="ml-appendix-conversations">Conversation Lines & Phrases</option>`
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

function hasMLConversationLines(section) {
  return (section.lessonSets || []).some(lessonSet =>
    (lessonSet.lessons || []).some(lesson =>
      (lesson.sentences || []).some(sentence =>
        String(sentence.sentenceType || "")
          .toLowerCase()
          .includes("conversation")
      )
    )
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

function updateMLPrintBodyClass() {
  document.body.classList.remove(
    "ml-print-lesson-plan",
    "ml-print-student-notebook",
    "ml-print-reference"
  );

  if (mlStudentNotebook) {
    document.body.classList.add("ml-print-student-notebook");
    return;
  }

  if (mlReference) {
    document.body.classList.add("ml-print-reference");
    return;
  }

  document.body.classList.add("ml-print-lesson-plan");
}
