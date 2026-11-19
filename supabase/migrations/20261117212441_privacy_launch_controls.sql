-- Forward-only. No production execution is authorized by this file.
-- Deny direct reads/signing even when an older permissive SELECT policy exists.
create policy resumes_backend_only on storage.objects as restrictive for select to authenticated
using (bucket_id <> 'resumes');

create function private.record_document_access(p_company uuid,p_candidate uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 1729));
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company) or not exists(select 1 from public.candidates where id=p_candidate and company_id=p_company and not excluido) then
  raise exception 'Acesso indisponível' using errcode='42501';
 end if;
 if (select count(*) from private.access_events where actor=auth.uid() and action='document_access' and created_at>now()-interval '1 minute')>=60 then return false; end if;
 insert into private.access_events(company_id,actor,action,target) values(p_company,auth.uid(),'document_access',p_candidate::text);
 return true;
end $$;

-- Bootstrap invitations are operator-managed; never exposed through the Data API.
create table private.pilot_registrations (
 email text primary key check(email=lower(btrim(email))),
 approval_reference text not null check(length(btrim(approval_reference)) between 5 and 200),
 expires_at timestamptz not null,
 revoked_at timestamptz
);
alter table private.pilot_registrations enable row level security;
revoke all on private.pilot_registrations from public,anon,authenticated;
create function private.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(btrim(event->'user'->>'email'));
begin
 if v_email is not null and (
  exists(select 1 from private.pilot_registrations where email=v_email and revoked_at is null and expires_at>now()) or
  exists(select 1 from public.company_invitations i join public.company_members m on m.company_id=i.company_id and m.user_id=i.invited_by
   where i.email=v_email and i.accepted_at is null and i.revoked_at is null and i.expires_at>now()
    and m.role in ('owner','admin') and (i.role<>'admin' or m.role='owner'))
 ) then return '{}'::jsonb; end if;
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Cadastro indisponível. Confira seu convite com o responsável.'));
end $$;
revoke all on function private.before_user_created(jsonb) from public,anon,authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;

alter table public.privacy_requests drop constraint privacy_requests_kind_check;
alter table public.privacy_requests add constraint privacy_requests_kind_check check(kind in
 ('confirmation','access','correction','anonymization','restriction','erasure','export','information','objection','review','closure','inactivity'));
alter table public.privacy_requests add column controller_reference text,
 add column forwarded_at timestamptz;
create function private.forward_privacy_request(p_company uuid,p_request uuid,p_version integer,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.privacy_requests;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão' using errcode='42501'; end if;
 select * into r from public.privacy_requests where company_id=p_company and id=p_request for update;
 if not found or r.version is distinct from p_version then raise exception 'Pedido alterado. Recarregue.' using errcode='40001'; end if;
 if r.state<>'verified' or coalesce(length(btrim(p_reference)),0) not between 5 and 200 then raise exception 'Verifique a identidade e a referência do controlador'; end if;
 update public.privacy_requests set controller_reference=btrim(p_reference),forwarded_at=now(),updated_at=now(),updated_by=auth.uid(),version=version+1 where id=r.id;
 insert into public.privacy_events(company_id,actor_id,action,subject_id) values(p_company,auth.uid(),'request_forwarded',r.id);
 return r.id;
end $$;
create function public.forward_privacy_request(p_company uuid,p_request uuid,p_version integer,p_reference text) returns uuid
language sql security invoker set search_path='' as $$ select private.forward_privacy_request(p_company,p_request,p_version,p_reference) $$;
revoke all on function private.forward_privacy_request(uuid,uuid,integer,text),public.forward_privacy_request(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function private.forward_privacy_request(uuid,uuid,integer,text),public.forward_privacy_request(uuid,uuid,integer,text) to authenticated;

-- An enrolled second factor cannot be bypassed with an AAL1 session.
create function private.session_requires_mfa() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
  and exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')
$$;
create function public.session_requires_mfa() returns boolean language sql stable security invoker set search_path='' as $$ select private.session_requires_mfa() $$;
revoke all on function private.session_requires_mfa(),public.session_requires_mfa() from public,anon,authenticated;
grant execute on function private.session_requires_mfa(),public.session_requires_mfa() to authenticated;
create or replace function private.has_role(p_company uuid,p_roles text[] default array['owner','admin','recruiter','viewer']) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not private.session_requires_mfa() and exists(
  select 1 from public.company_members m join auth.users u on u.id=m.user_id
  where m.company_id=p_company and m.user_id=auth.uid() and m.role=any(p_roles) and not coalesce(u.is_anonymous,false))
$$;
create or replace function private.verified_email() returns text language sql stable security definer set search_path='' as $$
 select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null
 and not coalesce(is_anonymous,false) and not private.session_requires_mfa()
$$;
create or replace function private.can_read_profile(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not private.session_requires_mfa() and (auth.uid()=p_user or exists(
 select 1 from public.company_members mine join public.company_members theirs using(company_id)
 where mine.user_id=auth.uid() and mine.role in ('owner','admin') and theirs.user_id=p_user))
$$;
create function public.record_document_access(p_company uuid,p_candidate uuid) returns boolean
language sql security invoker set search_path='' as $$ select private.record_document_access(p_company,p_candidate) $$;
revoke all on function private.record_document_access(uuid,uuid),public.record_document_access(uuid,uuid) from public,anon,authenticated;
grant execute on function private.record_document_access(uuid,uuid),public.record_document_access(uuid,uuid) to authenticated;

-- Serialize creation per account; removing membership must not reset this lifetime quota.
create table private.company_creation_registry (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table private.company_creation_registry enable row level security;
revoke all on private.company_creation_registry from public,anon,authenticated;
insert into private.company_creation_registry(user_id)
 select distinct user_id from public.company_members where role='owner'
 union select distinct actor from private.access_events where action='company_created' and actor in (select id from auth.users);
create or replace function private.create_company(p_name text,p_responsible text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if private.verified_email() is null then raise exception 'Confirme seu e-mail antes de cadastrar uma empresa.' using errcode='42501'; end if;
 if p_responsible is null or length(trim(p_responsible)) not between 2 and 160 then raise exception 'Informe o nome do responsável.'; end if;
 perform 1 from auth.users where id=auth.uid() for update;
 if exists(select 1 from private.company_creation_registry where user_id=auth.uid()) then raise exception 'Limite de uma empresa criada por conta. Solicite um convite para outras empresas.' using errcode='42501'; end if;
 insert into private.company_creation_registry(user_id) values(auth.uid());
 insert into public.companies(name) values(trim(p_name)) returning id into v_id;
 update public.profiles set full_name=trim(p_responsible) where id=auth.uid();
 insert into public.company_members(company_id,user_id,role) values(v_id,auth.uid(),'owner');
 insert into private.access_events(company_id,actor,action,target) values(v_id,auth.uid(),'company_created',auth.uid()::text);
 return v_id;
end $$;
