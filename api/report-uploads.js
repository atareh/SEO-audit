import { baseUrlFromRequest } from "./_lib/report.js";
import { mintReportId, signPayload } from "./_lib/tokens.js";

const UPLOAD_TTL_SECONDS = 15 * 60;

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const domain = req.body?.domain || "example.com";
  const reportId = mintReportId(domain);
  const uploadToken = signPayload({
    type: "upload",
    reportId,
    exp: Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS,
  });

  const baseUrl = baseUrlFromRequest(req);
  res.status(201).json({
    report_id: reportId,
    upload_url: `${baseUrl}/api/report-content?reportId=${encodeURIComponent(reportId)}`,
    upload_token: uploadToken,
    expires_at: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
  });
}
