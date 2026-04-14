import { get } from "@vercel/blob";
import { parseCookies, reportBlobPath } from "./_lib/report.js";
import { verifyToken } from "./_lib/tokens.js";

async function streamToString(stream) {
  const chunks = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const reportId = req.query.reportId;
  if (!reportId) {
    res.status(400).json({ error: "Missing report ID." });
    return;
  }

  const cookieJar = parseCookies(req.headers.cookie);
  const sessionToken = cookieJar.report_session;
  const session = verifyToken(sessionToken, "session");

  if (!session || session.reportId !== reportId) {
    res.status(401).json({ error: "This report needs a fresh link." });
    return;
  }

  try {
    const blob = await get(reportBlobPath(reportId), { access: "private" });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      res.status(404).json({ error: "Report not found." });
      return;
    }

    const payload = JSON.parse(await streamToString(blob.stream));
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      error: "Unable to load this report right now.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
