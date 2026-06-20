do $$ begin
  create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.registration_status as enum ('pending', 'confirmed', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  slug text not null unique,
  category text not null,
  status public.event_status not null default 'draft',
  venue text not null,
  city text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  capacity integer not null check (capacity > 0),
  price_paise integer not null default 0 check (price_paise >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  description text not null,
  tags text[] not null default '{}',
  agenda text[] not null default '{}',
  cover_path text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.registration_status not null default 'pending',
  ticket_token_hash text not null,
  expires_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  provider_order_id text not null unique,
  provider_payment_id text unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  status text not null check (status in ('created','captured','failed','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('ai_event_brief','send_email')),
  status public.job_status not null default 'queued',
  payload jsonb not null,
  result jsonb,
  error text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  dedupe_key text unique,
  created_by uuid references public.profiles(id),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_briefs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  model text not null,
  prompt_version text not null,
  latency_ms integer not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists registrations_updated_at on public.registrations;
create trigger registrations_updated_at before update on public.registrations for each row execute function public.set_updated_at();
drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

create index if not exists events_public_idx on public.events(status, starts_at);
create index if not exists events_org_idx on public.events(organization_id, starts_at);
create index if not exists registrations_event_idx on public.registrations(event_id, status);
create index if not exists registrations_user_idx on public.registrations(user_id, created_at desc);
create index if not exists jobs_claim_idx on public.jobs(status, available_at, created_at);
