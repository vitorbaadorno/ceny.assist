-- Fresh database only. Legacy data belongs in private.legacy_records until reviewed.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  created_at timestamptz not null default now()
);
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','recruiter','viewer')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user on public.company_members(user_id, company_id);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  nome text, email text, telefone text, localizacao text, data_nascimento date,
  dados_extraidos jsonb not null default '{}',
  skills text[] not null default '{}', anos_experiencia numeric,
  status text not null default 'novo' check (status in ('novo','em_analise','aprovado','rejeitado','contratado')),
  processing_status text not null default 'processando' check (processing_status in ('processando','concluido','revisao_manual','erro')),
  processing_error text,
  arquivo_original_path text generated always as (company_id::text || '/' || id::text || '/original') stored,
  arquivo_nome text,
  observacoes text,
  excluido boolean not null default false,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id, id)
);
create index candidates_company_status on public.candidates(company_id, status) where not excluido;
create index candidates_created_by on public.candidates(created_by);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  titulo text not null, descricao text,
  requisitos_obrigatorios text[] not null default '{}', requisitos_desejaveis text[] not null default '{}',
  experiencia_minima numeric not null default 0, formacao_exigida text, localizacao text,
  categoria text not null default 'regular' check (categoria in ('regular','jovem_aprendiz')),
  status text not null default 'aberta', excluido boolean not null default false, deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id, id)
);
create index jobs_created_by on public.jobs(created_by);
create table public.candidate_scores (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  candidate_id uuid not null, job_id uuid not null,
  score numeric not null check (score between 0 and 100), detalhes_matching jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(candidate_id, job_id),
  foreign key(company_id, candidate_id) references public.candidates(company_id, id) on delete cascade,
  foreign key(company_id, job_id) references public.jobs(company_id, id) on delete cascade
);
create index scores_company_candidate on public.candidate_scores(company_id, candidate_id);
create index scores_company_job on public.candidate_scores(company_id, job_id, score desc);
create table public.job_reports (
  id uuid primary key default gen_random_uuid(), company_id uuid not null, job_id uuid not null,
  conteudo jsonb not null default '{}', resumo text, pdf_path text, enviado_para text, enviado_em timestamptz,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  foreign key(company_id, job_id) references public.jobs(company_id, id) on delete cascade
);
create index reports_company_job on public.job_reports(company_id, job_id);
create index reports_created_by on public.job_reports(created_by);

-- Not exposed through PostgREST. No customer has any privileges or policies here.
create table private.legacy_records (
  id uuid primary key default gen_random_uuid(), source_system text not null, source_table text not null,
  source_id text not null, payload jsonb not null, original_object_path text,
  confirmed_company_id uuid references public.companies(id), ownership_evidence text,
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz, imported_at timestamptz,
  unique(source_system, source_table, source_id),
  check (confirmed_company_id is null or (length(trim(ownership_evidence)) > 0 and reviewed_by is not null and reviewed_at is not null)),
  check (imported_at is null or confirmed_company_id is not null)
);
alter table private.legacy_records enable row level security;
revoke all on private.legacy_records from public, anon, authenticated;
grant all on private.legacy_records to service_role;

create function private.has_role(p_company uuid, p_roles text[] default array['owner','admin','recruiter','viewer'])
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.company_members m join auth.users u on u.id=m.user_id
    where m.company_id=p_company and m.user_id=(select auth.uid()) and m.role=any(p_roles)
      and not coalesce(u.is_anonymous,false)
  )
$$;
create function private.can_read_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (auth.uid()=p_user or exists (
    select 1 from public.company_members mine join public.company_members theirs using(company_id)
    where mine.user_id=(select auth.uid()) and mine.role in ('owner','admin') and theirs.user_id=p_user
  ))
$$;
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name) values(new.id, left(new.raw_user_meta_data->>'full_name',160));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
insert into public.profiles(id, full_name) select id,left(raw_user_meta_data->>'full_name',160) from auth.users on conflict do nothing;
create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end $$;
create trigger candidates_updated before update on public.candidates for each row execute function private.touch_updated_at();
create trigger jobs_updated before update on public.jobs for each row execute function private.touch_updated_at();

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.jobs enable row level security;
alter table public.candidate_scores enable row level security;
alter table public.job_reports enable row level security;
revoke all on public.companies, public.company_members, public.profiles, public.candidates, public.jobs, public.candidate_scores, public.job_reports from anon, authenticated;
grant select on public.companies, public.company_members, public.profiles, public.candidates, public.jobs, public.candidate_scores, public.job_reports to authenticated;
grant all on public.companies, public.company_members, public.profiles, public.candidates, public.jobs, public.candidate_scores, public.job_reports to service_role;
grant update(full_name) on public.profiles to authenticated;
grant insert(id, company_id, nome, arquivo_nome) on public.candidates to authenticated;
grant update(status, observacoes, localizacao, data_nascimento) on public.candidates to authenticated;
grant insert(company_id,titulo,descricao,requisitos_obrigatorios,requisitos_desejaveis,experiencia_minima,formacao_exigida,localizacao,categoria) on public.jobs to authenticated;
grant update(titulo,descricao,requisitos_obrigatorios,requisitos_desejaveis,experiencia_minima,formacao_exigida,localizacao,categoria,status) on public.jobs to authenticated;

create policy company_read on public.companies for select to authenticated using(private.has_role(id));
create policy member_read on public.company_members for select to authenticated
  using(user_id=(select auth.uid()) or private.has_role(company_id,array['owner','admin']));
create policy profile_read on public.profiles for select to authenticated using(private.can_read_profile(id));
create policy profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy candidate_read on public.candidates for select to authenticated using(not excluido and private.has_role(company_id));
create policy candidate_insert on public.candidates for insert to authenticated with check(not excluido and created_by=(select auth.uid()) and private.has_role(company_id,array['owner','admin','recruiter']));
create policy candidate_update on public.candidates for update to authenticated using(not excluido and private.has_role(company_id,array['owner','admin','recruiter'])) with check(not excluido and private.has_role(company_id,array['owner','admin','recruiter']));
create policy job_read on public.jobs for select to authenticated using(not excluido and private.has_role(company_id));
create policy job_insert on public.jobs for insert to authenticated with check(not excluido and created_by=(select auth.uid()) and private.has_role(company_id,array['owner','admin','recruiter']));
create policy job_update on public.jobs for update to authenticated using(not excluido and private.has_role(company_id,array['owner','admin','recruiter'])) with check(not excluido and private.has_role(company_id,array['owner','admin','recruiter']));
create policy score_read on public.candidate_scores for select to authenticated using(private.has_role(company_id)
  and exists(select 1 from public.candidates c where c.id=candidate_id and c.company_id=candidate_scores.company_id and not c.excluido)
  and exists(select 1 from public.jobs j where j.id=job_id and j.company_id=candidate_scores.company_id and not j.excluido));
create policy report_read on public.job_reports for select to authenticated using(private.has_role(company_id)
  and exists(select 1 from public.jobs j where j.id=job_id and j.company_id=job_reports.company_id and not j.excluido));

-- Only the creator gets ownership; no caller-supplied owner or role.
create function private.create_company(p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and not coalesce(is_anonymous,false) and email_confirmed_at is not null) then
    raise exception 'Confirme seu e-mail antes de cadastrar uma empresa.' using errcode='42501';
  end if;
  insert into public.companies(name) values(trim(p_name)) returning id into v_id;
  insert into public.company_members(company_id,user_id,role) values(v_id,auth.uid(),'owner');
  return v_id;
end $$;
create function public.create_company(p_name text) returns uuid language sql security invoker set search_path='' as $$ select private.create_company(p_name) $$;

-- Membership changes are serialized per company. Owners cannot be removed/demoted here.
create function private.manage_member(p_company uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
declare v_actor_role text;
begin
  if auth.uid() is null then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform 1 from public.companies where id=p_company for update;
  select role into v_actor_role from public.company_members where company_id=p_company and user_id=auth.uid() for update;
  if v_actor_role is null or v_actor_role not in ('owner','admin') then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_user=auth.uid() or exists(select 1 from public.company_members where company_id=p_company and user_id=p_user and role='owner') then
    raise exception 'O proprietário e seu próprio acesso não podem ser alterados aqui.' using errcode='42501';
  end if;
  if p_role is not null and p_role not in ('admin','recruiter','viewer') then raise exception 'Papel inválido'; end if;
  if v_actor_role='admin' and (p_role='admin' or exists(select 1 from public.company_members where company_id=p_company and user_id=p_user and role='admin')) then
    raise exception 'Somente o proprietário gerencia administradores.' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users where id=p_user and not coalesce(is_anonymous,false) and email_confirmed_at is not null) then
    raise exception 'Usuário indisponível. Informe o ID de uma conta confirmada.';
  end if;
  if p_role is null then delete from public.company_members where company_id=p_company and user_id=p_user;
  else insert into public.company_members(company_id,user_id,role) values(p_company,p_user,p_role)
    on conflict(company_id,user_id) do update set role=excluded.role;
  end if;
end $$;
create function public.manage_company_member(p_company uuid,p_user uuid,p_role text) returns void language sql security invoker set search_path='' as $$ select private.manage_member(p_company,p_user,p_role) $$;

create function private.archive_record(p_company uuid,p_id uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Acesso negado' using errcode='42501'; end if;
  perform 1 from public.company_members where company_id=p_company and user_id=auth.uid() and role in ('owner','admin') for share;
  if not found then raise exception 'Sem permissão para arquivar.' using errcode='42501'; end if;
  if p_kind='candidate' then
    update public.candidates set excluido=true,deleted_at=now() where id=p_id and company_id=p_company and not excluido;
    if not found then raise exception 'Registro indisponível' using errcode='42501'; end if;
    delete from public.candidate_scores where company_id=p_company and candidate_id=p_id;
    -- Reports may embed this candidate. Invalidate all snapshots for the company.
    delete from public.job_reports where company_id=p_company;
  elsif p_kind='job' then
    update public.jobs set excluido=true,deleted_at=now() where id=p_id and company_id=p_company and not excluido;
    if not found then raise exception 'Registro indisponível' using errcode='42501'; end if;
    delete from public.candidate_scores where company_id=p_company and job_id=p_id;
    delete from public.job_reports where company_id=p_company and job_id=p_id;
  else raise exception 'Tipo inválido'; end if;
end $$;
create function public.archive_candidate(p_company uuid,p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.archive_record(p_company,p_id,'candidate') $$;
create function public.archive_job(p_company uuid,p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.archive_record(p_company,p_id,'job') $$;

-- These two endpoints are callable ONLY by the trusted backend. The actor comes
-- from verified authentication, never from the browser's request body.
create function public.save_candidate_extraction(p_actor uuid,p_company uuid,p_id uuid,p_extraction jsonb,p_status text,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
  if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
  if p_status not in ('concluido','revisao_manual','erro') then raise exception 'Estado inválido'; end if;
  if p_status='erro' then
    update public.candidates set processing_status='erro',processing_error=p_error where id=p_id and company_id=p_company and not excluido;
  else
    update public.candidates set
      nome=coalesce(p_extraction->>'nome_completo',arquivo_nome,'Sem nome'),email=p_extraction->>'email',telefone=p_extraction->>'telefone',
      data_nascimento=(p_extraction->>'data_nascimento')::date,localizacao=p_extraction->>'localizacao',
      skills=array(select jsonb_array_elements_text(p_extraction->'skills')),anos_experiencia=(p_extraction->>'anos_experiencia_total')::numeric,
      dados_extraidos=p_extraction,processing_status=p_status,processing_error=null
    where id=p_id and company_id=p_company and not excluido;
  end if;
  if not found then raise exception 'Candidato indisponível' using errcode='42501'; end if;
  delete from public.candidate_scores where company_id=p_company and candidate_id=p_id;
  delete from public.job_reports where company_id=p_company;
end $$;
create function public.replace_job_scores(p_actor uuid,p_company uuid,p_job uuid,p_scores jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
  if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
  perform 1 from public.jobs where id=p_job and company_id=p_company and not excluido for update;
  if not found then raise exception 'Vaga indisponível' using errcode='42501'; end if;
  -- Lock candidates against archiving during persistence.
  perform 1 from public.candidates where company_id=p_company and id in
    (select (value->>'candidate_id')::uuid from jsonb_array_elements(p_scores)) order by id for share;
  if exists(select 1 from jsonb_array_elements(p_scores) s where not exists(
    select 1 from public.candidates c where c.id=(s->>'candidate_id')::uuid and c.company_id=p_company and not c.excluido
      and c.processing_status in ('concluido','revisao_manual'))) then raise exception 'Candidato incompatível' using errcode='23503'; end if;
  delete from public.candidate_scores where company_id=p_company and job_id=p_job;
  insert into public.candidate_scores(company_id,candidate_id,job_id,score,detalhes_matching)
    select p_company,(s->>'candidate_id')::uuid,p_job,(s->>'score')::numeric,s->'detalhes_matching' from jsonb_array_elements(p_scores) s;
  delete from public.job_reports where company_id=p_company and job_id=p_job;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('resumes','resumes',false,10485760,array['application/pdf','image/jpeg','image/png']);
insert into storage.buckets(id,name,public) values('legacy-quarantine','legacy-quarantine',false);
create policy resume_read on storage.objects for select to authenticated using(bucket_id='resumes' and exists(
  select 1 from public.candidates c where c.arquivo_original_path=name and not c.excluido and private.has_role(c.company_id)));
create policy resume_insert on storage.objects for insert to authenticated with check(bucket_id='resumes' and exists(
  select 1 from public.candidates c where c.arquivo_original_path=name and not c.excluido and c.created_by=(select auth.uid())
    and private.has_role(c.company_id,array['owner','admin','recruiter'])));
create policy resume_delete on storage.objects for delete to authenticated using(bucket_id='resumes' and exists(
  select 1 from public.candidates c where c.arquivo_original_path=name and not c.excluido and private.has_role(c.company_id,array['owner','admin'])));
-- No UPDATE policy: originals cannot be swapped after upload.

revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.has_role(uuid,text[]),private.can_read_profile(uuid),private.create_company(text),private.manage_member(uuid,uuid,text),private.archive_record(uuid,uuid,text) to authenticated;
revoke execute on function public.create_company(text),public.manage_company_member(uuid,uuid,text),public.archive_candidate(uuid,uuid),public.archive_job(uuid,uuid),public.save_candidate_extraction(uuid,uuid,uuid,jsonb,text,text),public.replace_job_scores(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_company(text),public.manage_company_member(uuid,uuid,text),public.archive_candidate(uuid,uuid),public.archive_job(uuid,uuid) to authenticated;
grant execute on function public.save_candidate_extraction(uuid,uuid,uuid,jsonb,text,text),public.replace_job_scores(uuid,uuid,uuid,jsonb) to service_role;
