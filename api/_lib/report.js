import { readFileSync } from "node:fs";

const examplePath = new URL("../../schema/hosted-audit-report.example.json", import.meta.url);

export function buildDemoReport(reportId) {
  const example = JSON.parse(readFileSync(examplePath, "utf8"));
  return {
    ...example,
    report_id: reportId,
    generated_at: new Date().toISOString(),
  };
}

export function parseCookies(header) {
  if (!header) {
    return {};
  }

  return header.split(";").reduce((acc, pair) => {
    const index = pair.indexOf("=");
    if (index === -1) {
      return acc;
    }
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
}

export function reportBlobPath(reportId) {
  return `reports/${reportId}.json`;
}

export function baseUrlFromRequest(req) {
  return `https://${req.headers.host}`;
}
