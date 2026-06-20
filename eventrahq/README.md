# EventraHQ

EventraHQ is a multi-tenant event operations SaaS covering the complete workflow from organizer planning to verified attendee check-in. It uses real authentication, row-level data isolation, atomic inventory, test-mode payments, asynchronous jobs, auditable operations, strict TypeScript, automated tests, Docker, CI, and cloud deployment configuration.

## Product workflows

- Supabase email/password authentication, verification, recovery, and refreshable sessions
- Organization workspaces with owner, manager, check-in staff, attendee, and platform-admin authorization
- Public discovery, event creation, image uploads, and live registration totals
- Gemini structured event briefs processed by a persistent retryable worker
- Free registration and Razorpay Test Mode checkout with signature and webhook verification
- Resend ticket and invitation email jobs
- Signed QR wallet, camera/manual scanning, and idempotent check-in
- Organization analytics, platform health, audit activity, rate limits, and structured logs

## Architecture

```text
Vercel: React 19 + Vite + TypeScript
       | Supabase session JWT
       v
Render: Express 5 API + persistent job worker
       | user-scoped client              | service-role client
       v                                 v
Supabase Auth + PostgreSQL RLS + Storage + Realtime
       |                                 |
       +--> Gemini + Resend              +--> Razorpay Test Mode
```

The browser uses only the Supabase publishable key. Service-role, Gemini, Resend, Razorpay, webhook, and ticket-signing secrets stay in the backend environment.

## Repository

```text
backend/                 Express API, worker, tests, migrations
frontend/                React application and Playwright smoke test
packages/contracts/      Shared Zod schemas and TypeScript contracts
.github/workflows/       CI, secret scan, tests, build, E2E
render.yaml              Render API deployment
vercel.json              Vercel frontend deployment
```

## Local setup

Requirements: Node.js 22+, npm 11+, a Supabase project, and provider test credentials.

1. Install the locked workspace with `npm ci`.
2. Apply every SQL file in `backend/supabase/migrations` in filename order using the Supabase SQL Editor.
3. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`.
4. Fill variables using your own Supabase, Gemini, Resend, and Razorpay Test Mode accounts. Never commit `.env`.
5. Add `http://localhost:5173/dashboard` and `http://localhost:5173/auth/reset` to Supabase Auth redirect URLs.

Optionally seed a complete demo workspace:

```powershell
$env:DEMO_PASSWORD='choose-a-unique-12-plus-character-password'
npm run seed
```

The seed creates non-production users at `admin@eventrahq.demo`, `organizer@eventrahq.demo`, `staff@eventrahq.demo`, and `attendee@eventrahq.demo`, plus free and paid events. The password is never stored in the repository.

Start the application with `npm run dev`.

- Frontend: `http://localhost:5173`
- API liveness: `http://localhost:5050/api/health/live`
- API readiness: `http://localhost:5050/api/health/ready`

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Backend tests cover shared validation, ticket tampering, Razorpay signatures, webhook signatures, liveness, and structured errors. Database concurrency and provider smoke tests require a configured Supabase/provider environment.

## Important API contracts

| Area | Routes |
| --- | --- |
| Identity | `GET /api/me` |
| Workspaces | `GET/POST /api/organizations`, invitations and members |
| Events | `GET/POST/PATCH /api/events`, organizer lists, signed uploads |
| AI | `POST /api/ai/event-brief` and `GET /api/ai/jobs/:id` |
| Checkout | `POST /api/events/:id/checkout` and `POST /api/payments/verify` |
| Webhooks | `POST /api/webhooks/razorpay` using the untouched raw body |
| Tickets | `GET /api/tickets` and `POST /api/tickets/check-ins` |

## Deployment

- Deploy the frontend to Vercel using `vercel.json`.
- Create the Render Blueprint from `render.yaml` and add backend secrets.
- Apply migrations before the first production API deployment.
- Set Vercel's public API/Supabase variables and the Vercel URL in Render's `APP_URL` and `CLIENT_ORIGINS`.
- Register `https://<render-api>/api/webhooks/razorpay` as the Razorpay Test Mode webhook.
- Add production redirect URLs to Supabase Auth.

Razorpay remains in Test Mode: no real settlement or organizer payout flow is implemented. Free-tier sleeping services may delay work; the database-backed queue preserves jobs across restarts.

## Portfolio résumé bullet

Built a multi-tenant event operations SaaS using React, TypeScript, Express, Supabase PostgreSQL/Auth/RLS/Storage/Realtime, Gemini, Razorpay, and Resend; implemented atomic ticket inventory, signed webhook processing, persistent jobs, role-based workspaces, QR check-in, CI, Docker, and cloud deployment configuration.
