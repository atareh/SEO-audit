#!/usr/bin/env python3
"""
Normalize existing Claude SEO artifacts into a canonical hosted-report payload.

This script is intentionally conservative:
- It fully normalizes structured Google API data that already exists.
- It preserves full audit markdown and action-plan markdown verbatim.
- It extracts lightweight headings and priority buckets so a web UI can render
  a useful first version before we have a stable full-audit JSON contract.

Usage:
    python scripts/export_hosted_report.py \
      --domain example.com \
      --url https://example.com \
      --google-data full-data.json \
      --audit-report FULL-AUDIT-REPORT.md \
      --action-plan ACTION-PLAN.md \
      --output hosted-audit.json
"""

import argparse
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
LIST_ITEM_RE = re.compile(r"^\s*(?:[-*]|\d+\.)\s+(.*)$")
HEALTH_SCORE_RE = re.compile(
    r"(?:SEO\s+Health\s+Score|Health\s+Score)[^\d]{0,20}(\d{1,3})",
    re.IGNORECASE,
)


def _read_text(path: Optional[str]) -> str:
    if not path:
        return ""
    return Path(path).read_text(encoding="utf-8")


def _read_json(path: Optional[str]) -> Dict[str, Any]:
    if not path:
        return {}
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return slug or "report"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _extract_headings(markdown: str) -> List[Dict[str, Any]]:
    if not markdown.strip():
        return []

    lines = markdown.splitlines()
    headings: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    buffer: List[str] = []

    for line in lines:
        match = HEADING_RE.match(line)
        if match:
            if current is not None:
                current["content"] = "\n".join(buffer).strip()
                headings.append(current)
            current = {
                "level": len(match.group(1)),
                "title": match.group(2).strip(),
            }
            buffer = []
        else:
            buffer.append(line)

    if current is not None:
        current["content"] = "\n".join(buffer).strip()
        headings.append(current)

    if headings:
        return headings

    return [
        {
            "level": 1,
            "title": "Document",
            "content": markdown.strip(),
        }
    ]


def _extract_priority_buckets(markdown: str) -> List[Dict[str, Any]]:
    buckets: List[Dict[str, Any]] = []
    headings = _extract_headings(markdown)
    priorities = ("critical", "high", "medium", "low")

    for heading in headings:
        title = heading["title"].lower()
        priority = next((p for p in priorities if p in title), None)
        if not priority:
            continue

        items = []
        for line in heading["content"].splitlines():
            match = LIST_ITEM_RE.match(line)
            if match:
                items.append(match.group(1).strip())

        if items:
            buckets.append(
                {
                    "priority": priority,
                    "items": items,
                }
            )

    return buckets


def _extract_health_score(audit_markdown: str) -> Optional[int]:
    if not audit_markdown:
        return None
    match = HEALTH_SCORE_RE.search(audit_markdown)
    if not match:
        return None
    value = int(match.group(1))
    return value if 0 <= value <= 100 else None


def _mobile_psi(google_data: Dict[str, Any]) -> Dict[str, Any]:
    psi = google_data.get("psi", {})
    if not isinstance(psi, dict):
        return {}
    nested = psi.get("psi", {})
    if isinstance(nested, dict):
        mobile = nested.get("mobile")
        if isinstance(mobile, dict):
            return mobile
    return psi if isinstance(psi, dict) else {}


def _normalize_cwv_metrics(crux_data: Dict[str, Any]) -> Dict[str, Any]:
    metrics = crux_data.get("metrics", {})
    if not isinstance(metrics, dict):
        return {}
    keep = (
        "largest_contentful_paint",
        "interaction_to_next_paint",
        "cumulative_layout_shift",
        "first_contentful_paint",
        "experimental_time_to_first_byte",
    )
    return {name: metrics[name] for name in keep if name in metrics}


def _normalize_search_console(gsc_data: Dict[str, Any]) -> Dict[str, Any]:
    rows = gsc_data.get("rows", [])
    rows = rows if isinstance(rows, list) else []

    top_queries = []
    top_pages = []
    for row in rows[:50]:
        if not isinstance(row, dict):
            continue
        keys = row.get("keys", [])
        query = row.get("query") or (keys[0] if keys else None)
        page = row.get("page") or (keys[1] if len(keys) > 1 else None)
        normalized = {
            "query": query,
            "page": page,
            "clicks": row.get("clicks"),
            "impressions": row.get("impressions"),
            "ctr": row.get("ctr"),
            "position": row.get("position"),
        }
        if query:
            top_queries.append(normalized)
        if page:
            top_pages.append(normalized)

    top_queries = sorted(
        top_queries,
        key=lambda item: item.get("impressions") or 0,
        reverse=True,
    )[:12]
    top_pages = sorted(
        top_pages,
        key=lambda item: item.get("impressions") or 0,
        reverse=True,
    )[:12]

    return {
        "available": bool(gsc_data),
        "totals": gsc_data.get("totals", {}),
        "top_queries": top_queries,
        "top_pages": top_pages,
        "quick_wins": gsc_data.get("quick_wins", [])[:20] if isinstance(gsc_data.get("quick_wins"), list) else [],
    }


def _normalize_indexation(inspection_data: Dict[str, Any]) -> Dict[str, Any]:
    results = inspection_data.get("results", [])
    normalized_results = []
    if isinstance(results, list):
        for item in results[:100]:
            if not isinstance(item, dict):
                continue
            result_data = item.get("inspectionResult", item)
            index_status = result_data.get("indexStatusResult", {})
            normalized_results.append(
                {
                    "url": item.get("url", result_data.get("inspectedUrl")),
                    "verdict": index_status.get("verdict"),
                    "coverage_state": index_status.get("coverageState"),
                    "indexing_state": index_status.get("indexingState"),
                    "last_crawl_time": index_status.get("lastCrawlTime"),
                    "google_canonical": index_status.get("googleCanonical"),
                    "user_canonical": index_status.get("userCanonical"),
                }
            )

    return {
        "available": bool(inspection_data),
        "summary": inspection_data.get("summary", {}),
        "total": inspection_data.get("total"),
        "results": normalized_results,
    }


def _collect_critical_issues(
    mobile_psi: Dict[str, Any],
    inspection: Dict[str, Any],
    action_priorities: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []

    failed_audits = mobile_psi.get("failed_audits", [])
    if isinstance(failed_audits, list):
        for audit in sorted(
            [item for item in failed_audits if isinstance(item, dict)],
            key=lambda item: item.get("score", 1),
        )[:5]:
            issues.append(
                {
                    "title": audit.get("title", "Failed performance audit"),
                    "detail": f"Lighthouse audit score: {audit.get('score', 0):.0%}",
                    "source": "google-data.performance",
                    "severity": "critical" if (audit.get("score", 1) or 1) < 0.5 else "high",
                    "value": audit.get("score"),
                }
            )

    fail_count = inspection.get("summary", {}).get("fail", 0)
    if fail_count:
        issues.append(
            {
                "title": f"{fail_count} URL(s) are not indexed",
                "detail": "Google URL Inspection reported FAIL for one or more inspected URLs.",
                "source": "google-data.indexation",
                "severity": "high",
                "value": fail_count,
            }
        )

    for bucket in action_priorities:
        if bucket.get("priority") != "critical":
            continue
        for item in bucket.get("items", [])[:5]:
            issues.append(
                {
                    "title": item,
                    "detail": "Imported from the audit action plan.",
                    "source": "action-plan",
                    "severity": "critical",
                }
            )

    return issues[:8]


def _collect_quick_wins(
    mobile_psi: Dict[str, Any],
    search_console: Dict[str, Any],
    action_priorities: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    wins: List[Dict[str, Any]] = []

    quick_wins = search_console.get("quick_wins", [])
    if quick_wins:
        wins.append(
            {
                "title": f"{len(quick_wins)} quick-win queries",
                "detail": "Queries ranking in positions 4-10 with meaningful impressions.",
                "source": "google-data.search-console",
                "severity": "medium",
                "effort": "2-4 hrs",
                "value": len(quick_wins),
            }
        )

    opportunities = mobile_psi.get("opportunities", [])
    if isinstance(opportunities, list):
        for item in opportunities[:5]:
            if not isinstance(item, dict):
                continue
            savings = item.get("savings_ms")
            detail = "Performance opportunity identified by Lighthouse."
            if savings:
                detail = f"Estimated savings: ~{savings}ms."
            wins.append(
                {
                    "title": item.get("title", "Performance opportunity"),
                    "detail": detail,
                    "source": "google-data.performance",
                    "severity": "medium",
                    "effort": "Low to Medium",
                    "value": savings,
                }
            )

    for bucket in action_priorities:
        if bucket.get("priority") != "high":
            continue
        for item in bucket.get("items", [])[:5]:
            wins.append(
                {
                    "title": item,
                    "detail": "Imported from the audit action plan.",
                    "source": "action-plan",
                    "severity": "high",
                }
            )

    return wins[:8]


def build_payload(
    domain: str,
    url: Optional[str],
    google_data: Dict[str, Any],
    audit_markdown: str,
    action_plan_markdown: str,
) -> Dict[str, Any]:
    mobile = _mobile_psi(google_data)
    crux = google_data.get("crux", {}) if isinstance(google_data.get("crux"), dict) else {}
    gsc = google_data.get("gsc", {}) if isinstance(google_data.get("gsc"), dict) else {}
    inspection = google_data.get("inspection", {}) if isinstance(google_data.get("inspection"), dict) else {}

    audit_headings = _extract_headings(audit_markdown)
    action_headings = _extract_headings(action_plan_markdown)
    action_priorities = _extract_priority_buckets(action_plan_markdown)

    performance_section = {
        "available": bool(mobile or crux),
        "lighthouse_scores": mobile.get("lighthouse_scores", {}) if isinstance(mobile.get("lighthouse_scores"), dict) else {},
        "core_web_vitals": _normalize_cwv_metrics(crux),
        "opportunities": mobile.get("opportunities", [])[:20] if isinstance(mobile.get("opportunities"), list) else [],
        "failed_audits": mobile.get("failed_audits", [])[:20] if isinstance(mobile.get("failed_audits"), list) else [],
        "history": google_data.get("crux_history", {}) if isinstance(google_data.get("crux_history"), dict) else {},
    }
    search_console_section = _normalize_search_console(gsc)
    indexation_section = _normalize_indexation(inspection)

    critical_issues = _collect_critical_issues(mobile, indexation_section, action_priorities)
    quick_wins = _collect_quick_wins(mobile, search_console_section, action_priorities)

    report_id = f"audit_{_slugify(domain)}_{uuid.uuid4().hex[:8]}"

    return {
        "schema_version": "hosted-audit-report/v1",
        "report_type": "full_audit",
        "report_id": report_id,
        "generated_at": _now_iso(),
        "target": {
          "domain": domain,
          "url": url,
        },
        "source": {
            "generator": "claude-seo",
            "artifacts_present": [
                name
                for name, present in (
                    ("google-data", bool(google_data)),
                    ("full-audit-report", bool(audit_markdown.strip())),
                    ("action-plan", bool(action_plan_markdown.strip())),
                )
                if present
            ],
        },
        "overview": {
            "health_score": _extract_health_score(audit_markdown),
            "lighthouse_performance_score": performance_section["lighthouse_scores"].get("performance"),
            "lighthouse_seo_score": performance_section["lighthouse_scores"].get("seo"),
            "total_clicks": search_console_section["totals"].get("clicks"),
            "total_impressions": search_console_section["totals"].get("impressions"),
            "indexed_urls": indexation_section["summary"].get("pass"),
            "inspected_urls": indexation_section.get("total"),
            "critical_issue_count": len(critical_issues),
            "quick_win_count": len(quick_wins),
        },
        "highlights": {
            "critical_issues": critical_issues,
            "quick_wins": quick_wins,
        },
        "sections": {
            "performance": performance_section,
            "search_console": search_console_section,
            "indexation": indexation_section,
            "audit_report": {
                "available": bool(audit_markdown.strip()),
                "markdown": audit_markdown,
                "headings": audit_headings,
            },
            "action_plan": {
                "available": bool(action_plan_markdown.strip()),
                "markdown": action_plan_markdown,
                "headings": action_headings,
                "priorities": action_priorities,
            },
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export Claude SEO artifacts to the hosted report schema."
    )
    parser.add_argument("--domain", required=True, help="Domain name for the report.")
    parser.add_argument("--url", help="Canonical site URL.")
    parser.add_argument("--google-data", help="Path to structured Google report JSON.")
    parser.add_argument("--audit-report", help="Path to FULL-AUDIT-REPORT.md.")
    parser.add_argument("--action-plan", help="Path to ACTION-PLAN.md.")
    parser.add_argument("--output", "-o", required=True, help="Output JSON path.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print output JSON.")
    args = parser.parse_args()

    payload = build_payload(
        domain=args.domain,
        url=args.url,
        google_data=_read_json(args.google_data),
        audit_markdown=_read_text(args.audit_report),
        action_plan_markdown=_read_text(args.action_plan),
    )

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, indent=2 if args.pretty else None) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
