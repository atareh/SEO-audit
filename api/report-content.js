import { put } from "@vercel/blob";
import { baseUrlFromRequest, reportBlobPath } from "./_lib/report.js";
import { signPayload, verifyToken } from "./_lib/tokens.js";

const CLAIM_TTL_SECONDS = 15 * 60;

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const reportId = req.query.reportId;
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const upload = verifyToken(token, "upload");

  if (!reportId || !upload || upload.reportId !== reportId) {
    res.status(401).json({ error: "Upload permission is missing or expired." });
    return;
  }

  if (req.body?.schema_version !== "hosted-audit-report/v1") {
    res.status(422).json({ error: "Unsupported report format." });
    return;
  }

  const report = {
    ...req.body,
    report_id: reportId,
  };

  try {
    await put(
      reportBlobPath(reportId),
      JSON.stringify(report),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      }
    );
  } catch (error) {
    res.status(500).json({
      error: "Hosted report storage is not configured yet. Connect Vercel Blob to this project first.",
      detail: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const claimToken = signPayload({
    type: "claim",
    reportId,
    exp: Math.floor(Date.now() / 1000) + CLAIM_TTL_SECONDS,
  });

  res.status(200).json({
    report_id: reportId,
    claim_url: `${baseUrlFromRequest(req)}/claim?token=${claimToken}`,
    report_url: `${baseUrlFromRequest(req)}/reports/${encodeURIComponent(reportId)}`,
  });
}
