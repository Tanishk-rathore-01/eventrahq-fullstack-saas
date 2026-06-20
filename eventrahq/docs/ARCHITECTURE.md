# EventraHQ Architecture

## System overview

```txt
React Frontend
  ↓
Vite SPA
  ↓
Node.js + Express API
  ↓
Auth Middleware + RBAC
  ↓
Supabase PostgreSQL
  ↓
Events, Users, Registrations, Audit Logs

Optional:
Node.js API
  ↓
Gemini/OpenAI
  ↓
AI Event Strategy Brief
```

## Core modules

### 1. Authentication

- User registration
- User login
- Password hashing
- JWT session token
- Protected `/me` endpoint

### 2. Authorization

Roles:

```txt
user      -> reserve seats, view tickets
organizer -> create/manage own events, generate AI brief
admin     -> manage platform, view analytics, create/check-in events
```

### 3. Event marketplace

- Public event listing
- Search
- Category filter
- Event cards
- Seat availability

### 4. Organizer console

- Create event
- Set capacity, pricing, tags, agenda, category
- Generate AI strategy brief

### 5. Admin analytics

- User count
- Event count
- Registration count
- Revenue estimation
- Occupancy rate
- Check-in rate
- Category distribution chart
- Audit logs

## Database model

```txt
app_users
  id
  name
  email
  role
  password_hash
  created_at

 events
  id
  title
  slug
  category
  status
  location
  city
  event_date
  event_time
  capacity
  price
  cover
  organizer_id
  description
  tags
  agenda
  created_at

registrations
  id
  event_id
  user_id
  checked_in
  created_at
  checked_in_at

audit_logs
  id
  actor_id
  action
  payload
  created_at
```

## Scalability notes

Current architecture is portfolio-grade with a real hosted PostgreSQL backend. To handle very large traffic, upgrade with:

- Redis cache for event listing
- Background queue for AI generation
- CDN for frontend assets
- Read replicas for analytics-heavy queries
- Cursor pagination for event lists
- Database functions for atomic capacity reservation
- API observability and structured logs
- Webhooks for async event updates
