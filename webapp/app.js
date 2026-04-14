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
            <strong>Claude SEO Reports</strong>
            <span>Hosted SEO audits, made easy to revisit</span>
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
        <h1>An SEO audit<br><span class="serif">you can actually keep.</span></h1>
        <p class="lede">
          Run an audit once, then hand over a clean report link with scorecards, search visibility,
          indexation health, and a clear action plan. It feels more like a product than a transcript.
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

function renderMetricTile(label, value) {
  return `
    <div class="metric-tile">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderHighlights(items) {
  if (!items.length) {
    return `<div class="issue-card"><strong>Nothing urgent surfaced.</strong><p>No items have been promoted into this highlight group yet.</p></div>`;
  }

  return items
    .map(
      (item) => `
        <article class="issue-card">
          <header>
            <strong>${escapeHtml(item.title || "Untitled insight")}</strong>
            <span class="pill ${severityClass(item.severity)}">${escapeHtml(item.severity || "medium")}</span>
          </header>
          <p>${escapeHtml(item.detail || "No detail provided.")}</p>
          <div class="mini-meta">
            <span>Source: ${escapeHtml(item.source || "unknown")}</span>
            ${item.effort ? `<span>Effort: ${escapeHtml(item.effort)}</span>` : ""}
          </div>
        </article>
      `
    )
    .join("");
}

function renderPerformanceSection(section) {
  if (!section.available) {
    return `<div class="empty-state"><strong>No structured performance data yet.</strong><p>Run the Google-report data flow or connect PageSpeed + CrUX sources.</p></div>`;
  }

  const scores = section.lighthouse_scores || {};
  const metrics = Object.entries(section.core_web_vitals || {});

  return `
    <div class="performance-grid">
      <div class="lighthouse-list">
        ${Object.entries(scores)
          .map(
            ([label, score]) => `
              <div class="lighthouse-item">
                <div>
                  <strong>${escapeHtml(label.replace("-", " "))}</strong>
                  <p class="section-copy">Normalized directly from the structured Google report output.</p>
                </div>
                <span class="score-chip ${scoreClass(score)}">${escapeHtml(formatNumber(score))}/100</span>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="cwv-list">
        ${metrics
          .map(([key, metric]) => {
            const distribution = metric.distribution || {};
            const good = Number(distribution.good || 0);
            const ni = Number(distribution.needs_improvement || 0);
            const poor = Number(distribution.poor || 0);
            const total = Math.max(good + ni + poor, 1);
            return `
              <div class="cwv-item">
                <div class="cwv-topline">
                  <div>
                    <strong>${escapeHtml(metric.label || key)}</strong>
                    <span>${escapeHtml(metric.rating || "Unrated")}</span>
                  </div>
                  <div><strong>${escapeHtml(formatMetricValue(metric))}</strong></div>
                </div>
                <div class="stacked-bar">
                  <span style="width:${(good / total) * 100}%"></span>
                  <span style="width:${(ni / total) * 100}%"></span>
                  <span style="width:${(poor / total) * 100}%"></span>
                </div>
                <div class="mini-meta">
                  <span>Good ${formatPercent(good / total)}</span>
                  <span>NI ${formatPercent(ni / total)}</span>
                  <span>Poor ${formatPercent(poor / total)}</span>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderSearchConsole(section) {
  if (!section.available) {
    return `<div class="empty-state"><strong>No Search Console section yet.</strong><p>This area lights up once GSC totals, rows, or quick-win queries are available.</p></div>`;
  }

  const queries = Array.isArray(section.top_queries) ? section.top_queries.slice(0, 8) : [];
  const maxImpressions = Math.max(...queries.map((entry) => Number(entry.impressions || 0)), 1);

  return `
    <div class="query-layout">
      <div class="query-chart">
        ${queries
          .map(
            (entry) => `
              <div class="query-row">
                <div class="query-meta">
                  <strong>${escapeHtml(getQueryLabel(entry))}</strong>
                  <span>${escapeHtml(formatNumber(entry.impressions || 0))} impressions</span>
                </div>
                <div class="query-bar">
                  <span style="width:${(Number(entry.impressions || 0) / maxImpressions) * 100}%"></span>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="query-table">
        <h3>Quick wins</h3>
        <table>
          <thead>
            <tr>
              <th>Query</th>
              <th>Pos.</th>
              <th>Impr.</th>
              <th>Clicks</th>
            </tr>
          </thead>
          <tbody>
            ${(section.quick_wins || [])
              .slice(0, 8)
              .map(
                (entry) => `
                  <tr>
                    <td>${escapeHtml(getQueryLabel(entry))}</td>
                    <td>${escapeHtml(formatNumber(entry.position))}</td>
                    <td>${escapeHtml(formatNumber(entry.impressions || 0))}</td>
                    <td>${escapeHtml(formatNumber(entry.clicks || 0))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderIndexation(section) {
  if (!section.available) {
    return `<div class="empty-state"><strong>No URL inspection data yet.</strong><p>Once inspection results exist, this view will render indexation coverage and per-URL visibility.</p></div>`;
  }

  const summary = section.summary || {};
  const total = Number(section.total || 0);
  const indexed = Number(summary.pass || 0);
  const failed = Number(summary.fail || 0);
  const neutral = Number(summary.neutral || 0);
  const errors = Number(summary.error || 0);
  const percent = total ? ((indexed / total) * 100).toFixed(1) : "0.0";

  return `
    <div class="index-layout">
      <div class="donut-card">
        <div class="donut" style="--donut-indexed:${total ? (indexed / total) * 100 : 0}; --donut-fail:${total ? (failed / total) * 100 : 0}; --donut-neutral:${total ? (neutral / total) * 100 : 0};">
          <div class="donut-copy">
            <strong>${escapeHtml(percent)}%</strong>
            <span>Index rate</span>
          </div>
        </div>
        <div class="legend">
          <span class="legend-item"><span class="legend-dot" style="background:var(--success)"></span>Indexed ${escapeHtml(formatNumber(indexed))}</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--alert)"></span>Not indexed ${escapeHtml(formatNumber(failed))}</span>
          <span class="legend-item"><span class="legend-dot" style="background:rgba(21, 36, 45, 0.22)"></span>Neutral ${escapeHtml(formatNumber(neutral + errors))}</span>
        </div>
      </div>
      <div class="query-table">
        <h3>Sample inspected URLs</h3>
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Verdict</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            ${(section.results || [])
              .slice(0, 8)
              .map(
                (entry) => `
                  <tr>
                    <td>${escapeHtml(entry.url || "Unknown URL")}</td>
                    <td>${escapeHtml(entry.verdict || "Unknown")}</td>
                    <td>${escapeHtml(entry.coverage_state || "—")}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMarkdownSection(section, fallbackLabel) {
  const headings = getHeadings(section);
  if (!section?.available || !headings.length) {
    return `<div class="empty-state"><strong>${escapeHtml(fallbackLabel)}</strong><p>The hosted payload does not include this section yet.</p></div>`;
  }

  return `
    <div class="markdown-grid">
      ${headings
        .map(
          (heading) => `
            <article class="report-block" id="${escapeHtml(heading.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">
              <h3>${escapeHtml(heading.title)}</h3>
              ${renderHeadingContent(heading.content)}
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function reportPage(report) {
  const overview = report.overview || {};
  const healthScore = overview.health_score;
  const ringColor = scoreTone(healthScore);
  const nav = `<a href="/">Home</a>`;
  const outline = [
    "Overview",
    "Highlights",
    "Performance",
    "Search Console",
    "Indexation",
    "Audit Notes",
    "Action Plan",
  ];

  app.innerHTML = shell(`
    <section class="hero fade-rise">
      <div class="fade-rise stagger-1">
        <div class="eyebrow">Hosted audit report</div>
        <div class="report-headline">${escapeHtml(report.target?.domain || "Unknown domain")}<br><span class="serif">under the microscope.</span></div>
        <p class="report-subhead">
          Generated ${escapeHtml(formatDateTime(report.generated_at))}. This view combines structured Google metrics,
          indexation signals, and preserved strategic notes into one report that is easier to share, review, and revisit.
        </p>
      </div>
      <aside class="hero-note fade-rise stagger-2">
        <h2>Report snapshot</h2>
        <p>
          A clearer way to walk someone through what matters, what is fixable, and what to do next.
        </p>
        <div class="roadmap-list">
          <div class="roadmap-item"><strong>Report ID</strong><p class="section-copy">${escapeHtml(report.report_id || "Unknown")}</p></div>
          <div class="roadmap-item"><strong>Included</strong><p class="section-copy">${escapeHtml((report.source?.artifacts_present || []).join(", ") || "Unknown")}</p></div>
        </div>
      </aside>
    </section>

    <div class="page-grid">
      <main class="content-stack">
        <section class="section-panel fade-rise stagger-1" id="overview">
          <div class="section-heading">
            <div>
              <h2>Overview</h2>
              <p>The first screen gives the user the shape of the audit before they dive into the detail.</p>
            </div>
          </div>
          <div class="score-stage">
            <div class="score-ring" style="--score:${Number(healthScore || 0)}; --ring-color:${ringColor}">
              <div class="score-copy">
                <small>SEO health</small>
                <div class="score-number">${escapeHtml(formatNumber(healthScore))}</div>
                <p>${healthScore === null || healthScore === undefined ? "Waiting on a scored audit." : "A quick read on overall search health."}</p>
              </div>
            </div>
            <div class="metrics-grid">
              ${renderMetricTile("Performance", overview.lighthouse_performance_score ? `${formatNumber(overview.lighthouse_performance_score)}/100` : "—")}
              ${renderMetricTile("SEO", overview.lighthouse_seo_score ? `${formatNumber(overview.lighthouse_seo_score)}/100` : "—")}
              ${renderMetricTile("Clicks", formatNumber(overview.total_clicks))}
              ${renderMetricTile("Impressions", formatNumber(overview.total_impressions))}
              ${renderMetricTile("Indexed URLs", formatNumber(overview.indexed_urls))}
              ${renderMetricTile("Quick wins", formatNumber(overview.quick_win_count))}
            </div>
          </div>
        </section>

        <section class="section-panel fade-rise stagger-1" id="highlights">
          <div class="section-heading">
            <div>
              <h2>Highlights</h2>
              <p>The biggest problems and easiest wins stay visible instead of getting buried in a long audit export.</p>
            </div>
          </div>
          <div class="split-grid">
            <div>
              <div class="eyebrow">Critical issues</div>
              <div class="markdown-grid">${renderHighlights(report.highlights?.critical_issues || [])}</div>
            </div>
            <div>
              <div class="eyebrow">Quick wins</div>
              <div class="markdown-grid">${renderHighlights(report.highlights?.quick_wins || [])}</div>
            </div>
          </div>
        </section>

        <section class="section-panel fade-rise stagger-2" id="performance">
          <div class="section-heading">
            <div>
              <h2>Performance</h2>
              <p>Speed and quality metrics are grouped here so the story is easy to scan.</p>
            </div>
          </div>
          ${renderPerformanceSection(report.sections?.performance || { available: false })}
        </section>

        <section class="section-panel fade-rise stagger-2" id="search-console">
          <div class="section-heading">
            <div>
              <h2>Search Console</h2>
              <p>Query demand and page-one opportunities are surfaced visually for fast decision-making.</p>
            </div>
          </div>
          ${renderSearchConsole(report.sections?.search_console || { available: false })}
        </section>

        <section class="section-panel fade-rise stagger-3" id="indexation">
          <div class="section-heading">
            <div>
              <h2>Indexation</h2>
              <p>The user sees how much of the site is being picked up, with example URLs beneath the headline number.</p>
            </div>
          </div>
          ${renderIndexation(report.sections?.indexation || { available: false })}
        </section>

        <section class="section-panel fade-rise stagger-3" id="audit-notes">
          <div class="section-heading">
            <div>
              <h2>Audit notes</h2>
              <p>The full audit can still live here for anyone who wants the detailed reasoning behind the summary.</p>
            </div>
          </div>
          ${renderMarkdownSection(report.sections?.audit_report, "No audit markdown found.")}
        </section>

        <section class="section-panel fade-rise stagger-3" id="action-plan">
          <div class="section-heading">
            <div>
              <h2>Action plan</h2>
              <p>The priorities stay intact, but the report experience makes the next moves easier to talk through.</p>
            </div>
          </div>
          ${renderMarkdownSection(report.sections?.action_plan, "No action plan found.")}
        </section>
      </main>

      <aside class="side-rail">
        <div class="rail-card">
          <h3>Navigate</h3>
          <div class="outline-list">
            ${outline
              .map((label) => {
                const href = "#" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                return `<a class="outline-link" href="${href}">${escapeHtml(label)}</a>`;
              })
              .join("")}
          </div>
        </div>
        <div class="rail-card">
          <h3>Session snapshot</h3>
          <div class="rail-stat">
            <span class="section-copy">Generated</span>
            <strong>${escapeHtml(formatDateTime(report.generated_at))}</strong>
          </div>
          <div class="rail-stat">
            <span class="section-copy">Report type</span>
            <strong>${escapeHtml(report.report_type || "unknown")}</strong>
          </div>
          <div class="rail-stat">
            <span class="section-copy">Target</span>
            <strong>${escapeHtml(report.target?.url || report.target?.domain || "unknown")}</strong>
          </div>
        </div>
      </aside>
    </div>
  `, nav);
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
