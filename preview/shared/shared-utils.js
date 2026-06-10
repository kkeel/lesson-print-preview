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
    .replace(/(^|[\s(])_([^_\s][^_]*?[^_\s])_(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
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
  const lines = cleanLessonText(value).split("\n");

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
  return String(value ?? "")
    // Convert escaped fill-in-the-blank underscores back to underscores.
    .replace(/\\_/g, "_")
    // Convert escaped Markdown list hyphens back to normal hyphens.
    .replace(/^\\-/gm, "-")
    // Keep the existing escaped-period cleanup.
    .replace(/\\\./g, ".");
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
