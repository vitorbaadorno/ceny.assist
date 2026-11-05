-- Erasure is a durable saga: database purge commits BEFORE Storage deletion.
-- No automatic retention deadline is approved. Governance stays explicitly pending.
create table public.privacy_erasure_operations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 candidate_ids uuid[] not null check(cardinality(candidate_ids)>0), request_id uuid not null,
 requested_by uuid references auth.users(id) on delete set null, reason text not null check(length(btrim(reason)) between 10 and 500),
 state text not null default 'queued' check(state in ('queued','files_pending','completed')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz, last_error text,
 created_at timestamptz not null default now(), database_purged_at timestamptz, completed_at timestamptz,
 unique(company_id,request_id)
);
create index privacy_erasure_ready on public.privacy_erasure_operations(available_at) where state<>'completed';
create index privacy_erasure_company on public.privacy_erasure_operations(company_id,created_at desc);
create index privacy_erasure_actor on public.privacy_erasure_operations(requested_by);
create table private.privacy_erasure_files (
 operation_id uuid not null references public.privacy_erasure_operations(id), bucket text not null,
 object_path text not null, primary key(operation_id,bucket,object_path)
);
alter table private.privacy_erasure_files enable row level security;
revoke all on private.privacy_erasure_files from public,anon,authenticated;
grant all on private.privacy_erasure_files to service_role;

create table public.privacy_retention_holds (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 candidate_id uuid not null, reason text not null check(length(btrim(reason)) between 15 and 1000),
 review_at timestamptz not null, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), released_at timestamptz,
 released_by uuid references auth.users(id) on delete set null, release_reason text
);
create index privacy_holds_candidate on public.privacy_retention_holds(company_id,candidate_id) where released_at is null;
create index privacy_holds_creator on public.privacy_retention_holds(created_by);
create index privacy_holds_releaser on public.privacy_retention_holds(released_by);
create table public.privacy_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 candidate_id uuid not null, kind text not null check(kind in ('access','correction','export','erasure')),
 reference text not null check(length(btrim(reference)) between 5 and 200),
 state text not null default 'open' check(state in ('open','verified','completed','declined')),
 identity_reference text, resolution text, due_at timestamptz not null,
 created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version integer not null default 0, unique(company_id,reference)
);
create index privacy_requests_company on public.privacy_requests(company_id,created_at desc);
create index privacy_requests_creator on public.privacy_requests(created_by);
create index privacy_requests_editor on public.privacy_requests(updated_by);
create table public.privacy_events (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 actor_id uuid references auth.users(id) on delete set null, action text not null,
 subject_id uuid not null, created_at timestamptz not null default now()
);
create index privacy_events_company on public.privacy_events(company_id,created_at desc);
create index privacy_events_actor on public.privacy_events(actor_id);

do $$declare t text;begin
 foreach t in array array['privacy_erasure_operations','privacy_retention_holds','privacy_requests','privacy_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy privacy_admin_read on public.%I for select to authenticated using(private.has_role(company_id,array[''owner'',''admin'']))',t);
 end loop;
end $$;

-- Merged identities are one erasure scope, including earlier source records.
create function private.privacy_candidate_scope(p_company uuid,p_candidate uuid) returns uuid[]
language sql stable security definer set search_path='' as $$
 with recursive connected(id) as (
  select id from public.candidates where company_id=p_company and id=p_candidate
  union
  select case when m.source_id=c.id then m.target_id else m.source_id end
  from connected c join public.candidate_merges m on m.company_id=p_company and (m.source_id=c.id or m.target_id=c.id)
 ) select coalesce(array_agg(id order by id),'{}'::uuid[]) from connected
$$;
create function private.preview_candidate_erasure(p_company uuid,p_candidate uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão' using errcode='42501';end if;
 ids:=private.privacy_candidate_scope(p_company,p_candidate);
 if cardinality(ids)=0 then raise exception 'Cadastro indisponível' using errcode='42501';end if;
 return jsonb_build_object('candidate_ids',ids,
  'documents',(select count(*) from public.resume_documents where company_id=p_company and candidate_id=any(ids)),
  'reports',(select count(*) from public.vacancy_reports where company_id=p_company and candidate_ids&&ids),
  'legacy_reports',(select count(*) from public.job_reports where company_id=p_company),
  'holds',(select count(*) from public.privacy_retention_holds where company_id=p_company and candidate_id=any(ids) and released_at is null));
end $$;
create function private.request_candidate_erasure(p_company uuid,p_candidate uuid,p_confirmed_ids uuid[],p_reason text,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare ids uuid[];op public.privacy_erasure_operations;wait_until timestamptz;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_request is null or coalesce(length(btrim(p_reason)),0) not between 10 and 500 then raise exception 'Informe uma justificativa de 10 a 500 caracteres';end if;
 select * into op from public.privacy_erasure_operations where company_id=p_company and request_id=p_request;
 if found then
  if not p_candidate=any(op.candidate_ids) or op.reason<>btrim(p_reason) or op.candidate_ids is distinct from p_confirmed_ids then raise exception 'Solicitação já utilizada';end if;
  return op.id;
 end if;
 select * into op from public.privacy_erasure_operations where company_id=p_company and p_candidate=any(candidate_ids) order by created_at desc limit 1;
 if found then return op.id;end if;
 ids:=private.privacy_candidate_scope(p_company,p_candidate);
 if cardinality(ids)=0 or ids is distinct from p_confirmed_ids then raise exception 'O alcance mudou. Confira a prévia novamente.' using errcode='40001';end if;
 if exists(select 1 from public.privacy_retention_holds where company_id=p_company and candidate_id=any(ids) and released_at is null) then raise exception 'Há retenção justificada ativa. Revise e libere a retenção antes de eliminar.';end if;
 -- Unclassified legacy data cannot be erased safely based on an inferred identity.
 if exists(select 1 from private.legacy_records where confirmed_company_id=p_company or confirmed_company_id is null)
 or exists(select 1 from public.job_reports where company_id=p_company and pdf_path is not null) then
  raise exception 'Há dados legados sem mapeamento seguro. Solicite revisão administrativa antes de eliminar.';
 end if;
 if exists(select 1 from public.resume_documents where company_id=p_company and candidate_id=any(ids) and state in ('receiving','cleaning')) then
  raise exception 'Há envio ou limpeza em andamento. Aguarde sua conclusão antes de eliminar.';
 end if;
 select greatest(now(),coalesce(max(lease_until)+interval '1 minute',now())) into wait_until from public.resume_jobs
 where company_id=p_company and candidate_id=any(ids) and state='running';
 insert into public.privacy_erasure_operations(company_id,candidate_ids,request_id,requested_by,reason,available_at)
 values(p_company,ids,p_request,auth.uid(),btrim(p_reason),wait_until) returning * into op;
 -- Snapshot every path before changing data. API removal happens only after purge commit.
 insert into private.privacy_erasure_files select op.id,'resumes',object_path from public.resume_documents where company_id=p_company and candidate_id=any(ids)
 union select op.id,'resumes',arquivo_original_path from public.candidates where company_id=p_company and id=any(ids);
 update public.candidates set excluido=true,deleted_at=coalesce(deleted_at,now()) where company_id=p_company and id=any(ids);
 update public.resume_jobs set state='cancelled',phase='done',lease_token=null,lease_until=null,finished_at=now(),updated_at=now(),message='Eliminação solicitada.'
 where company_id=p_company and candidate_id=any(ids) and state in ('queued','running','retry_wait','blocked');
 insert into public.privacy_events(company_id,actor_id,action,subject_id) values(p_company,auth.uid(),'erasure_requested',op.id);
 return op.id;
end $$;

create function private.purge_candidate_data(p_operation uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare op public.privacy_erasure_operations;ids uuid[];
begin
 select * into strict op from public.privacy_erasure_operations where id=p_operation for update;
 ids:=op.candidate_ids;
 if op.state<>'queued' then return;end if;
 if exists(select 1 from public.privacy_retention_holds where company_id=op.company_id and candidate_id=any(ids) and released_at is null) then raise exception 'Retenção ativa';end if;
 delete from public.vacancy_report_events where company_id=op.company_id and report_id in(select id from public.vacancy_reports where company_id=op.company_id and candidate_ids&&ids);
 delete from public.vacancy_reports where company_id=op.company_id and candidate_ids&&ids;
 delete from public.job_reports where company_id=op.company_id;
 delete from public.candidate_notes where company_id=op.company_id and candidate_id=any(ids);
 delete from public.candidate_favorites where company_id=op.company_id and candidate_id=any(ids);
 delete from public.candidate_decision_events where company_id=op.company_id and candidate_id=any(ids);
 delete from public.candidate_link_events where company_id=op.company_id and candidate_id=any(ids);
 delete from public.candidate_job_links where company_id=op.company_id and candidate_id=any(ids);
 delete from public.candidate_document_events where company_id=op.company_id and candidate_id=any(ids);
 delete from public.resume_job_attempts where job_id in(select id from public.resume_jobs where company_id=op.company_id and candidate_id=any(ids));
 delete from public.resume_jobs where company_id=op.company_id and candidate_id=any(ids);
 delete from public.resume_batch_entries e using public.resume_batch_items i,public.resume_documents d
 where e.batch_id=i.batch_id and e.slot=i.slot and i.document_id=d.id and d.company_id=op.company_id and d.candidate_id=any(ids);
 delete from public.resume_batch_items where document_id in(select id from public.resume_documents where company_id=op.company_id and candidate_id=any(ids));
 update public.candidates set active_document_id=null,merged_into_id=null where company_id=op.company_id and id=any(ids);
 delete from public.resume_documents where company_id=op.company_id and candidate_id=any(ids);
 delete from public.candidate_merges where company_id=op.company_id and (source_id=any(ids) or target_id=any(ids));
 -- Candidate revisions, scores, ranking entries and age reviews cascade from candidates.
 update public.ranking_runs set stale=true where company_id=op.company_id and id in(select run_id from public.ranking_entries where company_id=op.company_id and candidate_id=any(ids));
 delete from public.candidates where company_id=op.company_id and id=any(ids);
 update public.privacy_erasure_operations set state='files_pending',database_purged_at=now(),last_error=null where id=op.id;
 insert into public.privacy_events(company_id,action,subject_id) values(op.company_id,'database_purged',op.id);
end $$;

create function public.claim_privacy_erasure() returns jsonb language plpgsql security invoker set search_path='' as $$
declare op public.privacy_erasure_operations;result jsonb;company uuid;
begin
 -- Same company lock order as extraction, merge, report generation and revocation.
 select c.id into company from public.companies c where exists(select 1 from public.privacy_erasure_operations e where e.company_id=c.id and e.state<>'completed' and e.available_at<=now() and coalesce(e.lease_until,'-infinity')<now()) order by c.id limit 1 for update skip locked;
 if company is null then return null;end if;
 select e.* into op from public.privacy_erasure_operations e where e.company_id=company and e.state<>'completed' and e.available_at<=now() and coalesce(e.lease_until,'-infinity')<now()
 order by e.available_at,e.id limit 1 for update skip locked;
 if not found then return null;end if;
 begin
  perform private.purge_candidate_data(op.id);
 exception when others then
  update public.privacy_erasure_operations set attempts=attempts+1,last_error='Falha na etapa de banco. Nenhum arquivo foi removido por esta operação; a tentativa será repetida.',available_at=now()+interval '5 minutes' where id=op.id;
  return null;
 end;
 update public.privacy_erasure_operations set lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=op.id returning * into op;
 select jsonb_build_object('id',op.id,'token',op.lease_token,'files',coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'path',object_path)),'[]')) into result from private.privacy_erasure_files where operation_id=op.id;
 return result;
end $$;
create function public.finish_privacy_erasure(p_operation uuid,p_token uuid,p_success boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
declare op public.privacy_erasure_operations;
begin
 select * into op from public.privacy_erasure_operations where id=p_operation and lease_token=p_token and state='files_pending' for update;
 if not found then return false;end if;
 if p_success and not exists(select 1 from private.privacy_erasure_files f join storage.objects o on o.bucket_id=f.bucket and o.name=f.object_path where f.operation_id=op.id) then
  update public.privacy_erasure_operations set state='completed',completed_at=now(),lease_token=null,lease_until=null,last_error=null where id=op.id;
  delete from private.privacy_erasure_files where operation_id=op.id;
  insert into public.privacy_events(company_id,action,subject_id) values(op.company_id,'erasure_completed',op.id);
  return true;
 end if;
 update public.privacy_erasure_operations set lease_token=null,lease_until=null,available_at=now()+interval '5 minutes',last_error='Dados do banco eliminados; remoção dos arquivos pendente. O sistema tentará novamente.' where id=op.id;
 return false;
end $$;

create function private.retry_privacy_erasure(p_company uuid,p_operation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão' using errcode='42501';end if;
 update public.privacy_erasure_operations set available_at=now() where company_id=p_company and id=p_operation and state<>'completed' and database_purged_at is not null and coalesce(lease_until,'-infinity')<now();
 -- Never shorten the drain period of an extraction already in flight.
 insert into public.privacy_events(company_id,actor_id,action,subject_id) values(p_company,auth.uid(),'erasure_retry_requested',p_operation);
end $$;

create function private.set_privacy_hold(p_company uuid,p_candidate uuid,p_reason text,p_review_at timestamptz,p_release uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão' using errcode='42501';end if;
 if coalesce(length(btrim(p_reason)),0) not between 15 and 1000 then raise exception 'Registre a justificativa de 15 a 1000 caracteres';end if;
 if p_release is not null then
  update public.privacy_retention_holds set released_at=now(),released_by=auth.uid(),release_reason=btrim(p_reason)
  where id=p_release and company_id=p_company and candidate_id=p_candidate and released_at is null returning id into result;
 else
  if p_review_at is null or p_review_at<=now() or not exists(select 1 from public.candidates where company_id=p_company and id=p_candidate)
  or exists(select 1 from public.privacy_erasure_operations where company_id=p_company and p_candidate=any(candidate_ids)) then raise exception 'Confira o cadastro, a data de revisão e eliminações pendentes';end if;
  insert into public.privacy_retention_holds(company_id,candidate_id,reason,review_at,created_by) values(p_company,p_candidate,btrim(p_reason),p_review_at,auth.uid()) returning id into result;
 end if;
 if result is null then raise exception 'Retenção indisponível';end if;
 insert into public.privacy_events(company_id,actor_id,action,subject_id) values(p_company,auth.uid(),case when p_release is null then 'hold_created' else 'hold_released' end,result);
 return result;
end $$;

create function private.save_privacy_request(p_company uuid,p_candidate uuid,p_kind text,p_reference text,p_due_at timestamptz,p_id uuid default null,p_version integer default 0,p_state text default 'open',p_identity text default null,p_resolution text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.privacy_requests;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_id is null then
  if p_state is distinct from 'open' or p_due_at is null or not exists(select 1 from public.candidates where company_id=p_company and id=p_candidate) then raise exception 'Confira o cadastro e a data interna de acompanhamento';end if;
  insert into public.privacy_requests(company_id,candidate_id,kind,reference,due_at,created_by,updated_by) values(p_company,p_candidate,p_kind,btrim(p_reference),p_due_at,auth.uid(),auth.uid()) returning * into r;
 else
  select * into r from public.privacy_requests where company_id=p_company and id=p_id for update;
  if not found or r.version is distinct from p_version then raise exception 'Pedido alterado. Recarregue.' using errcode='40001';end if;
  if r.state in ('completed','declined') or p_state not in ('verified','completed','declined') then raise exception 'Transição inválida';end if;
  if p_state in ('verified','completed') and coalesce(length(btrim(p_identity)),0) not between 5 and 200 then raise exception 'Registre a referência da verificação de identidade, sem anexar documentos pessoais';end if;
  if p_state='completed' and r.state<>'verified' then raise exception 'Verifique a identidade antes de concluir';end if;
  if p_state in ('completed','declined') and coalesce(length(btrim(p_resolution)),0) not between 10 and 1000 then raise exception 'Registre a resolução e a referência da providência tomada';end if;
  if p_state='completed' and r.kind='erasure' and not exists(select 1 from public.privacy_erasure_operations where company_id=p_company and r.candidate_id=any(candidate_ids) and state='completed') then raise exception 'A eliminação ainda não foi concluída';end if;
  update public.privacy_requests set state=p_state,identity_reference=btrim(p_identity),resolution=btrim(p_resolution),updated_by=auth.uid(),updated_at=now(),version=version+1 where id=r.id returning * into r;
 end if;
 insert into public.privacy_events(company_id,actor_id,action,subject_id) values(p_company,auth.uid(),'request_'||r.state,r.id);
 return r.id;
end $$;

create function private.export_privacy_subject(p_company uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.privacy_requests;result jsonb;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão' using errcode='42501';end if;
 select * into r from public.privacy_requests where company_id=p_company and id=p_request and state='verified' and kind in ('access','export');
 if not found then raise exception 'Pedido indisponível ou identidade não verificada' using errcode='42501';end if;
 if exists(select 1 from public.privacy_erasure_operations where company_id=p_company and r.candidate_id=any(candidate_ids)) then raise exception 'Eliminação em andamento ou concluída';end if;
 select jsonb_build_object('generated_at',now(),'request',r.id,'candidate',jsonb_build_object(
  'id',c.id,'name',c.nome,'email',c.email,'phone',c.telefone,'location',c.localizacao,'birth_date',c.data_nascimento,
  'ai_extraction',c.dados_extraidos,'rh_corrections',c.correcoes_rh,'effective_data',c.dados_efetivos,'created_at',c.created_at),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'version',d.version,'filename',d.filename,'created_at',d.created_at,'extraction',d.latest_extraction)) from public.resume_documents d where d.company_id=p_company and d.candidate_id=c.id),'[]'),
  'revisions',coalesce((select jsonb_agg(to_jsonb(v)-'actor_id'-'actor_name') from public.candidate_revisions v where v.company_id=p_company and v.candidate_id=c.id),'[]'),
  'decisions',coalesce((select jsonb_agg(to_jsonb(v)-'actor_id'-'actor_name') from public.candidate_decision_events v where v.company_id=p_company and v.candidate_id=c.id),'[]'),
  'notes',coalesce((select jsonb_agg(jsonb_build_object('job_id',v.job_id,'created_at',v.created_at,'body',v.body)) from public.candidate_notes v where v.company_id=p_company and v.candidate_id=c.id),'[]'),
  'assessments',coalesce((select jsonb_agg(jsonb_build_object('run_id',v.run_id,'score',v.score,'reason',v.reason,'details',v.details)) from public.ranking_entries v where v.company_id=p_company and v.candidate_id=c.id),'[]'))
 into result from public.candidates c where c.company_id=p_company and c.id=r.candidate_id;
 if result is null then raise exception 'Cadastro indisponível';end if;
 insert into public.privacy_events(company_id,actor_id,action,subject_id) values(p_company,auth.uid(),'subject_export_requested',r.id);
 return result;
end $$;

-- Administrative inventory also includes archived registrations, without contacts.
create function private.privacy_candidates(p_company uuid,p_offset integer default 0) returns table(id uuid,label text,archived boolean,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão' using errcode='42501';end if;
 return query select c.id,coalesce(c.nome,'Cadastro sem nome'),c.excluido,c.created_at from public.candidates c where c.company_id=p_company order by c.created_at desc,c.id limit 51 offset greatest(0,coalesce(p_offset,0));
end $$;

-- Public invoker wrappers; sensitive definitions stay outside exposed schemas.
create function public.preview_candidate_erasure(p_company uuid,p_candidate uuid) returns jsonb language sql security invoker set search_path='' as $$select private.preview_candidate_erasure(p_company,p_candidate)$$;
create function public.request_candidate_erasure(p_company uuid,p_candidate uuid,p_confirmed_ids uuid[],p_reason text,p_request uuid) returns uuid language sql security invoker set search_path='' as $$select private.request_candidate_erasure(p_company,p_candidate,p_confirmed_ids,p_reason,p_request)$$;
create function public.retry_privacy_erasure(p_company uuid,p_operation uuid) returns void language sql security invoker set search_path='' as $$select private.retry_privacy_erasure(p_company,p_operation)$$;
create function public.set_privacy_hold(p_company uuid,p_candidate uuid,p_reason text,p_review_at timestamptz,p_release uuid default null) returns uuid language sql security invoker set search_path='' as $$select private.set_privacy_hold(p_company,p_candidate,p_reason,p_review_at,p_release)$$;
create function public.save_privacy_request(p_company uuid,p_candidate uuid,p_kind text,p_reference text,p_due_at timestamptz,p_id uuid default null,p_version integer default 0,p_state text default 'open',p_identity text default null,p_resolution text default null) returns uuid language sql security invoker set search_path='' as $$select private.save_privacy_request(p_company,p_candidate,p_kind,p_reference,p_due_at,p_id,p_version,p_state,p_identity,p_resolution)$$;
create function public.export_privacy_subject(p_company uuid,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select private.export_privacy_subject(p_company,p_request)$$;
create function public.privacy_candidates(p_company uuid,p_offset integer default 0) returns table(id uuid,label text,archived boolean,created_at timestamptz) language sql security invoker set search_path='' as $$select * from private.privacy_candidates(p_company,p_offset)$$;
do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname in
 ('preview_candidate_erasure','request_candidate_erasure','retry_privacy_erasure','set_privacy_hold','save_privacy_request','export_privacy_subject','privacy_candidates') loop
  execute format('revoke all on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;
revoke all on function private.privacy_candidate_scope(uuid,uuid),private.purge_candidate_data(uuid),public.claim_privacy_erasure(),public.finish_privacy_erasure(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.purge_candidate_data(uuid),public.claim_privacy_erasure(),public.finish_privacy_erasure(uuid,uuid,boolean) to service_role;

-- Wake the existing authenticated scheduler for erasures even with no extraction jobs.
create or replace function private.dispatch_resume_queue() returns bigint language plpgsql security definer set search_path='' as $$
declare config private.resume_dispatch;token text;request_id bigint;
begin
 select * into config from private.resume_dispatch where id;
 if config.endpoint is null or not (exists(select 1 from public.resume_jobs where (state in ('queued','retry_wait') and available_at<=now()) or (state='running' and lease_until<now()))
 or exists(select 1 from public.privacy_erasure_operations where state<>'completed' and available_at<=now() and coalesce(lease_until,'-infinity')<now())) then return null;end if;
 select decrypted_secret into token from vault.decrypted_secrets where id=config.secret_id;
 select net.http_post(url:=config.endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-ceny-queue-token',token),body:='{}'::jsonb,timeout_milliseconds:=130000) into request_id;
 update private.resume_dispatch set last_request_id=request_id,last_requested_at=now() where id;
 return request_id;
end $$;
