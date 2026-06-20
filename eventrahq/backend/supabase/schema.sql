-- EventraHQ Supabase schema
-- Run this in Supabase SQL Editor before starting the backend.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id text primary key,
  name text not null,
  email text unique not null,
  role text not null check (role in ('user', 'organizer', 'admin')) default 'user',
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  title text not null,
  slug text unique not null,
  category text not null,
  status text not null check (status in ('draft', 'published')) default 'published',
  location text not null,
  city text not null,
  event_date date not null,
  event_time time not null,
  capacity integer not null check (capacity > 0),
  price numeric(10,2) not null default 0,
  cover text not null default 'aurora',
  organizer_id text not null references public.app_users(id) on delete cascade,
  description text not null,
  tags text[] not null default '{}',
  agenda text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.app_users(id) on delete cascade,
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  unique(event_id, user_id)
);

create table if not exists public.audit_logs (
  id text primary key,
  actor_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_status_date on public.events(status, event_date);
create index if not exists idx_events_category on public.events(category);
create index if not exists idx_events_city on public.events(city);
create index if not exists idx_registrations_event_id on public.registrations(event_id);
create index if not exists idx_registrations_user_id on public.registrations(user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- RLS is enabled for safety. Backend uses the service-role key, which bypasses RLS.
alter table public.app_users enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.audit_logs enable row level security;
