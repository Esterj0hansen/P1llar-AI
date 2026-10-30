# P1llar AI build and launch status

Last reviewed: 30 October 2026

## Implemented in the current repository
- Responsive marketing site and FAQ.
- Supabase email/password sign-up and sign-in.
- Authenticated business workspaces with owner-scoped access.
- Business knowledge management: manual entries and same-origin public website crawling.
- Website crawler batches five pages per request, checks a sitemap, prioritizes pricing/product/FAQ pages, extracts readable text and supported JSON-LD listing data, and resumes through client-managed queue state.
- Public hosted support pages at `/support/[slug]`.
- Server-side support API that loads a business knowledge base, ranks relevant entries, optionally reads visitor-supplied public product URLs, and calls OpenRouter.
- Support conversations and messages persisted through the server-side service-role client.
- Conversation dashboard and health endpoint.

## Required Vercel environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose to the browser)
- `OPENROUTER_API_KEY` (server only)
- Optional: `NEXT_PUBLIC_SITE_URL`

The repository's `.env.example` uses the same OpenRouter variable name as the support route.

## Remaining launch work / limitations
- Confirm all environment variables are set in the production Vercel project and run end-to-end tests with a real Supabase user and business.
- Add automated unit/integration tests and a repeatable production build check.
- Add rate limiting, bot/abuse protection, usage metering, plan enforcement and subscription billing before opening public access.
- Add file/document upload and processing; the current knowledge screen supports manual entries and website imports.
- Add human handoff, conversation replies/resolution controls, and a copy-paste embeddable widget.
- Improve crawler coverage for JavaScript-rendered sites, external product platforms and nested sitemap indexes. The crawler only follows same-origin HTML pages and its queue/state are bounded.
- Review privacy, retention, tenant isolation and operational monitoring before production launch.

## Security notes
- Keep service-role and OpenRouter keys on the server only.
- The public support endpoint is unauthenticated by design; protect it with rate limits and abuse controls before promotion.
- Website and visitor-supplied page content is untrusted input. The AI must not follow instructions contained in fetched pages.
- Do not claim that a website scan guarantees every page or every product was imported.
