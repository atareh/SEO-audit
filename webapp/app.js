import { inject } from "@vercel/analytics";

inject();

const app = document.querySelector("#app");

const API = {
  async request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed (${response.status})`);
    }

    return data;
  },

  createDemo() {
    return this.request("/api/demo/bootstrap", { method: "POST" });
  },

  exchangeClaim(token) {
    return this.request("/api/claims/exchange", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  fetchReport(reportId) {
    return this.request(`/api/reports/${encodeURIComponent(reportId)}`);
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value !== "number") {
    return String(value);
  }
  return value.toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const numeric = Number(value);
  return numeric > 1 ? `${numeric.toFixed(0)}%` : `${(numeric * 100).toFixed(1)}%`;
}

function scoreClass(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return "score-warn";
  }
  const numeric = Number(score);
  if (numeric >= 90) return "score-good";
  if (numeric >= 50) return "score-warn";
  return "score-bad";
}

function severityClass(severity) {
  const value = String(severity || "medium").toLowerCase();
  if (value === "critical") return "pill-critical";
  if (value === "high") return "pill-high";
  if (value === "low") return "pill-low";
  return "pill-medium";
}

function scoreTone(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return "#a96b1f";
  }
  const numeric = Number(score);
  if (numeric >= 85) return "#24584c";
  if (numeric >= 60) return "#a96b1f";
  return "#a33f20";
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMetricValue(metric) {
  if (!metric) return "—";
  const value = metric.value ?? metric.p75 ?? metric.percentile;
  if (value === null || value === undefined) return "—";
  const unit = metric.unit || "";
  if (typeof value === "number" && unit === "" && value < 1 && value > 0) {
    return value.toFixed(2);
  }
  return `${formatNumber(value)}${unit}`;
}

function getQueryLabel(entry) {
  return entry.query || entry.page || "Untitled";
}

function getHeadings(section) {
  return Array.isArray(section?.headings) ? section.headings : [];
}

function renderHeadingContent(content) {
  if (!content || !content.trim()) {
    return "<p>No supporting notes yet.</p>";
  }

  const lines = content.split("\n");
  const chunks = [];
  let listBuffer = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    const items = listBuffer.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    chunks.push(`<ul>${items}</ul>`);
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const listMatch = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      listBuffer.push(listMatch[1]);
      continue;
    }

    flushList();
    chunks.push(`<p>${escapeHtml(line)}</p>`);
  }

  flushList();

  if (!chunks.length) {
    return `<pre>${escapeHtml(content)}</pre>`;
  }

  return chunks.join("");
}

function shell(content, nav = "") {
  return `
    <div class="app-shell fade-rise">
      <header class="topbar">
        <a class="brand" href="/">
          <div class="brand-mark">CS</div>
          <div class="brand-copy">
            <strong>My SEO Audit</strong>
            <span>Client-ready SEO reports for real follow-through</span>
          </div>
        </a>
        <nav>
          ${nav}
        </nav>
      </header>
      ${content}
    </div>
  `;
}

function homePage() {
  app.innerHTML = shell(`
    <section class="hero fade-rise">
        <div class="fade-rise stagger-1">
          <div class="eyebrow">Hosted delivery for SEO audits</div>
          <h1>An SEO audit<br><span class="serif">clients can actually use.</span></h1>
          <p class="lede">
            Run the audit once, then hand over a clean link with a leadership summary, quick wins,
            blockers, and an implementation brief your team or agent can act on.
          </p>
        <div class="hero-actions">
          <button class="button button-primary" id="launch-demo">Launch Demo Report</button>
          <a class="button button-secondary" href="#how-it-works">See the flow</a>
        </div>
      </div>
      <aside class="hero-note fade-rise stagger-2">
        <h2 id="how-it-works">How the handoff feels</h2>
        <div class="token-flow">
          <div class="token-step">
            <div class="token-index">1</div>
            <div>
              <strong>Run the audit</strong>
              <p>The system packages the results into one report that is ready to share.</p>
            </div>
          </div>
          <div class="token-step">
            <div class="token-index">2</div>
            <div>
              <strong>Open the report</strong>
              <p>The user lands on a calm, visual summary instead of a wall of terminal output.</p>
            </div>
          </div>
          <div class="token-step">
            <div class="token-index">3</div>
            <div>
              <strong>Come back later</strong>
              <p>The report stays easy to revisit, bookmark, and walk through with a client or team.</p>
            </div>
          </div>
        </div>
        <div id="demo-status" class="token-block">Ready to open a live demo report.</div>
      </aside>
    </section>
  `);

  const button = document.querySelector("#launch-demo");
  const status = document.querySelector("#demo-status");

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "Preparing a live demo report...";

    try {
      const data = await API.createDemo();
      status.innerHTML = `
        Demo report created.<br>
        Claim link: <a class="inline-link" href="${escapeHtml(data.claim_url)}">${escapeHtml(data.claim_url)}</a>
      `;
      window.location.href = data.claim_url;
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
}

function claimPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  app.innerHTML = `
    <div class="claim-wrap">
      <section class="claim-card fade-rise">
        <div class="eyebrow">Opening report</div>
        <h1>Getting your audit ready.</h1>
        <p>
          One moment while we open your report.
        </p>
        <div class="status-line"><span class="status-dot"></span><span id="claim-status">Loading your audit...</span></div>
        <div id="claim-error"></div>
      </section>
    </div>
  `;

  const status = document.querySelector("#claim-status");
  const errorWrap = document.querySelector("#claim-error");

  if (!token) {
    errorWrap.innerHTML = `<div class="error-banner">This report link is incomplete.</div>`;
    status.textContent = "Unable to continue.";
    return;
  }

  API.exchangeClaim(token)
    .then((data) => {
      status.textContent = "Opening your report...";
      window.location.replace(`/reports/${encodeURIComponent(data.report_id)}`);
    })
    .catch((error) => {
      status.textContent = "We couldn’t open this report.";
      errorWrap.innerHTML = `<div class="error-banner">${escapeHtml(error.message)}</div>`;
    });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function stripMarkdownInline(value) {
  return String(value ?? "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function getField(markdown, label) {
  const regex = new RegExp(`\\*\\*${escapeRegex(label)}:\\*\\*\\s*(.+)`, "i");
  return markdown.match(regex)?.[1]?.trim() || "";
}

function parseListItems(content) {
  return String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.match(/^(?:[-*]|\d+\.|- \[[ xX]\])\s+(.*)$/)?.[1] || "")
    .filter(Boolean)
    .map(stripMarkdownInline);
}

function parseMarkdownTable(content) {
  const rows = String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

  return rows.filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

function findHeading(headings, matcher) {
  return headings.find((heading) => matcher.test(heading.title));
}

function parseCategoryScores(markdown) {
  const regex = /^##\s+\d+\.\s+(.+?)\s+—\s+Score:\s+(\d+)\/100\s+\(Weight:\s+(\d+)%\)/gm;
  const categories = [];
  let match;

  while ((match = regex.exec(String(markdown || "")))) {
    const score = Number(match[2]);
    const weight = Number(match[3]);
    categories.push({
      name: stripMarkdownInline(match[1]),
      score,
      weight,
      weighted: Number(((score * weight) / 100).toFixed(1)),
    });
  }

  return categories;
}

function normalizePriority(title) {
  const value = String(title || "").toLowerCase();
  if (value.includes("critical")) return "critical";
  if (value.includes("high")) return "high";
  if (value.includes("medium")) return "medium";
  if (value.includes("low")) return "low";
  return "medium";
}

function parseActionItems(headings) {
  const grouped = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  let currentPriority = null;

  headings.forEach((heading) => {
    if (heading.level === 2) {
      currentPriority = normalizePriority(heading.title);
      return;
    }

    if (heading.level !== 3 || !currentPriority) {
      return;
    }

    const effort = heading.content.match(/\*\*Effort:\*\*\s*(.+)/i)?.[1]?.trim() || "";
    const expectedLift = heading.content.match(/\*\*Expected lift:\*\*\s*(.+)/i)?.[1]?.trim() || "";
    const actionMatch = heading.content.match(/\*\*Action:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i);
    const action = actionMatch ? stripMarkdownInline(actionMatch[1]) : "";

    grouped[currentPriority].push({
      title: stripMarkdownInline(heading.title.replace(/^\d+\.\s*/, "")),
      effort,
      expectedLift,
      action,
      priority: currentPriority,
    });
  });

  return grouped;
}

function scoreStatus(score) {
  const numeric = Number(score || 0);
  if (numeric >= 85) return "performing strongly";
  if (numeric >= 70) return "competitive with room to grow";
  if (numeric >= 55) return "fixable with a focused sprint";
  return "holding back visibility";
}

function insightForCategory(name) {
  const label = String(name || "");
  if (label.includes("AI Search")) return "Clarify AI crawler access, add llms.txt, and make brand authority easier for models to interpret.";
  if (label.includes("Images")) return "Add social preview images and fix recurring alt text gaps so the site earns more click-through value.";
  if (label.includes("Technical")) return "Tighten crawl plumbing first: sitemap coverage, redirect behavior, canonicals, and security headers.";
  if (label.includes("Schema")) return "Broaden structured data coverage and make article markup consistent so search engines can trust the content model.";
  if (label.includes("Content")) return "Protect the strong research work by expanding thin pages and reinforcing trust signals around authorship and policy.";
  if (label.includes("On-Page")) return "Sharpen titles, internal linking, and page depth so the strongest content gets discovered and clicked.";
  if (label.includes("Performance")) return "Performance is already a standout, so keep it stable while fixing the lower-scoring categories.";
  return "This area is worth attention in the next optimization cycle.";
}

function buildReportInsights(report) {
  const auditSection = report.sections?.audit_report || {};
  const actionSection = report.sections?.action_plan || {};
  const auditMarkdown = auditSection.markdown || "";
  const actionMarkdown = actionSection.markdown || "";
  const auditHeadings = getHeadings(auditSection);
  const actionHeadings = getHeadings(actionSection);
  const categoryScores = parseCategoryScores(auditMarkdown);
  const sortedByScore = [...categoryScores].sort((a, b) => b.score - a.score);
  const weakest = [...categoryScores].sort((a, b) => a.score - b.score);
  const actionItems = parseActionItems(actionHeadings);
  const weekOneHeading = findHeading(actionHeadings, /^Week 1/i);
  const projectedOverall = actionMarkdown.match(/\|\s*\*\*Overall\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*/i);
  const labMetricsHeading = findHeading(auditHeadings, /^Lab Metrics$/i);
  const lighthouseHeading = findHeading(auditHeadings, /^Lighthouse Scores$/i);

  const labMetrics = parseMarkdownTable(labMetricsHeading?.content || "")
    .slice(1)
    .map((row) => ({
      name: stripMarkdownInline(row[0]),
      value: stripMarkdownInline(row[1]),
      rating: stripMarkdownInline(row[3] || ""),
    }))
    .slice(0, 4);

  const lighthouseScores = parseMarkdownTable(lighthouseHeading?.content || "")
    .slice(1)
    .map((row) => ({
      name: stripMarkdownInline(row[0]),
      value: stripMarkdownInline(row[1]),
    }))
    .slice(0, 4);

  return {
    facts: {
      date: getField(auditMarkdown, "Date") || formatDateTime(report.generated_at),
      businessType: getField(auditMarkdown, "Business Type Detected") || "SEO audit report",
      pagesCrawled: getField(auditMarkdown, "Pages Crawled") || "Unknown",
      overallScore: report.overview?.health_score ?? (Number(getField(auditMarkdown, "Overall SEO Health Score").match(/\d+/)?.[0]) || null),
    },
    executiveSummary: stripMarkdownInline(findHeading(auditHeadings, /^Executive Summary$/i)?.content || ""),
    criticalIssues: parseListItems(findHeading(auditHeadings, /^Top 5 Critical Issues$/i)?.content || ""),
    quickWins: parseListItems(findHeading(auditHeadings, /^Top 5 Quick Wins$/i)?.content || ""),
    whatsWorking: parseListItems(findHeading(auditHeadings, /^What's Working Well$/i)?.content || ""),
    categoryScores,
    strongestCategories: sortedByScore.slice(0, 2),
    weakestCategories: weakest.slice(0, 3),
    actionItems,
    weekOneActions: parseListItems(weekOneHeading?.content || ""),
    projectedOverall: projectedOverall
      ? {
          current: Number(projectedOverall[1]),
          afterSprint: Number(projectedOverall[2]),
          afterFull: Number(projectedOverall[3]),
        }
      : null,
    labMetrics,
    lighthouseScores,
    auditMarkdown,
    actionMarkdown,
  };
}

function renderStatChip(label, value, tone = "default") {
  return `
    <article class="stat-chip stat-chip-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderCategoryBreakdown(categories) {
  if (!categories.length) {
    return `<div class="empty-state"><strong>No score breakdown yet.</strong><p>The hosted payload needs category-level audit scores to render this section.</p></div>`;
  }

  return `
    <div class="category-list">
      ${categories
        .map(
          (category) => `
            <article class="category-card">
              <div class="category-head">
                <div>
                  <h3>${escapeHtml(category.name)}</h3>
                  <p>Weight ${escapeHtml(`${category.weight}%`)}</p>
                </div>
                <div class="category-score ${scoreClass(category.score)}">${escapeHtml(formatNumber(category.score))}</div>
              </div>
              <div class="category-track">
                <span style="width:${Math.max(6, Number(category.score || 0))}%"></span>
              </div>
              <div class="category-foot">
                <span>${escapeHtml(scoreStatus(category.score))}</span>
                <strong>Weighted ${escapeHtml(formatNumber(category.weighted))}</strong>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderBulletCards(items, tone) {
  if (!items.length) {
    return `<div class="empty-state"><strong>Nothing to show yet.</strong><p>This section will light up as soon as the report includes these items.</p></div>`;
  }

  return `
    <div class="bullet-card-grid">
      ${items
        .map(
          (item, index) => `
            <article class="bullet-card bullet-card-${tone}">
              <div class="bullet-index">${index + 1}</div>
              <p>${escapeHtml(item)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderStrengthCards(items) {
  if (!items.length) {
    return `<div class="empty-state"><strong>No strengths were parsed yet.</strong><p>Once the audit includes a success summary, this section will surface it here.</p></div>`;
  }

  return `
    <div class="strength-grid">
      ${items
        .map(
          (item) => `
            <article class="strength-card">
              <span class="strength-mark">+</span>
              <p>${escapeHtml(item)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderImprovementCards(categories) {
  if (!categories.length) {
    return `<div class="empty-state"><strong>No improvement map yet.</strong><p>The report needs category scores before this section can prioritize the weak spots.</p></div>`;
  }

  return `
    <div class="improvement-grid">
      ${categories
        .map(
          (category) => `
            <article class="improvement-card">
              <header>
                <strong>${escapeHtml(category.name)}</strong>
                <span class="pill ${severityClass(category.score < 55 ? "critical" : category.score < 70 ? "high" : "medium")}">${escapeHtml(`${category.score}/100`)}</span>
              </header>
              <p>${escapeHtml(insightForCategory(category.name))}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderSprintCards(items) {
  if (!items.length) {
    return `<div class="empty-state"><strong>No week-one plan yet.</strong><p>The action plan should include a first sprint or critical task list for this section.</p></div>`;
  }

  return `
    <div class="sprint-grid">
      ${items
        .map(
          (item, index) => `
            <article class="sprint-card">
              <div class="sprint-index">${index + 1}</div>
              <p>${escapeHtml(item)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderPriorityCards(items) {
  if (!items.length) {
    return "";
  }

  return `
    <div class="priority-stack">
      ${items
        .map(
          (item) => `
            <article class="priority-card">
              <header>
                <strong>${escapeHtml(item.title)}</strong>
                ${item.effort ? `<span>${escapeHtml(item.effort)}</span>` : ""}
              </header>
              <p>${escapeHtml(item.action || item.expectedLift || "Recommended next step from the action plan.")}</p>
              ${item.expectedLift ? `<div class="priority-lift">${escapeHtml(item.expectedLift)}</div>` : ""}
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderMetricSnapshot(labMetrics, lighthouseScores) {
  const metrics = [...labMetrics.map((item) => ({ label: item.name, value: item.value })), ...lighthouseScores.map((item) => ({ label: item.name, value: item.value }))].slice(0, 6);

  if (!metrics.length) {
    return `<div class="empty-state"><strong>No standout metrics yet.</strong><p>Structured or parsed performance metrics will appear here when available.</p></div>`;
  }

  return `
    <div class="snapshot-grid">
      ${metrics
        .map(
          (metric) => `
            <article class="snapshot-card">
              <span>${escapeHtml(metric.label)}</span>
              <strong>${escapeHtml(metric.value)}</strong>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildAgentPrompt(report, insights) {
  const domain = report.target?.domain || "this site";
  return [
    `Review the attached FULL-AUDIT-REPORT.md and ACTION-PLAN.md for ${domain}.`,
    "Start with the Critical and Week 1 items first.",
    "Implement the highest-leverage fixes in PR-sized batches, preserving existing behavior where possible.",
    "Call out any risky tradeoffs before making changes, and summarize the expected SEO impact of each batch.",
  ].join(" ");
}

function attachReportActions(report, insights) {
  const domain = (report.target?.domain || "seo-audit").replace(/[^a-z0-9.-]+/gi, "-");
  const auditButton = document.querySelector("#download-full-audit");
  const planButton = document.querySelector("#download-action-plan");
  const promptButton = document.querySelector("#copy-agent-brief");
  const promptOutput = document.querySelector("#agent-brief-text");

  if (auditButton && insights.auditMarkdown) {
    auditButton.addEventListener("click", () => {
      downloadTextFile(`${domain}-FULL-AUDIT-REPORT.md`, insights.auditMarkdown);
    });
  }

  if (planButton && insights.actionMarkdown) {
    planButton.addEventListener("click", () => {
      downloadTextFile(`${domain}-ACTION-PLAN.md`, insights.actionMarkdown);
    });
  }

  if (promptOutput) {
    promptOutput.textContent = buildAgentPrompt(report, insights);
  }

  if (promptButton) {
    promptButton.addEventListener("click", async () => {
      const prompt = buildAgentPrompt(report, insights);
      try {
        await navigator.clipboard.writeText(prompt);
        promptButton.textContent = "Copied";
        window.setTimeout(() => {
          promptButton.textContent = "Copy Agent Brief";
        }, 1600);
      } catch {
        promptButton.textContent = "Copy failed";
      }
    });
  }
}

function reportPage(report) {
  const insights = buildReportInsights(report);
  const score = insights.facts.overallScore;
  const nav = `<a href="/">Home</a><a href="#agent-brief">Agent Brief</a>`;
  const strongest = insights.strongestCategories[0];
  const weakest = insights.weakestCategories[0];
  const sprintScore = insights.projectedOverall?.afterSprint;
  const fullScore = insights.projectedOverall?.afterFull;

  app.innerHTML = shell(`
    <section class="client-hero fade-rise">
      <div class="client-hero-copy fade-rise stagger-1">
        <div class="eyebrow">Agency client report</div>
        <div class="report-headline">${escapeHtml(report.target?.domain || "Unknown domain")}<br><span class="serif">SEO dashboard.</span></div>
        <p class="report-subhead">
          ${escapeHtml(insights.executiveSummary || "A high-level dashboard view of the audit, shaped for fast client readouts and clear implementation follow-through.")}
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href="#first-sprint">See First Sprint</a>
          <a class="button button-secondary" href="#agent-brief">Download Briefs</a>
        </div>
      </div>
      <aside class="client-scorecard fade-rise stagger-2">
        <div class="score-badge-wrap">
          <div class="score-badge">
            <span>SEO health</span>
            <strong>${escapeHtml(formatNumber(score))}</strong>
            <small>${escapeHtml(scoreStatus(score))}</small>
          </div>
          <div class="score-projection">
            ${sprintScore ? `<div><span>After first sprint</span><strong>${escapeHtml(`${sprintScore}/100`)}</strong></div>` : ""}
            ${fullScore ? `<div><span>After full plan</span><strong>${escapeHtml(`${fullScore}/100`)}</strong></div>` : ""}
          </div>
        </div>
        <div class="hero-facts">
          <div><span>Business type</span><strong>${escapeHtml(insights.facts.businessType)}</strong></div>
          <div><span>Pages crawled</span><strong>${escapeHtml(insights.facts.pagesCrawled)}</strong></div>
          <div><span>Generated</span><strong>${escapeHtml(insights.facts.date)}</strong></div>
        </div>
      </aside>
    </section>

    <div class="dashboard-layout">
      <main class="dashboard-main">
        <section class="section-panel report-section fade-rise stagger-1" id="quick-readout">
          <div class="section-heading">
            <div>
              <h2>Quick readout</h2>
              <p>The top-line story you can walk a client through in under two minutes.</p>
            </div>
          </div>
          <div class="stat-ribbon">
            ${renderStatChip("Top strength", strongest ? `${strongest.name} ${strongest.score}` : "—", "good")}
            ${renderStatChip("Biggest blocker", weakest ? `${weakest.name} ${weakest.score}` : "—", "warn")}
            ${renderStatChip("Critical issues", String(insights.criticalIssues.length || report.overview?.critical_issue_count || 0), "alert")}
            ${renderStatChip("Quick wins", String(insights.quickWins.length || report.overview?.quick_win_count || 0), "default")}
          </div>
        </section>

        <section class="section-panel report-section fade-rise stagger-1" id="score-breakdown">
          <div class="section-heading">
            <div>
              <h2>Score breakdown</h2>
              <p>Category scores make it obvious where the site is already strong and where the next gains should come from.</p>
            </div>
          </div>
          ${renderCategoryBreakdown(insights.categoryScores)}
        </section>

        <section class="section-panel report-section fade-rise stagger-2" id="quick-wins">
          <div class="section-heading">
            <div>
              <h2>Quick wins and strengths</h2>
              <p>Separate what is already working from what can be tightened quickly so the conversation stays constructive.</p>
            </div>
          </div>
          <div class="dual-panel-grid">
            <div>
              <div class="mini-section-kicker">What is already working</div>
              ${renderStrengthCards(insights.whatsWorking.slice(0, 6))}
            </div>
            <div>
              <div class="mini-section-kicker">Fast wins</div>
              ${renderBulletCards(insights.quickWins.slice(0, 5), "warm")}
            </div>
          </div>
        </section>

        <section class="section-panel report-section fade-rise stagger-2" id="challenges">
          <div class="section-heading">
            <div>
              <h2>Challenges and where to improve</h2>
              <p>The main blockers and the weakest score areas sit side by side so the fixes feel connected to the outcome.</p>
            </div>
          </div>
          <div class="dual-panel-grid">
            <div>
              <div class="mini-section-kicker">Top challenges</div>
              ${renderBulletCards(insights.criticalIssues.slice(0, 5), "alert")}
            </div>
            <div>
              <div class="mini-section-kicker">Improvement map</div>
              ${renderImprovementCards(insights.weakestCategories)}
            </div>
          </div>
        </section>

        <section class="section-panel report-section fade-rise stagger-3" id="first-sprint">
          <div class="section-heading">
            <div>
              <h2>First sprint</h2>
              <p>The first week should feel concrete. This turns the action plan into the next set of moves, not a wall of recommendations.</p>
            </div>
          </div>
          ${renderSprintCards(insights.weekOneActions.length ? insights.weekOneActions : insights.actionItems.critical.slice(0, 5).map((item) => item.title))}
          ${renderPriorityCards(insights.actionItems.critical.slice(0, 3))}
        </section>

        <section class="section-panel report-section fade-rise stagger-3" id="standout-metrics">
          <div class="section-heading">
            <div>
              <h2>Standout metrics</h2>
              <p>This keeps the memorable proof points visible when the site has a few standout numbers worth repeating in a client call.</p>
            </div>
          </div>
          ${renderMetricSnapshot(insights.labMetrics, insights.lighthouseScores)}
        </section>
      </main>

      <aside class="dashboard-rail">
        <div class="rail-card download-card" id="agent-brief">
          <h3>Implementation brief</h3>
          <p>
            The detailed report stays as markdown on purpose. Download the files below and hand them to an agent or engineer to work through the recommendations.
          </p>
          <div class="download-actions">
            <button class="button button-primary" id="download-full-audit"${insights.auditMarkdown ? "" : " disabled"}>Download Full Report</button>
            <button class="button button-secondary" id="download-action-plan"${insights.actionMarkdown ? "" : " disabled"}>Download Action Plan</button>
          </div>
          <div class="agent-brief-box">
            <span>Suggested prompt</span>
            <p id="agent-brief-text"></p>
          </div>
          <button class="button button-secondary button-block" id="copy-agent-brief">Copy Agent Brief</button>
        </div>

        <div class="rail-card">
          <h3>Report snapshot</h3>
          <div class="rail-stat">
            <span class="section-copy">Report ID</span>
            <strong>${escapeHtml(report.report_id || "Unknown")}</strong>
          </div>
          <div class="rail-stat">
            <span class="section-copy">Included</span>
            <strong>${escapeHtml((report.source?.artifacts_present || []).join(", ") || "Unknown")}</strong>
          </div>
          <div class="rail-stat">
            <span class="section-copy">Target</span>
            <strong>${escapeHtml(report.target?.url || report.target?.domain || "unknown")}</strong>
          </div>
        </div>

        <div class="rail-card">
          <h3>How to use this</h3>
          <div class="usage-steps">
            <div><span>1</span><p>Lead with the score and the biggest blockers.</p></div>
            <div><span>2</span><p>Use the first sprint to agree what gets fixed now.</p></div>
            <div><span>3</span><p>Download the markdown files and hand them to an agent for implementation.</p></div>
          </div>
        </div>
      </aside>
    </div>
  `, nav);

  attachReportActions(report, insights);
}

function reportErrorPage(message, reportId) {
  app.innerHTML = shell(`
    <div class="empty-wrap">
      <section class="empty-state fade-rise">
        <div class="eyebrow">Report unavailable</div>
        <h1>${escapeHtml(reportId || "Unknown report")}</h1>
        <p>${escapeHtml(message)}</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/">Return home</a>
        </div>
      </section>
    </div>
  `);
}

async function route() {
  const path = window.location.pathname;

  if (path === "/claim") {
    claimPage();
    return;
  }

  if (path.startsWith("/reports/")) {
    const reportId = decodeURIComponent(path.split("/").filter(Boolean)[1] || "");
    app.innerHTML = shell(`
      <div class="claim-wrap">
        <section class="claim-card fade-rise">
          <div class="eyebrow">Loading report</div>
          <h1>Opening the audit.</h1>
          <p>Loading the report for ${escapeHtml(reportId)}.</p>
          <div class="status-line"><span class="status-dot"></span><span>Loading the report view...</span></div>
        </section>
      </div>
    `, `<a href="/">Home</a>`);

    try {
      const report = await API.fetchReport(reportId);
      reportPage(report);
    } catch (error) {
      reportErrorPage(error.message, reportId);
    }
    return;
  }

  homePage();
}

route();
