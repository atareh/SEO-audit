import { signPayload, verifyToken } from "../_lib/tokens.js";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = req.body?.token;
  const claim = verifyToken(token, "claim");
  if (!claim) {
    res.status(401).json({ error: "This report link has expired or is invalid." });
    return;
  }

  const sessionToken = signPayload({
    type: "session",
    reportId: claim.reportId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });

  res.setHeader(
    "Set-Cookie",
    `report_session=${sessionToken}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
  res.status(200).json({ report_id: claim.reportId });
}
