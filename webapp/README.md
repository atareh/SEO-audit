# Hosted Report App

This is a lightweight local web app for previewing Claude SEO hosted reports.

It includes:

- a private report viewer UI
- a mock upload session flow
- one-time claim links
- cookie-backed report sessions

## Run

```bash
cd /Users/atareh/Desktop/SEO-audit
python3 webapp/server.py
```

Open:

```text
http://127.0.0.1:8765
```

## Demo Flow

1. Click `Launch Demo Report`
2. The server seeds a report from `schema/hosted-audit-report.example.json`
3. The app redirects through `/claim?token=...`
4. The claim token is exchanged for an `HttpOnly` session cookie
5. The browser lands on `/reports/<report_id>`

## Why This Exists

The main repo can already generate audits and normalize them into `hosted-audit-report/v1`.

This app proves the delivery layer:

- structured report rendering
- claim-token handoff
- clean bookmarkable report URLs

## Notes

- The server is a local prototype, not production infrastructure.
- Production should add stronger persistence, schema validation, observability, and TLS.
