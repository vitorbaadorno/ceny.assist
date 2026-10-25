-- Invitations never grant access until the intended verified account accepts.
create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null check(email = lower(trim(email)) and length(email) between 3 and 254 and email like '%@%'),
  role text not null check(role in ('admin','recruiter','viewer')),
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index invitations_company_idx on public.company_invitations(company_id);
create index invitations_email_idx on public.company_invitations(email);
create index invitations_inviter_idx on public.company_invitations(invited_by);
create unique index invitations_pending_idx on public.company_invitations(company_id,email) where accepted_at is null and revoked_at is null;
alter table public.company_invitations enable row level security;
revoke all on public.company_invitations from anon,authenticated;
grant select on public.company_invitations to authenticated;
grant all on public.company_invitations to service_role;
create policy invitation_admin_read on public.company_invitations for select to authenticated using(private.has_role(company_id,array['owner','admin']));

-- No client can read hashes or write the recovery/audit records directly.
create table private.company_recovery (
  company_id uuid primary key references public.companies(id) on delete cascade,
  email text not null,
  code_hash bytea not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table private.access_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor uuid,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);
create index access_events_company_idx on private.access_events(company_id,created_at);
alter table private.company_recovery enable row level security;
alter table private.access_events enable row level security;
revoke all on private.company_recovery,private.access_events from public,anon,authenticated;

create function private.verified_email() returns text language sql stable security definer set search_path='' as $$
  select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false)
$$;
create function private.require_recent_login() returns void language plpgsql stable security definer set search_path='' as $$
begin
  if private.verified_email() is null or not exists(
    select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m
    where m->>'method' in ('password','oauth','otp','totp')
      and (m->>'timestamp')::numeric >= extract(epoch from now() - interval '15 minutes')
  ) then raise exception 'Entre novamente na conta para realizar esta operação.' using errcode='42501'; end if;
end $$;

-- Replace the basic onboarding: name of responsible person is mandatory.
revoke execute on function public.create_company(text),private.create_company(text) from public,anon,authenticated;
create function private.create_company(p_name text,p_responsible text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if private.verified_email() is null then raise exception 'Confirme seu e-mail antes de cadastrar uma empresa.' using errcode='42501'; end if;
  if p_responsible is null or length(trim(p_responsible)) not between 2 and 160 then raise exception 'Informe o nome do responsável.'; end if;
  insert into public.companies(name) values(trim(p_name)) returning id into v_id;
  update public.profiles set full_name=trim(p_responsible) where id=auth.uid();
  insert into public.company_members(company_id,user_id,role) values(v_id,auth.uid(),'owner');
  insert into private.access_events(company_id,actor,action,target) values(v_id,auth.uid(),'company_created',auth.uid()::text);
  return v_id;
end $$;
create function public.create_company(p_name text,p_responsible text) returns uuid language sql security invoker set search_path='' as $$ select private.create_company(p_name,p_responsible) $$;

create function private.invite_member(p_company uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_email text := lower(trim(p_email));
begin
  perform 1 from public.companies where id=p_company for update;
  if private.verified_email() is null or not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão para convidar.' using errcode='42501'; end if;
  if p_role is null or p_role not in ('admin','recruiter','viewer') then raise exception 'Função inválida'; end if;
  if p_role='admin' and not private.has_role(p_company,array['owner']) then raise exception 'Somente o responsável convida administradores.' using errcode='42501'; end if;
  if v_email is null or length(v_email) not between 3 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido'; end if;
  if exists(select 1 from public.company_members m join auth.users u on u.id=m.user_id where m.company_id=p_company and lower(u.email)=v_email) then raise exception 'Esta pessoa já faz parte da equipe.'; end if;
  update public.company_invitations set revoked_at=now() where company_id=p_company and email=v_email and accepted_at is null and revoked_at is null;
  insert into public.company_invitations(company_id,email,role,invited_by) values(p_company,v_email,p_role,auth.uid()) returning id into v_id;
  insert into private.access_events(company_id,actor,action,target) values(p_company,auth.uid(),'invited',v_email);
  return v_id;
end $$;
create function public.invite_company_member(p_company uuid,p_email text,p_role text) returns uuid language sql security invoker set search_path='' as $$ select private.invite_member(p_company,p_email,p_role) $$;

create function private.my_invitations() returns table(id uuid,company_name text,role text,expires_at timestamptz) language sql stable security definer set search_path='' as $$
  select i.id,c.name,i.role,i.expires_at from public.company_invitations i join public.companies c on c.id=i.company_id
  join public.company_members m on m.company_id=i.company_id and m.user_id=i.invited_by
  where i.email=private.verified_email() and i.accepted_at is null and i.revoked_at is null and i.expires_at>now()
    and (m.role='owner' or (m.role='admin' and i.role<>'admin'))
$$;
create function public.my_company_invitations() returns table(id uuid,company_name text,role text,expires_at timestamptz) language sql security invoker set search_path='' as $$ select * from private.my_invitations() $$;

create function private.accept_invitation(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_company uuid; v_inv public.company_invitations;
begin
  select company_id into v_company from public.company_invitations where id=p_id;
  perform 1 from public.companies where id=v_company for update;
  select * into v_inv from public.company_invitations where id=p_id for update;
  if v_inv.id is null or v_inv.email is distinct from private.verified_email() or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at<=now()
    or not exists(select 1 from public.company_members where company_id=v_company and user_id=v_inv.invited_by and (role='owner' or (role='admin' and v_inv.role<>'admin')))
  then raise exception 'Convite inválido, expirado ou revogado.' using errcode='42501'; end if;
  if exists(select 1 from public.company_members where company_id=v_company and user_id=auth.uid()) then raise exception 'Você já faz parte desta empresa.'; end if;
  insert into public.company_members(company_id,user_id,role) values(v_company,auth.uid(),v_inv.role);
  update public.company_invitations set accepted_at=now() where id=p_id;
  insert into private.access_events(company_id,actor,action,target) values(v_company,auth.uid(),'invitation_accepted',p_id::text);
  return v_company;
end $$;
create function public.accept_company_invitation(p_id uuid) returns uuid language sql security invoker set search_path='' as $$ select private.accept_invitation(p_id) $$;

create function private.revoke_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_inv public.company_invitations;
begin
  select * into v_inv from public.company_invitations where id=p_id;
  perform 1 from public.companies where id=v_inv.company_id for update;
  if private.verified_email() is null or not private.has_role(v_inv.company_id,array['owner','admin']) or (v_inv.role='admin' and not private.has_role(v_inv.company_id,array['owner'])) then raise exception 'Acesso negado' using errcode='42501'; end if;
  update public.company_invitations set revoked_at=now() where id=p_id and accepted_at is null;
  insert into private.access_events(company_id,actor,action,target) values(v_inv.company_id,auth.uid(),'invitation_revoked',p_id::text);
end $$;
create function public.revoke_company_invitation(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.revoke_invitation(p_id) $$;

create or replace function private.manage_member(p_company uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor text; v_target text;
begin
  perform 1 from public.companies where id=p_company for update;
  select role into v_actor from public.company_members where company_id=p_company and user_id=auth.uid() for update;
  select role into v_target from public.company_members where company_id=p_company and user_id=p_user for update;
  if private.verified_email() is null or v_actor is null or v_actor not in ('owner','admin') or v_target is null then raise exception 'Acesso negado. Novos membros precisam aceitar um convite.' using errcode='42501'; end if;
  if p_user=auth.uid() or v_target='owner' or (v_actor='admin' and (v_target='admin' or p_role='admin')) then raise exception 'Alteração não permitida.' using errcode='42501'; end if;
  if p_role is not null and p_role not in ('admin','recruiter','viewer') then raise exception 'Função inválida'; end if;
  delete from private.company_recovery where company_id=p_company and email=(select lower(email) from auth.users where id=p_user);
  -- Pending grants issued by a removed/demoted member cannot restore access later.
  update public.company_invitations set revoked_at=now() where company_id=p_company and accepted_at is null and revoked_at is null
    and (invited_by=p_user or email=(select lower(email) from auth.users where id=p_user));
  if p_role is null then delete from public.company_members where company_id=p_company and user_id=p_user;
  else update public.company_members set role=p_role where company_id=p_company and user_id=p_user; end if;
  insert into private.access_events(company_id,actor,action,target) values(p_company,auth.uid(),case when p_role is null then 'member_removed' else 'role_changed:'||p_role end,p_user::text);
end $$;

-- Emergency access needs BOTH a 256-bit offline secret and a recently authenticated,
-- verified account for the custodian explicitly designated by the current owner.
create function private.configure_recovery(p_company uuid,p_email text) returns text language plpgsql security definer set search_path='' as $$
declare v_code text; v_email text := lower(trim(p_email));
begin
  perform private.require_recent_login();
  perform 1 from public.companies where id=p_company for update;
  if not private.has_role(p_company,array['owner']) then raise exception 'Somente o responsável configura a recuperação.' using errcode='42501'; end if;
  if v_email is null or length(v_email) not between 3 and 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido'; end if;
  v_code := encode(extensions.gen_random_bytes(32),'hex');
  insert into private.company_recovery(company_id,email,code_hash,expires_at) values(p_company,v_email,extensions.digest(v_code,'sha256'),now()+interval '365 days')
    on conflict(company_id) do update set email=excluded.email,code_hash=excluded.code_hash,expires_at=excluded.expires_at,created_at=now();
  insert into private.access_events(company_id,actor,action,target) values(p_company,auth.uid(),'recovery_configured',v_email);
  return p_company::text||'.'||v_code;
end $$;
create function public.configure_company_recovery(p_company uuid,p_email text) returns text language sql security invoker set search_path='' as $$ select private.configure_recovery(p_company,p_email) $$;
create function private.recover_company(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_company uuid; v_recovery private.company_recovery;
begin
  perform private.require_recent_login();
  if p_code is null or p_code !~ '^[0-9a-f-]{36}\.[0-9a-f]{64}$' then raise exception 'Código de recuperação inválido.' using errcode='42501'; end if;
  v_company := split_part(p_code,'.',1)::uuid;
  perform 1 from public.companies where id=v_company for update;
  select * into v_recovery from private.company_recovery where company_id=v_company for update;
  if v_recovery.company_id is null or v_recovery.email is distinct from private.verified_email() or v_recovery.expires_at<=now() or v_recovery.code_hash<>extensions.digest(split_part(p_code,'.',2),'sha256') then raise exception 'Código de recuperação inválido para esta conta.' using errcode='42501'; end if;
  -- The former responsible account loses access; the recovery operator reviews who to reinvite.
  delete from public.company_members where company_id=v_company and role='owner' and user_id<>auth.uid();
  insert into public.company_members(company_id,user_id,role) values(v_company,auth.uid(),'owner') on conflict(company_id,user_id) do update set role='owner';
  update public.company_invitations set revoked_at=now() where company_id=v_company and accepted_at is null and revoked_at is null;
  delete from private.company_recovery where company_id=v_company;
  insert into private.access_events(company_id,actor,action,target) values(v_company,auth.uid(),'company_recovered',auth.uid()::text);
  return v_company;
end $$;
create function public.recover_company_access(p_code text) returns uuid language sql security invoker set search_path='' as $$ select private.recover_company(p_code) $$;

revoke execute on function private.verified_email(),private.require_recent_login(),private.create_company(text,text),private.invite_member(uuid,text,text),private.my_invitations(),private.accept_invitation(uuid),private.revoke_invitation(uuid),private.configure_recovery(uuid,text),private.recover_company(text) from public,anon,authenticated;
grant execute on function private.create_company(text,text),private.invite_member(uuid,text,text),private.my_invitations(),private.accept_invitation(uuid),private.revoke_invitation(uuid),private.configure_recovery(uuid,text),private.recover_company(text) to authenticated;
revoke execute on function public.create_company(text,text),public.invite_company_member(uuid,text,text),public.my_company_invitations(),public.accept_company_invitation(uuid),public.revoke_company_invitation(uuid),public.configure_company_recovery(uuid,text),public.recover_company_access(text) from public,anon,authenticated;
grant execute on function public.create_company(text,text),public.invite_company_member(uuid,text,text),public.my_company_invitations(),public.accept_company_invitation(uuid),public.revoke_company_invitation(uuid),public.configure_company_recovery(uuid,text),public.recover_company_access(text) to authenticated;
