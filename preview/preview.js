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

  // TEMP: still using pages[] until we switch to sections[]
  data.pages.forEach(page => {
    html += renderPage(page);
  });

  preview.innerHTML = html;
}

function renderPage(page) {
  if (page.type === "cover") {
    return `
      <div class="page">
        <h1>${page.title}</h1>
        <h2>${page.subtitle || ""}</h2>
      </div>
    `;
  }

  if (page.type === "header") {
    return `
      <div class="page">
        <h2>${page.title}</h2>
        <p>${page.content}</p>
      </div>
    `;
  }

  if (page.type === "section") {
    return `
      <div class="page">
        <h2>${page.title}</h2>
        <p>${page.content}</p>
      </div>
    `;
  }

  if (page.type === "lesson") {
    return `
      <div class="page">
        <h3>Lesson ${page.lessonNumber}: ${page.title}</h3>
        <p>${page.content}</p>
      </div>
    `;
  }

  if (page.type === "exam") {
    return `
      <div class="page section-break">
        <h2>${page.title}</h2>
        <p>${page.content || ""}</p>
      </div>
    `;
  }

  return "";
}
