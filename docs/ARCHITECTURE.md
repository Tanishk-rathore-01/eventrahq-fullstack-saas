# EventraHQ architecture

## Trust boundaries

- The browser holds a short-lived Supabase session and publishable key.
- Express verifies the session and loads the application profile plus memberships.
- User-scoped operations retain the caller JWT so PostgreSQL RLS independently enforces isolation.
- The service-role client is limited to webhooks, atomic RPCs, signed uploads, jobs, administration, and seeding.

## Consistency model

- `reserve_event_seat` locks the event before counting confirmed and unexpired pending registrations.
- Paid reservations hold capacity for 15 minutes.
- `confirm_payment` locks payment and registration rows, verifies checkout ownership, and supports webhook replay.
- `check_in_ticket` locks a confirmed registration and reports duplicate scans.
- Realtime is a presentation signal; PostgreSQL remains the source of truth.

## Background work

Jobs are stored before returning `202`. The worker claims rows using `FOR UPDATE SKIP LOCKED`, validates Gemini JSON with Zod, records model/latency/prompt version, and retries up to three times. Email dedupe keys prevent repeated delivery.

## Authorization

- Platform role: `user` or `admin`
- Organization roles: `owner`, `manager`, `checkin_staff`
- Attendees require no organization membership
- Owner/manager can manage events and AI briefs
- Check-in staff can read attendee lists and validate tickets
