# EventraHQ — Event Operations Cloud

EventraHQ is a professional full-stack event management SaaS project built for portfolio, interview, and ATS impact. It uses React, CSS, HTML, Node.js, Express, Supabase PostgreSQL, JWT authentication, RBAC, admin analytics, and optional Gemini/OpenAI-powered event strategy generation.

## Why this project is stronger than a basic CRUD app

This is not a plain event listing website. It includes production-facing patterns:

- Supabase PostgreSQL database with normalized tables
- JWT authentication with protected routes
- Role-based access control: user, organizer, admin
- Event marketplace with search and filtering
- Event creation workflow for organizers/admins
- Registration and check-in tracking
- Admin analytics dashboard
- Audit logging
- API rate limiting, Helmet security headers, CORS control, compression
- Optional Gemini/OpenAI AI event brief generation
- Responsive 2026-style glass/gradient UI built with custom CSS
- ATS-ready documentation and resume bullets

## Tech stack

### Frontend

- React
- Vite
- JavaScript
- HTML
- CSS
- React Router
- Recharts
- Lucide Icons

### Backend

- Node.js
- Express.js
- Supabase PostgreSQL
- JWT
- bcryptjs
- Helmet
- CORS
- Express Rate Limit
- Gemini API optional
- OpenAI API optional

## Folder structure

```txt
EventraHQ/
  backend/
    supabase/schema.sql
    src/
      config/
      data/
      middleware/
      routes/
      scripts/
      server.js
  frontend/
    src/
      api/
      components/
      context/
      pages/
      styles.css
  docs/
    ATS_RESUME_BULLETS.md
    ARCHITECTURE.md
  .env.example
  README.md
```

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Create Supabase database tables

Open your Supabase project.

Go to:

```txt
Supabase Dashboard -> SQL Editor -> New Query
```

Paste and run:

```txt
backend/supabase/schema.sql
```

### 3. Configure backend environment

Create:

```txt
backend/.env
```

Use this format:

```env
PORT=5050
NODE_ENV=development
JWT_SECRET=make_this_long_random_and_private
CLIENT_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=120

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

GEMINI_API_KEY=your_gemini_key_optional
OPENAI_API_KEY=your_openai_key_optional
```

Important: `SUPABASE_SERVICE_ROLE_KEY` must stay only in `backend/.env`. Never put it in frontend `.env`.

### 4. Configure frontend environment

Create:

```txt
frontend/.env
```

Use:

```env
VITE_API_URL=http://localhost:5050/api
```

### 5. Seed demo data

```bash
npm run seed --prefix backend
```

Demo accounts:

```txt
admin@eventrahq.com / Admin@12345
organizer@eventrahq.com / Organizer@12345
user@eventrahq.com / User@12345
```

### 6. Run app

```bash
npm run dev
```

Frontend:

```txt
http://localhost:5173
```

Backend:

```txt
http://localhost:5050/api/health
```

## API routes

### Auth

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Events

```txt
GET   /api/events
GET   /api/events/:id
POST  /api/events
PATCH /api/events/:id
POST  /api/events/:id/register
POST  /api/events/:id/checkin
```

### Dashboard

```txt
GET /api/dashboard
GET /api/admin/stats
```

### AI

```txt
POST /api/ai/event-brief
```

Gemini is used first if `GEMINI_API_KEY` exists. OpenAI is fallback if `OPENAI_API_KEY` exists. If neither exists, the app uses a deterministic fallback so the UI still works.

## Security notes

This project includes:

- Password hashing with bcryptjs
- JWT-based auth
- Backend-only service-role Supabase key
- Role-based route protection
- Rate limiting
- Helmet HTTP security headers
- CORS origin restriction
- Server-side permission checks
- Audit logs for important actions

## Production upgrade path

For real production traffic, add:

- Supabase Auth or dedicated auth provider
- Refresh tokens and token rotation
- Edge cache/CDN
- Queue worker for heavy AI jobs
- Email verification
- Payment integration
- Object storage for event media
- Monitoring: Sentry, OpenTelemetry, uptime checks
- Unit/integration/E2E tests in CI
- Dockerfile and deployment pipeline

## Portfolio positioning

Use this project as:

```txt
EventraHQ — Full-Stack Event Operations SaaS
```

Do not pitch it as a college mini-project. Pitch it as a SaaS-style platform with real database design, secure backend APIs, admin analytics, AI-assisted planning, and role-based access control.
