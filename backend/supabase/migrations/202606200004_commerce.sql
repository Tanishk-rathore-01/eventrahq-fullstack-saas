create or replace function public.reserve_event_seat(p_event_id uuid,p_user_id uuid,p_ticket_hash text)
returns table(registration_id uuid,expires_at timestamptz) language plpgsql security definer set search_path = public as $$
declare v_event public.events; v_existing public.registrations; v_count int; v_status public.registration_status; v_expiry timestamptz;
begin
  select * into v_event from public.events where id=p_event_id and status='published' for update;
  if v_event.id is null then raise exception 'Published event not found'; end if;
  select * into v_existing from public.registrations where event_id=p_event_id and user_id=p_user_id for update;
  if v_existing.status='confirmed' then return query select v_existing.id,v_existing.expires_at; return; end if;
  select count(*) into v_count from public.registrations where event_id=p_event_id
    and (status='confirmed' or (status='pending' and expires_at>now()));
  if v_count>=v_event.capacity then raise exception 'Event capacity is full'; end if;
  v_status := case when v_event.price_paise=0 then 'confirmed'::public.registration_status else 'pending'::public.registration_status end;
  v_expiry := case when v_status='pending' then now()+interval '15 minutes' else null end;
  insert into public.registrations(event_id,user_id,status,ticket_token_hash,expires_at)
  values(p_event_id,p_user_id,v_status,p_ticket_hash,v_expiry)
  on conflict(event_id,user_id) do update set status=excluded.status,ticket_token_hash=excluded.ticket_token_hash,
    expires_at=excluded.expires_at,checked_in_at=null,checked_in_by=null
  returning id,public.registrations.expires_at into registration_id,expires_at;
  insert into public.audit_logs(organization_id,actor_id,action,resource_type,resource_id)
  values(v_event.organization_id,p_user_id,'registration.reserved','registration',registration_id);
  return next;
end $$;

create or replace function public.confirm_payment(p_order_id text,p_payment_id text,p_user_id uuid default null)
returns table(registration_id uuid,event_id uuid) language plpgsql security definer set search_path = public as $$
declare v_payment public.payments; v_registration public.registrations; v_event public.events;
begin
  select * into v_payment from public.payments where provider_order_id=p_order_id for update;
  if v_payment.id is null then raise exception 'Payment order not found'; end if;
  select * into v_registration from public.registrations where id=v_payment.registration_id for update;
  if p_user_id is not null and v_registration.user_id<>p_user_id then raise exception 'Payment does not belong to this user'; end if;
  select * into v_event from public.events where id=v_registration.event_id;
  update public.payments set status='captured',provider_payment_id=p_payment_id where id=v_payment.id;
  update public.registrations set status='confirmed',expires_at=null where id=v_registration.id;
  insert into public.audit_logs(organization_id,actor_id,action,resource_type,resource_id)
  values(v_event.organization_id,v_registration.user_id,'payment.captured','payment',v_payment.id);
  return query select v_registration.id,v_registration.event_id;
end $$;

create or replace function public.check_in_ticket(p_registration_id uuid,p_checked_in_by uuid)
returns table(registration_id uuid,checked_in_at timestamptz,already_checked_in boolean)
language plpgsql security definer set search_path = public as $$
declare v_registration public.registrations; v_was_checked boolean;
begin
  select * into v_registration from public.registrations where id=p_registration_id for update;
  if v_registration.id is null or v_registration.status<>'confirmed' then raise exception 'Confirmed ticket not found'; end if;
  v_was_checked := v_registration.checked_in_at is not null;
  if not v_was_checked then
    update public.registrations set checked_in_at=now(),checked_in_by=p_checked_in_by where id=p_registration_id
    returning public.registrations.checked_in_at into checked_in_at;
  else checked_in_at := v_registration.checked_in_at; end if;
  registration_id := p_registration_id; already_checked_in := v_was_checked; return next;
end $$;

create or replace function public.organization_analytics(p_organization_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with event_stats as (
    select e.id,e.capacity,e.price_paise,
      count(r.id) filter(where r.status='confirmed') registrations,
      count(r.id) filter(where r.checked_in_at is not null) checkins
    from public.events e left join public.registrations r on r.event_id=e.id
    where e.organization_id=p_organization_id group by e.id
  )
  select jsonb_build_object(
    'events',count(*),
    'capacity',coalesce(sum(capacity),0),
    'registrations',coalesce(sum(registrations),0),
    'checkIns',coalesce(sum(checkins),0),
    'grossRevenuePaise',coalesce(sum(registrations*price_paise),0)
  ) from event_stats
$$;

create or replace function public.release_expired_registrations()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.registrations set status='cancelled' where status='pending' and expires_at<now();
  get diagnostics v_count=row_count; return v_count;
end $$;
