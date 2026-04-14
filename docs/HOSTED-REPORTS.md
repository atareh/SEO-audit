# Hosted Reports

This document defines the first hosted-report layer for Claude SEO.

The product goal is simple:

1. An agent runs an audit.
2. The audit artifacts are normalized into one canonical JSON payload.
3. That payload is uploaded to your web app.
4. The user receives a private claim link and lands on a rich, bookmarkable report page.

## Current State

The repository already has two kinds of output:

- Structured Google data that feeds `scripts/google_report.py`
- Human-readable markdown outputs such as `FULL-AUDIT-REPORT.md` and `ACTION-PLAN.md`

What it does **not** have yet is a stable, canonical JSON contract for the full audit.

That is what `schema/hosted-audit-report.schema.json` establishes.

## Canonical Payload

Schema:

- [`schema/hosted-audit-report.schema.json`](../schema/hosted-audit-report.schema.json)
- [`schema/hosted-audit-report.example.json`](../schema/hosted-audit-report.example.json)

Key design choice:

- Normalize what is already structured today.
- Preserve raw markdown for everything else.

That lets a hosted UI ship quickly without waiting for every audit subagent to emit perfect JSON.

## Exporter

Use the exporter to produce a hosted-report payload from existing artifacts:

```bash
python scripts/export_hosted_report.py \
  --domain example.com \
  --url https://example.com \
  --google-data full-data.json \
  --audit-report FULL-AUDIT-REPORT.md \
  --action-plan ACTION-PLAN.md \
  --output hosted-audit.json \
  --pretty
```

Then publish it to the hosted app:

```bash
python scripts/publish_hosted_report.py \
  --input hosted-audit.json \
  --base-url https://www.myseoaudit.xyz
```

The script:

- Fully normalizes structured Google report data
- Preserves full audit markdown and action-plan markdown
- Extracts headings from markdown for section navigation
- Extracts priority buckets from the action plan when headings contain `critical`, `high`, `medium`, or `low`
- Produces summary cards and highlight arrays for the hosted UI

For a runnable local prototype of the hosted delivery layer, see:

- [`webapp/README.md`](../webapp/README.md)

## Recommended Web UI Model

Suggested page structure:

1. Hero summary
2. Score cards
3. Critical issues
4. Quick wins
5. Performance section
6. Search Console section
7. Indexation section
8. Full audit markdown
9. Action plan markdown

This is why the schema includes both:

- normalized summary fields for charts/cards
- raw markdown for fidelity and forward compatibility

## Security Model

Do **not** hand agents a long-lived API key with broad write access.

Assume this rule:

- If an agent can read a secret, that secret can be exfiltrated.

Use short-lived, scoped upload capabilities instead.

### Recommended Flow

1. Your backend creates an audit upload session.
2. The backend returns:
   - `report_id`
   - a short-lived upload token or signed upload URL
   - `expires_at`
3. The agent uploads exactly one hosted-report payload.
4. The backend validates and stores the payload.
5. The backend returns a one-time claim link.
6. The first browser visit exchanges the claim token for an `HttpOnly` session cookie and redirects to a clean URL.

### Why This Is Better Than a Bearer Token in the Final URL

- Viewer URLs are safer to bookmark
- Shared screenshots leak less
- You can revoke or expire claim tokens separately from viewer sessions
- Upload permissions stay separate from view permissions

### Token Rules

Upload token:

- TTL: 10-15 minutes
- Scope: one `report_id`
- Method restricted: upload only
- Single-use preferred

Claim token:

- TTL: short
- Single-use
- Exchange for session cookie on first visit

Viewer session:

- `HttpOnly`
- `Secure`
- server-managed expiry

## Backend Validation Rules

The ingest endpoint should reject payloads that fail any of these checks:

- invalid schema version
- malformed JSON
- payload too large
- too many rows in large arrays
- unsupported domain/url format
- unexpected HTML in fields intended to be plain text
- expired upload token
- token/report mismatch

Also sanitize markdown before rendering.

Do not trust agent-produced HTML.

## Suggested API Shape

### 1. Create Upload Session

`POST /api/report-uploads`

Request:

```json
{
  "domain": "example.com",
  "report_type": "full_audit"
}
```

Response:

```json
{
  "report_id": "audit_example_com_ab12cd34",
  "upload_url": "https://api.example.com/api/report-uploads/audit_example_com_ab12cd34/content",
  "upload_token": "short-lived-token",
  "expires_at": "2026-04-14T19:00:00Z"
}
```

### 2. Upload Report Payload

`PUT /api/report-content?reportId=<report_id>`

Headers:

- `Authorization: Bearer <upload_token>`
- `Content-Type: application/json`

Body:

- `hosted-audit-report/v1` payload

Response:

```json
{
  "report_id": "audit_example_com_ab12cd34",
  "claim_url": "https://www.myseoaudit.xyz/claim?token=one-time-token",
  "report_url": "https://www.myseoaudit.xyz/reports/audit_example_com_ab12cd34"
}
```

## Suggested Frontend Rendering Priorities

Build the UI in this order:

1. Overview cards
2. Critical issues and quick wins
3. Lighthouse and CWV visuals
4. Search Console charts
5. Indexation summary
6. Markdown sections

That gives you a strong V1 even before the entire audit pipeline is fully normalized.

## Next Step After A Real Audit Run

Once you have a real `FULL-AUDIT-REPORT.md` and `ACTION-PLAN.md`, refine the exporter to:

- identify structured issue blocks more reliably
- capture severity and effort directly
- emit section-specific recommendation arrays
- reduce reliance on raw markdown in the hosted UI
