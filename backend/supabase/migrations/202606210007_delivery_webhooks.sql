alter table public.jobs drop constraint if exists jobs_type_check;
alter table public.jobs add constraint jobs_type_check
  check (type in ('ai_event_brief','send_email','event_cancellation'));

alter table public.webhook_events add column if not exists processed_at timestamptz;
alter table public.webhook_events add column if not exists error text;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('created','captured','failed','refunded','requires_action'));

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  recipient text not null,
  template text not null,
  provider text not null default 'resend' check (provider = 'resend'),
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists email_deliveries_updated_at on public.email_deliveries;
create trigger email_deliveries_updated_at before update on public.email_deliveries
  for each row execute function public.set_updated_at();
create index if not exists email_deliveries_status_idx on public.email_deliveries(status,created_at);

alter table public.email_deliveries enable row level security;
revoke all on table public.email_deliveries from public,anon,authenticated;
grant all on table public.email_deliveries to service_role;

create or replace function public.audit_event_and_queue_cancellation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor uuid;
begin
  v_actor := coalesce(auth.uid(),new.created_by);
  insert into public.audit_logs(organization_id,actor_id,action,resource_type,resource_id,metadata)
  values(
    new.organization_id,
    v_actor,
    case when tg_op='INSERT' then 'event.created' else 'event.updated' end,
    'event',
    new.id,
    case when tg_op='UPDATE' then jsonb_build_object('previousStatus',old.status,'status',new.status) else '{}'::jsonb end
  );
  if tg_op='UPDATE' and new.status='cancelled' and old.status<>'cancelled' then
    insert into public.jobs(type,payload,created_by,dedupe_key)
    values('event_cancellation',jsonb_build_object('eventId',new.id),v_actor,'event-cancellation:' || new.id::text)
    on conflict(dedupe_key) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists events_audit_and_cancellation on public.events;
create trigger events_audit_and_cancellation after insert or update on public.events
  for each row execute function public.audit_event_and_queue_cancellation();

create or replace function public.confirm_payment(p_order_id text,p_payment_id text,p_user_id uuid default null)
returns table(registration_id uuid,event_id uuid) language plpgsql security definer set search_path = public as $$
declare v_payment public.payments; v_registration public.registrations; v_event public.events;
begin
  select * into v_payment from public.payments where provider_order_id=p_order_id for update;
  if v_payment.id is null then raise exception 'Payment order not found'; end if;
  select * into v_registration from public.registrations where id=v_payment.registration_id for update;
  if p_user_id is not null and v_registration.user_id<>p_user_id then raise exception 'Payment does not belong to this user'; end if;
  select * into v_event from public.events where id=v_registration.event_id for update;
  if v_payment.status='captured' then
    if v_payment.provider_payment_id<>p_payment_id then raise exception 'Payment order was captured by a different payment'; end if;
    return query select v_registration.id,v_registration.event_id;
    return;
  end if;
  if v_registration.status<>'pending' or v_registration.expires_at is null or v_registration.expires_at<=now() then
    raise exception 'Reservation expired before payment confirmation';
  end if;
  update public.payments set status='captured',provider_payment_id=p_payment_id where id=v_payment.id;
  update public.registrations set status='confirmed',expires_at=null where id=v_registration.id;
  insert into public.audit_logs(organization_id,actor_id,action,resource_type,resource_id)
  values(v_event.organization_id,v_registration.user_id,'payment.captured','payment',v_payment.id);
  return query select v_registration.id,v_registration.event_id;
end $$;

revoke all on function public.audit_event_and_queue_cancellation() from public,anon,authenticated;
revoke all on function public.confirm_payment(text,text,uuid) from public,anon,authenticated;
grant execute on function public.confirm_payment(text,text,uuid) to service_role;
