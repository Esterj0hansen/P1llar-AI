# P1llar AI

P1llar AI is an AI-powered customer support platform designed to help businesses answer customer questions using their own business information.

## Current build

This repository currently contains:
- A responsive marketing landing page.
- An interactive, illustrative chat preview.
- Product positioning, feature explanations, early-access section, and FAQ.
- A Next.js App Router project structure.

**Important:** The chat preview is currently illustrative. It does not call an AI model, store customer data, or use a real business knowledge base yet. Do not present it as a live AI support service until the backend is implemented and tested.

## Planned product

1. Secure authentication and separate business workspaces.
2. Business profile and knowledge-source management.
3. Import of FAQs, website content, and business documents.
4. Retrieval-grounded answers with an honest fallback when information is missing.
5. A shareable support page for each business.
6. Usage tracking, plan limits, and subscription billing.
7. Security, privacy, and deployment checks.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Configuration and security

No API keys are required for the landing page. Never commit secrets to Git. Backend credentials should be added through local environment variables and the deployment provider's secret settings when integrations are implemented.
