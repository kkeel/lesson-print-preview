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
        <div class="history-chart-brand">Alveary History Chart</div>
        <h1>${escapeHtml(data.title || "Important Dates")}</h1>
      </header>

      ${(data.terms || []).map(renderTerm).join("")}
    </main>
  `;
}

function renderTerm(term) {
  return `
    <section class="history-chart-term">
      <h2>${escapeHtml(term.termLabel || `Term ${term.termNumber || ""}`)}</h2>

      ${(term.weeks || []).map(renderWeek).join("")}
    </section>
  `;
}

function renderWeek(week) {
  return `
    <section class="history-chart-week">
      <h3>${escapeHtml((week.weekLabel || `Week ${week.weekNumber || ""}`).toUpperCase())}</h3>

      <div class="history-chart-items">
        ${(week.items || []).map(renderItem).join("")}
      </div>
    </section>
  `;
}

function renderItem(item) {
  return `
    <div class="history-chart-item">
      <div class="history-chart-source">• ${escapeHtml(item.lessonSetTitle || "")}</div>
      <div class="history-chart-text">${nl2br(item.text || "")}</div>
    </div>
  `;
}
