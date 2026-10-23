# P1llar AI build status

## Committed so far
- Responsive marketing landing page and FAQ.
- Illustrative customer-support chat preview (not connected to an AI provider).
- Next.js App Router layout, TypeScript configuration, package manifest and app icon.
- Basic health endpoint at `/api/health`.
- Initial Supabase multi-tenant database schema with row-level security policies.
- Environment-variable example with placeholders only.

## Not implemented yet
- Sign-up, sign-in, password reset and authenticated dashboard.
- Business onboarding form and real workspace creation.
- Secure knowledge-source editing and document upload/processing.
- AI model integration, retrieval, citations/grounding and safe uncertainty behavior.
- Public hosted support pages and real chat persistence.
- Rate limits, abuse protection, subscription billing, tests and production deployment.

## Important security notes
- Review the SQL in a test Supabase project before applying it to a production database.
- Keep service-role keys and model API keys on the server only.
- Public visitor chat must go through a validated server endpoint; do not grant anonymous direct table access to conversations or messages.
- Tenant isolation and all row-level security policies must be tested with separate accounts before launch.
