import { buildDemoReport, reportBlobPath, baseUrlFromRequest } from "../_lib/report.js";
import { mintReportId, signPayload } from "../_lib/tokens.js";
import { put } from "@vercel/blob";

const CLAIM_TTL_SECONDS = 15 * 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const reportId = mintReportId("example.com");
  const report = buildDemoReport(reportId);

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

  res.status(201).json({
    report_id: reportId,
    claim_url: `${baseUrlFromRequest(req)}/claim?token=${claimToken}`,
  });
}
