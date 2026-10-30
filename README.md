# P1llar AI

P1llar AI helps businesses create a hosted AI customer-support assistant grounded in their own business information.

## Current capabilities
- Supabase email/password authentication and separate business workspaces.
- Manual business knowledge entries.
- Public website import in resumable batches, with sitemap discovery and prioritization for pricing, product, FAQ and policy pages.
- A hosted customer support page for each business.
- Server-side AI answers through OpenRouter using the business knowledge base.
- Optional live reading of public product URLs included by a visitor, with explicit failure handling rather than invented prices.
- Saved customer conversations and messages.

## Stack
- Next.js App Router, React and TypeScript.
- Supabase Auth and Postgres with row-level security.
- OpenRouter for model inference.
- Vercel deployment.

## Run locally
Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Environment
Set these values in `.env.local` and in the production deployment:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (or use the publishable key below) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional newer Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access; never expose to the browser |
| `OPENROUTER_API_KEY` | Server-only AI provider key |
| `NEXT_PUBLIC_SITE_URL` | Optional canonical site URL |

Apply the SQL in `supabase/schema.sql` to the intended Supabase project and review the RLS policies before production use. If the project has already been configured, do not re-run schema changes blindly.

## Important limitations before public launch
Website import reads same-origin public HTML pages; JavaScript-rendered sites, external catalogue platforms and some protected pages may not be readable. The crawler is bounded and does not guarantee complete catalogue coverage. File uploads, rate limiting, usage metering, paid subscriptions, human handoff, an embeddable widget and automated end-to-end tests remain future work.

See [docs/BUILD_STATUS.md](docs/BUILD_STATUS.md) for the current launch checklist.
