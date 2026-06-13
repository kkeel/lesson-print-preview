const params = new URLSearchParams(window.location.search);
const grade = params.get("grade") || "";
const country = (params.get("country") || "").toLowerCase();
const preview = document.getElementById("preview");

if (!grade || !country) {
  preview.innerHTML = "<p>Choose a grade and country.</p>";
} else {
  fetch(`../../data/history-charts/grade-${grade}-${country}.json`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    })
    .then(renderHistoryChart)
    .catch(error => {
      preview.innerHTML = `
        <p>Could not load history chart.</p>
        <pre>${escapeHtml(error.message)}</pre>
      `;
      console.error(error);
    });
}

function renderHistoryChart(data) {
  preview.innerHTML = `
    <main class="history-chart-page">
      <header class="history-chart-header">
        <div class="history-chart-grade">${getGradeCountryLabel(data)}</div>
        <h1>Important Dates</h1>
      </header>

      ${(data.terms || []).map(renderTerm).join("")}
    </main>
  `;
}

function getGradeCountryLabel(data) {
  const countryLabel = data.country === "us" ? "U.S." : "Canada";
  return `Grade ${data.grade} (${countryLabel})`;
}

function renderTerm(term) {
  const weeks = term.weeks || "";

  return `
    <section class="history-chart-term">
      <h2>${escapeHtml(term.termLabel || `Term ${term.termNumber || ""}`)}</h2>

      ${weeks.map((week, index) =>
        renderWeek(week, {
          isFirstWeek: index === 0,
          isLastWeek: index === weeks.length - 1
        })
      ).join("")}
    </section>
  `;
}

function renderWeek(week, options = {}) {
  const classes = [
    "history-chart-week",
    options.isFirstWeek ? "first-week" : "",
    options.isLastWeek ? "last-week" : ""
  ].filter(Boolean).join(" ");

  const groupedItems = groupItemsByLessonSet(week.items || []);

  return `
    <section class="${classes}">
      <h3>${escapeHtml((week.weekLabel || `Week ${week.weekNumber || ""}`).toUpperCase())}</h3>

      <div class="history-chart-items">
        ${groupedItems.map(renderGroupedItem).join("")}
      </div>
    </section>
  `;
}

function groupItemsByLessonSet(items = []) {
  const groups = [];

  items.forEach(item => {
    const lessonSetTitle = item.lessonSetTitle || "";

    let group = groups.find(existing =>
      existing.lessonSetTitle === lessonSetTitle
    );

    if (!group) {
      group = {
        lessonSetTitle,
        items: []
      };

      groups.push(group);
    }

    group.items.push(item);
  });

  return groups;
}

function renderGroupedItem(group) {
  const text = group.items
    .map(item => cleanHistoryChartText(item.text || ""))
    .filter(Boolean)
    .join("\n");

  return renderItem({
    lessonSetTitle: group.lessonSetTitle,
    text
  });
}

function cleanHistoryChartText(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .join("\n");
}

function renderItem(item) {
  return `
    <div class="history-chart-item">
      <div class="history-chart-source">• ${escapeHtml(item.lessonSetTitle || "")}</div>
      <div class="history-chart-text">${nl2br(item.text || "")}</div>
    </div>
  `;
}
