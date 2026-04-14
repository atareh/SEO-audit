import crypto from "node:crypto";

const DEFAULT_SECRET = "claude-seo-demo-secret-change-me";

function secret() {
  return process.env.REPORT_SECRET || DEFAULT_SECRET;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

export function signPayload(payload) {
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(
    crypto.createHmac("sha256", secret()).update(body).digest()
  );
  return `${body}.${signature}`;
}

export function verifyToken(token, expectedType) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [body, signature] = token.split(".");
  const expectedSignature = base64url(
    crypto.createHmac("sha256", secret()).update(body).digest()
  );

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(decodeBase64url(body));
  } catch {
    return null;
  }

  if (!payload || payload.type !== expectedType) {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return null;
  }

  return payload;
}

export function mintReportId(domain) {
  const cleaned = String(domain || "demo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `audit_${cleaned || "demo"}_${crypto.randomBytes(4).toString("hex")}`;
}
