drop policy if exists jobs_owner_insert on public.jobs;
revoke update on table public.profiles from authenticated;
grant update(name,avatar_url) on table public.profiles to authenticated;

revoke all on function public.organization_analytics(uuid) from public,anon,authenticated;
grant execute on function public.organization_analytics(uuid) to service_role;
revoke all on function public.accept_organization_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.accept_organization_invitation(uuid,uuid) to service_role;
revoke all on function public.create_organization(text,text,text) from public,anon;
grant execute on function public.create_organization(text,text,text) to authenticated;
revoke all on function public.is_org_member(uuid,uuid) from public,anon;
revoke all on function public.has_org_role(uuid,public.membership_role[],uuid) from public,anon;
grant execute on function public.is_org_member(uuid,uuid) to authenticated,service_role;
grant execute on function public.has_org_role(uuid,public.membership_role[],uuid) to authenticated,service_role;
