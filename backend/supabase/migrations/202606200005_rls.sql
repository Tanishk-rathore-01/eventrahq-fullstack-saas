alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.jobs enable row level security;
alter table public.ai_briefs enable row level security;
-- Policies
create policy profiles_read_self on public.profiles for select to authenticated using (id=auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy organizations_read_members on public.organizations for select to authenticated using (public.is_org_member(id));
create policy memberships_read_organization on public.organization_memberships for select to authenticated
  using (user_id=auth.uid() or public.is_org_member(organization_id));
create policy events_public_read on public.events for select using (status='published' or public.is_org_member(organization_id));
create policy events_member_insert on public.events for insert to authenticated
  with check (public.has_org_role(organization_id,array['owner','manager']::public.membership_role[]) and created_by=auth.uid());
create policy events_member_update on public.events for update to authenticated
  using (public.has_org_role(organization_id,array['owner','manager']::public.membership_role[]))
  with check (public.has_org_role(organization_id,array['owner','manager']::public.membership_role[]));
create policy registrations_read on public.registrations for select to authenticated
  using (user_id=auth.uid() or exists(select 1 from public.events e where e.id=event_id and public.is_org_member(e.organization_id)));
create policy payments_owner_read on public.payments for select to authenticated
  using (exists(select 1 from public.registrations r where r.id=registration_id and r.user_id=auth.uid()));
create policy jobs_owner_read on public.jobs for select to authenticated using (created_by=auth.uid());
create policy jobs_owner_insert on public.jobs for insert to authenticated with check (created_by=auth.uid());
create policy briefs_members_read on public.ai_briefs for select to authenticated
  using (exists(select 1 from public.events e where e.id=event_id and public.is_org_member(e.organization_id)));
create policy audit_members_read on public.audit_logs for select to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('event-covers','event-covers',true,5000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5000000,allowed_mime_types=excluded.allowed_mime_types;
create policy public_cover_read on storage.objects for select using (bucket_id='event-covers');
create policy organizer_cover_insert on storage.objects for insert to authenticated
  with check (bucket_id='event-covers' and public.has_org_role((storage.foldername(name))[1]::uuid,array['owner','manager']::public.membership_role[]));

revoke all on function public.claim_next_job() from public,anon,authenticated;
revoke all on function public.complete_job(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.fail_job(uuid,text) from public,anon,authenticated;
revoke all on function public.reserve_event_seat(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.confirm_payment(text,text,uuid) from public,anon,authenticated;
revoke all on function public.check_in_ticket(uuid,uuid) from public,anon,authenticated;
revoke all on function public.release_expired_registrations() from public,anon,authenticated;
grant execute on function public.claim_next_job() to service_role;
grant execute on function public.complete_job(uuid,jsonb) to service_role;
grant execute on function public.fail_job(uuid,text) to service_role;
grant execute on function public.reserve_event_seat(uuid,uuid,text) to service_role;
grant execute on function public.confirm_payment(text,text,uuid) to service_role;
grant execute on function public.check_in_ticket(uuid,uuid) to service_role;
grant execute on function public.release_expired_registrations() to service_role;
grant execute on function public.create_organization(text,text,text) to authenticated;
grant execute on function public.accept_organization_invitation(uuid,uuid) to service_role;
