#!/usr/bin/env python3
"""
Local hosted-report server for Claude SEO.

This server provides:
- static delivery for the hosted report UI
- a mock upload/finalize/claim/session flow
- private report fetching via an HttpOnly session cookie

It is intentionally lightweight and uses only Python's standard library so the
demo can run inside this repository without introducing a second backend stack.
"""

from __future__ import annotations

import json
import mimetypes
import secrets
import time
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse


HOST = "127.0.0.1"
PORT = 8765
UPLOAD_TTL_SECONDS = 15 * 60
CLAIM_TTL_SECONDS = 15 * 60
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

WEB_ROOT = Path(__file__).resolve().parent
REPO_ROOT = WEB_ROOT.parent
DATA_ROOT = WEB_ROOT / ".data"
REPORTS_DIR = DATA_ROOT / "reports"
UPLOADS_DIR = DATA_ROOT / "uploads"
CLAIMS_DIR = DATA_ROOT / "claims"
SESSIONS_DIR = DATA_ROOT / "sessions"
EXAMPLE_REPORT = REPO_ROOT / "schema" / "hosted-audit-report.example.json"

for directory in (DATA_ROOT, REPORTS_DIR, UPLOADS_DIR, CLAIMS_DIR, SESSIONS_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def now_ts() -> int:
    return int(time.time())


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def delete_file(path: Path) -> None:
    if path.exists():
        path.unlink()


def safe_report_id(domain: str) -> str:
    sanitized = "".join(ch if ch.isalnum() else "_" for ch in domain.lower()).strip("_")
    return f"audit_{sanitized}_{secrets.token_hex(4)}"


def mint_token() -> str:
    return secrets.token_urlsafe(24)


def expired(payload: Optional[Dict[str, Any]]) -> bool:
    if not payload:
        return True
    return int(payload.get("expires_at", 0)) < now_ts()


def parse_json_body(handler: BaseHTTPRequestHandler) -> Dict[str, Any]:
    raw_length = handler.headers.get("Content-Length", "0")
    try:
        length = int(raw_length)
    except ValueError:
        length = 0
    body = handler.rfile.read(length) if length > 0 else b"{}"
    if not body:
        return {}
    return json.loads(body.decode("utf-8"))


def parse_cookies(handler: BaseHTTPRequestHandler) -> cookies.SimpleCookie:
    jar = cookies.SimpleCookie()
    if handler.headers.get("Cookie"):
        jar.load(handler.headers["Cookie"])
    return jar


def session_for_request(handler: BaseHTTPRequestHandler) -> Optional[Dict[str, Any]]:
    jar = parse_cookies(handler)
    morsel = jar.get("report_session")
    if morsel is None:
        return None
    session_path = SESSIONS_DIR / f"{morsel.value}.json"
    payload = read_json(session_path)
    if expired(payload):
        delete_file(session_path)
        return None
    return payload


class ReportHandler(BaseHTTPRequestHandler):
    server_version = "ClaudeSEOReportServer/0.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path.startswith("/api/reports/"):
            self.handle_get_report(parsed.path)
            return

        if parsed.path.startswith("/schema/"):
            self.serve_repo_file(REPO_ROOT / parsed.path.lstrip("/"))
            return

        if parsed.path.startswith("/docs/"):
            self.serve_repo_file(REPO_ROOT / parsed.path.lstrip("/"), content_type="text/plain; charset=utf-8")
            return

        if parsed.path in ("/app.js", "/styles.css"):
            self.serve_repo_file(WEB_ROOT / parsed.path.lstrip("/"))
            return

        self.serve_repo_file(WEB_ROOT / "index.html")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/report-uploads":
            self.handle_create_upload()
            return
        if parsed.path.startswith("/api/report-uploads/") and parsed.path.endswith("/finalize"):
            self.handle_finalize_upload(parsed.path)
            return
        if parsed.path == "/api/claims/exchange":
            self.handle_exchange_claim()
            return
        if parsed.path == "/api/demo/bootstrap":
            self.handle_demo_bootstrap()
            return
        self.respond_json({"error": "Not found"}, status=404)

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/report-uploads/") and parsed.path.endswith("/content"):
            self.handle_upload_content(parsed.path)
            return
        self.respond_json({"error": "Not found"}, status=404)

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[webapp] {self.address_string()} - {fmt % args}")

    def respond_json(self, payload: Dict[str, Any], status: int = 200, extra_headers: Optional[Dict[str, str]] = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def serve_repo_file(self, path: Path, content_type: Optional[str] = None) -> None:
        if not path.exists() or not path.is_file():
            self.respond_json({"error": "Not found"}, status=404)
            return

        data = path.read_bytes()
        mime = content_type or mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_create_upload(self) -> None:
        body = parse_json_body(self)
        domain = body.get("domain", "unknown-domain")
        report_type = body.get("report_type", "full_audit")
        report_id = safe_report_id(domain)
        upload_token = mint_token()
        expires_at = now_ts() + UPLOAD_TTL_SECONDS

        write_json(
            UPLOADS_DIR / f"{upload_token}.json",
            {
                "report_id": report_id,
                "domain": domain,
                "report_type": report_type,
                "expires_at": expires_at,
            },
        )

        self.respond_json(
            {
                "report_id": report_id,
                "upload_url": f"http://{HOST}:{PORT}/api/report-uploads/{report_id}/content",
                "upload_token": upload_token,
                "expires_at": expires_at,
            },
            status=201,
        )

    def handle_upload_content(self, path: str) -> None:
        parts = path.strip("/").split("/")
        if len(parts) != 4:
            self.respond_json({"error": "Invalid upload path"}, status=404)
            return

        report_id = parts[2]
        auth_header = self.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            self.respond_json({"error": "Missing bearer token"}, status=401)
            return

        upload_token = auth_header.replace("Bearer ", "", 1).strip()
        upload_payload = read_json(UPLOADS_DIR / f"{upload_token}.json")
        if expired(upload_payload):
            delete_file(UPLOADS_DIR / f"{upload_token}.json")
            self.respond_json({"error": "Upload token expired or invalid"}, status=401)
            return

        if upload_payload["report_id"] != report_id:
            self.respond_json({"error": "Upload token does not match report"}, status=403)
            return

        report = parse_json_body(self)
        if report.get("schema_version") != "hosted-audit-report/v1":
            self.respond_json({"error": "Unsupported schema version"}, status=422)
            return

        report["report_id"] = report_id
        write_json(REPORTS_DIR / f"{report_id}.json", report)
        self.respond_json({"report_id": report_id, "status": "stored"})

    def handle_finalize_upload(self, path: str) -> None:
        parts = path.strip("/").split("/")
        if len(parts) != 4:
            self.respond_json({"error": "Invalid finalize path"}, status=404)
            return

        report_id = parts[2]
        if not (REPORTS_DIR / f"{report_id}.json").exists():
            self.respond_json({"error": "Report content not found"}, status=404)
            return

        claim_token = mint_token()
        expires_at = now_ts() + CLAIM_TTL_SECONDS
        write_json(
            CLAIMS_DIR / f"{claim_token}.json",
            {
                "report_id": report_id,
                "used": False,
                "expires_at": expires_at,
            },
        )

        self.respond_json(
            {
                "report_id": report_id,
                "claim_url": f"http://{HOST}:{PORT}/claim?token={claim_token}",
                "expires_at": expires_at,
            }
        )

    def handle_exchange_claim(self) -> None:
        body = parse_json_body(self)
        token = body.get("token")
        if not token:
            self.respond_json({"error": "Missing claim token"}, status=400)
            return

        claim_path = CLAIMS_DIR / f"{token}.json"
        claim_payload = read_json(claim_path)
        if expired(claim_payload):
            delete_file(claim_path)
            self.respond_json({"error": "Claim token expired or invalid"}, status=401)
            return

        if claim_payload.get("used"):
            self.respond_json({"error": "Claim token has already been used"}, status=409)
            return

        claim_payload["used"] = True
        write_json(claim_path, claim_payload)

        session_token = mint_token()
        report_id = claim_payload["report_id"]
        write_json(
            SESSIONS_DIR / f"{session_token}.json",
            {
                "report_id": report_id,
                "expires_at": now_ts() + SESSION_TTL_SECONDS,
            },
        )

        headers = {
            "Set-Cookie": (
                f"report_session={session_token}; "
                f"Max-Age={SESSION_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax"
            )
        }
        self.respond_json({"report_id": report_id}, extra_headers=headers)

    def handle_get_report(self, path: str) -> None:
        parts = path.strip("/").split("/")
        if len(parts) != 3:
            self.respond_json({"error": "Invalid report path"}, status=404)
            return

        report_id = parts[2]
        session = session_for_request(self)
        if not session or session.get("report_id") != report_id:
            self.respond_json({"error": "This report requires an active report session"}, status=401)
            return

        report_payload = read_json(REPORTS_DIR / f"{report_id}.json")
        if not report_payload:
            self.respond_json({"error": "Report not found"}, status=404)
            return

        self.respond_json(report_payload)

    def handle_demo_bootstrap(self) -> None:
        if not EXAMPLE_REPORT.exists():
            self.respond_json({"error": "Example report payload missing"}, status=500)
            return

        report = read_json(EXAMPLE_REPORT)
        assert report is not None
        report_id = safe_report_id(report.get("target", {}).get("domain", "demo"))
        report["report_id"] = report_id
        report["generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        write_json(REPORTS_DIR / f"{report_id}.json", report)

        claim_token = mint_token()
        write_json(
            CLAIMS_DIR / f"{claim_token}.json",
            {
                "report_id": report_id,
                "used": False,
                "expires_at": now_ts() + CLAIM_TTL_SECONDS,
            },
        )

        self.respond_json(
            {
                "report_id": report_id,
                "claim_url": f"http://{HOST}:{PORT}/claim?token={claim_token}",
            },
            status=201,
        )


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), ReportHandler)
    print(f"Claude SEO hosted report app running at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
