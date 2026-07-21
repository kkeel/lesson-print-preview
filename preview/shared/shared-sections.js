function renderCoverSection(section, packetData) {
  const title = section.title || packetData.title || "";
  const subtitle = section.subtitle || "";
  const gradeText = section.gradeText || packetData.gradeText || "";

  return `
    <div class="page-flow cover-section">
      <section class="flow-block cover-block">
        <div class="cover-inner">
          <div class="cover-header-row">
            <div class="cover-brand-line">${escapeHtml(section.brandLine || "Alveary Lesson Plan")}</div>
            ${gradeText ? `<div class="cover-grade-line">${escapeHtml(gradeText)}</div>` : ""}
          </div>

          <div class="cover-top-rule"></div>

          <div class="cover-main">
            ${title ? `<div class="cover-title-main">${escapeHtml(title)}</div>` : ""}
          
            ${section.releaseLabel ? `
              <div class="cover-release-label">
                ${escapeHtml(section.releaseLabel)}
              </div>
            ` : ""}
          
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
  let html = `<div class="page-flow header-section" id="ml-section-headers">`;
  const headerEditUrl = section.editUrl || "";

  html += renderHeaderIntro(packetData);

  (section.items || []).forEach(item => {
    html += renderHeaderItem(item, headerEditUrl, packetData);
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

function renderHeaderItem(item, headerEditUrl = "", packetData = {}) {
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
    const linkUrl = item.linkUrl || "";
    const hasBookGroups = (item.groups || []).some(group => (group.books || []).length);
  
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
      
                ${hasBookGroups && linkUrl ? `
                  <p class="books-resources-link-line">
                    ∞ <a href="${escapeHtml(linkUrl)}" target="_blank">View Book List Details</a>
                  </p>
                ` : `
                  <p class="books-resources-empty">(No Books Assigned)</p>
                `}
      
                ${hasBookGroups ? `
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
                ` : ""}
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
      const extraHelpingsUrl = item.extraHelpingsUrl || "";
      const isSampleMode = item.sampleMode === true;
      const isTerm1Release = packetData.pdfReleaseMode === "term-1";

      const extraHelpingsLink = extraHelpingsUrl
        ? [{
            id: "extra-helpings",
            label: "Extra Helpings",
            url: extraHelpingsUrl,
            sort: "-1",
            sourceTitle: "Extra Helpings"
          }]
        : [];
      
      const groups = (item.groups || []).map((group, index) => ({
        ...group,
        links: index === 0
          ? [...extraHelpingsLink, ...(group.links || [])]
          : (group.links || [])
      }));
      
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
  
                            ${links.length ? links.map(link => {
                              const isExtraHelpings = link.id === "extra-helpings";
                            
                              const isDisabled =
                                isTerm1Release ||
                                (isSampleMode && !isExtraHelpings);
                            
                              return `
                                <div class="quick-link-row">
                                  <span class="quick-link-symbol">∞</span>
                            
                                  ${
                                    isDisabled
                                      ? `
                                        <a
                                          href="#"
                                          aria-disabled="true"
                                          tabindex="-1"
                                          class="quick-link-disabled"
                                        >
                                          ${escapeHtml(link.label || "")}
                                        </a>
                                      `
                                      : `
                                        <a
                                          href="${escapeHtml(link.url || "#")}"
                                          target="_blank"
                                        >
                                          ${escapeHtml(link.label || "")}
                                        </a>
                                      `
                                  }
                                </div>
                              `;
                            }).join("") : ""}
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
                
                  ${isTerm1Release ? `
                    <div class="quick-links-release-callout">
                      <strong>Term 1 links are available.</strong>
                      <div>
                        Additional lesson links and Quick Links will be released as future terms become available.
                      </div>
                    </div>
                  ` : ""}
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
    <div
      class="page-flow howto-section section-break"
      id="${pageIndex === 0 ? "ml-section-howto" : ""}"
    >
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
