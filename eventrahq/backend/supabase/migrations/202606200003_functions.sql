create or replace function public.is_org_member(p_org uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_memberships where organization_id=p_org and user_id=p_user)
$$;

create or replace function public.has_org_role(p_org uuid, p_roles public.membership_role[], p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_memberships
    where organization_id=p_org and user_id=p_user and role=any(p_roles))
$$;

create or replace function public.create_organization(p_name text, p_slug text, p_description text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org public.organizations; v_slug text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_slug := p_slug;
  if exists(select 1 from public.organizations where slug=v_slug) then
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text,1,6);
  end if;
  insert into public.organizations(name,slug,description,created_by)
  values(p_name,v_slug,nullif(p_description,''),auth.uid()) returning * into v_org;
  insert into public.organization_memberships(organization_id,user_id,role)
  values(v_org.id,auth.uid(),'owner');
  insert into public.audit_logs(organization_id,actor_id,action,resource_type,resource_id)
  values(v_org.id,auth.uid(),'organization.created','organization',v_org.id);
  return jsonb_build_object('id',v_org.id,'name',v_org.name,'slug',v_org.slug,'description',v_org.description,'createdAt',v_org.created_at);
end $$;

create or replace function public.accept_organization_invitation(p_invitation_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_invite public.organization_invitations;
begin
  select * into v_invite from public.organization_invitations where id=p_invitation_id for update;
  if v_invite.id is null or v_invite.accepted_at is not null or v_invite.expires_at < now() then raise exception 'Invitation is invalid or expired'; end if;
  insert into public.organization_memberships(organization_id,user_id,role)
  values(v_invite.organization_id,p_user_id,v_invite.role)
  on conflict(organization_id,user_id) do update set role=excluded.role;
  update public.organization_invitations set accepted_at=now() where id=p_invitation_id;
  insert into public.audit_logs(organization_id,actor_id,action,resource_type,resource_id)
  values(v_invite.organization_id,p_user_id,'invitation.accepted','invitation',p_invitation_id);
  return v_invite.organization_id;
end $$;

create or replace function public.claim_next_job()
returns setof public.jobs language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.jobs
  where status='queued' and available_at<=now() and attempts<max_attempts
  order by created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.jobs set status='running',started_at=now(),attempts=attempts+1
  where id=v_id returning *;
end $$;

create or replace function public.complete_job(p_job_id uuid,p_result jsonb)
returns void language sql security definer set search_path = public as $$
  update public.jobs set status='succeeded',result=p_result,error=null,completed_at=now() where id=p_job_id
$$;

create or replace function public.fail_job(p_job_id uuid,p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare v_attempts int; v_max int;
begin
  select attempts,max_attempts into v_attempts,v_max from public.jobs where id=p_job_id for update;
  update public.jobs set
    status=case when v_attempts>=v_max then 'failed'::public.job_status else 'queued'::public.job_status end,
    error=p_error, available_at=now() + make_interval(secs => least(60,power(2,v_attempts)::int)), completed_at=case when v_attempts>=v_max then now() else null end
  where id=p_job_id;
end $$;
