# P1llar AI

P1llar AI gives businesses a hosted AI customer-support assistant grounded in their own business information.

## Implemented
- Supabase email/password authentication and isolated business workspaces.
- Manual knowledge entries and resumable public website imports.
- Private file upload endpoint and dashboard controls. TXT, Markdown and CSV are indexed; PDF and DOCX are stored privately but still require a text-extraction worker before they can be searched.
- Hosted public support pages and a copy-paste embeddable chat widget.
- OpenRouter-powered answers with business knowledge retrieval.
- Conversation inbox with human-handoff flags, staff replies and resolve controls.
- Server-side support rate limiting and usage-event records.
- Paystack subscription checkout and signed webhook processing.
- Health/configuration endpoint, automated smoke-contract tests, TypeScript check and production-build CI workflow.

## Stack
Next.js App Router, React, TypeScript, Supabase Auth/Postgres/Storage, OpenRouter, Paystack and Vercel.

## Local development
Requires Node.js 20.9 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Run checks with:

```bash
npm test
npm run typecheck
npm run build
```

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `OPENROUTER_API_KEY` (server only)
- `NEXT_PUBLIC_SITE_URL`
- `PAYSTACK_SECRET_KEY` (server only)
- `PAYSTACK_PLAN_STARTER`, `PAYSTACK_PLAN_GROWTH`, `PAYSTACK_PLAN_BUSINESS` (Paystack plan codes)

Configure the Paystack webhook URL as `https://YOUR_DOMAIN/api/billing/webhook`. Paystack signs webhook requests; the route verifies `x-paystack-signature` using the secret key.

## Supabase setup
Apply `supabase/schema.sql` only to a new project. For an existing installation, apply `supabase/launch-features.sql` in the Supabase SQL Editor to add rate limiting, usage events, subscription records, handoff fields and the private storage bucket. Review the SQL and existing schema before applying; do not blindly rerun a different migration against production.

## Embed the widget
Add this to the business website, replacing the slug with the business support slug and the domain with the deployed P1llar AI domain:

```html
<script src="https://YOUR_DOMAIN/p1llar-widget.js" data-business="YOUR_BUSINESS_SLUG" defer></script>
```

## Before public launch
- Set Supabase, OpenRouter and Paystack credentials in Vercel.
- Create the three recurring plans in Paystack and copy their plan codes to the matching environment variables.
- Configure the Paystack webhook URL.
- Apply the Supabase launch migration.
- Confirm PDF/DOCX extraction is added before describing those formats as searchable.
- Run the GitHub Actions checks and complete a real sign-up, website import, support conversation, file upload, rate-limit and Paystack test transaction.
- Add CAPTCHA/bot controls, retention controls, monitoring and a PDF/DOCX extraction worker before scaling.

See [docs/BUILD_STATUS.md](docs/BUILD_STATUS.md) for the launch checklist.
