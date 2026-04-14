#!/usr/bin/env python3
"""
Publish a hosted audit report to the report app.

Usage:
    python scripts/publish_hosted_report.py \
      --input hosted-audit.json \
      --base-url https://www.myseoaudit.xyz
"""

import argparse
import json
import sys
from pathlib import Path
from urllib import request, error


DEFAULT_BASE_URL = "https://www.myseoaudit.xyz"


def _post_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"POST {url} failed with {exc.code}: {body}") from exc


def _put_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="PUT",
    )
    try:
        with request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"PUT {url} failed with {exc.code}: {body}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a hosted Claude SEO report.")
    parser.add_argument("--input", "-i", required=True, help="Path to hosted-audit-report JSON.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Hosted report base URL.")
    args = parser.parse_args()

    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    domain = report.get("target", {}).get("domain") or "example.com"

    session = _post_json(
        f"{args.base_url.rstrip('/')}/api/report-uploads",
        {
            "domain": domain,
            "report_type": report.get("report_type", "full_audit"),
        },
    )

    result = _put_json(
        session["upload_url"],
        report,
        headers={"Authorization": f"Bearer {session['upload_token']}"},
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
