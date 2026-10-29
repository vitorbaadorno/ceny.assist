-- A person owns many immutable originals; attempts belong to one exact original.
alter table public.resume_documents drop constraint resume_documents_candidate_id_key;
alter table public.resume_documents add column object_path text, add column version integer,
 add column latest_extraction jsonb not null default '{}';
update public.resume_documents d set object_path=c.arquivo_original_path,version=1,
 latest_extraction=c.dados_extraidos from public.candidates c where c.id=d.candidate_id;
alter table public.resume_documents alter column object_path set not null,alter column version set not null;
alter table public.resume_documents add constraint documents_path_unique unique(object_path),
 add constraint documents_candidate_version unique(candidate_id,version),
 add constraint documents_positive_version check(version>0);
alter table public.candidates add column active_document_id uuid,add column merged_into_id uuid;
update public.candidates c set active_document_id=d.id from public.resume_documents d where d.candidate_id=c.id;
alter table public.candidates add constraint candidate_active_document foreign key(company_id,active_document_id,id)
 references public.resume_documents(company_id,id,candidate_id) deferrable initially deferred;
alter table public.candidates add constraint candidate_merge_company foreign key(company_id,merged_into_id) references public.candidates(company_id,id);
create index candidates_active_document on public.candidates(company_id,active_document_id,id);
create index candidates_merged_into on public.candidates(company_id,merged_into_id);
alter table public.resume_jobs drop constraint resume_jobs_document_identity;
alter table public.resume_jobs add constraint resume_jobs_document_identity foreign key(company_id,document_id,candidate_id)
 references public.resume_documents(company_id,id,candidate_id) on update cascade;

create function private.prepare_document_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.companies where id=new.company_id for update;
 if tg_op='UPDATE' then
  if row(new.object_path,new.sha256,new.filename,new.mime_type,new.byte_size,new.page_count,new.source,new.uploaded_by,new.created_at,new.company_id)
    is distinct from row(old.object_path,old.sha256,old.filename,old.mime_type,old.byte_size,old.page_count,old.source,old.uploaded_by,old.created_at,old.company_id)
  then raise exception 'O original e sua origem são imutáveis';end if;
 else
  new.version:=coalesce((select max(version)+1 from public.resume_documents where candidate_id=new.candidate_id),1);
  new.object_path:=case when new.version=1 then new.company_id::text||'/'||new.candidate_id::text||'/original'
   else new.company_id::text||'/documents/'||new.id::text||'/original' end;
 end if;return new;
end $$;
create trigger prepare_document_version before insert or update on public.resume_documents for each row execute function private.prepare_document_version();

create table public.candidate_document_events (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,candidate_id uuid not null,
 document_id uuid not null references public.resume_documents(id),actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('received','selected')),created_at timestamptz not null default now(),
 foreign key(company_id,candidate_id) references public.candidates(company_id,id)
);
create index document_events_candidate on public.candidate_document_events(company_id,candidate_id);
create index document_events_document on public.candidate_document_events(document_id);
create index document_events_actor on public.candidate_document_events(actor_id);
alter table public.candidate_document_events enable row level security;
revoke all on public.candidate_document_events from public,anon,authenticated;
grant select on public.candidate_document_events to authenticated;grant all on public.candidate_document_events to service_role;
create policy document_events_read on public.candidate_document_events for select to authenticated using(private.has_role(company_id)
 and exists(select 1 from public.candidates c where c.id=candidate_id and not c.excluido));

create function private.activate_document(p_company uuid,p_document uuid,p_actor uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare d public.resume_documents;
begin
 select * into strict d from public.resume_documents where id=p_document and company_id=p_company;
 update public.candidates set active_document_id=d.id,arquivo_nome=d.filename,dados_extraidos=d.latest_extraction,
  processing_status=case d.state when 'completed' then 'concluido' when 'review' then 'revisao_manual' when 'error' then 'erro' else 'processando' end,
  processing_error=d.error_message,review_status='pending',review_version=review_version+1,reviewed_by=null,reviewed_at=null
 where id=d.candidate_id and company_id=p_company and not excluido and active_document_id is distinct from d.id;
 if found then
  insert into public.candidate_document_events(company_id,candidate_id,document_id,actor_id,action) values(p_company,d.candidate_id,d.id,p_actor,p_action);
 end if;
end $$;
create function private.initialize_active_document() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.candidates where id=new.candidate_id and active_document_id is null) then
  perform private.activate_document(new.company_id,new.id,new.uploaded_by,'received');
 end if;return new;
end $$;
create trigger initialize_active_document after insert on public.resume_documents for each row execute function private.initialize_active_document();
create function public.select_candidate_document(p_company uuid,p_candidate uuid,p_document uuid,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão' using errcode='42501';end if;
 if not exists(select 1 from public.candidates where id=p_candidate and company_id=p_company and not excluido and review_version=p_expected_version)
 then raise exception 'Cadastro alterado. Atualize antes de selecionar.' using errcode='40001';end if;
 if not exists(select 1 from public.resume_documents where id=p_document and candidate_id=p_candidate and company_id=p_company and stored_at is not null)
 then raise exception 'Documento indisponível';end if;
 perform private.activate_document(p_company,p_document,auth.uid(),'selected');
end $$;

-- Direct Storage reads and signed links use each original's owner, including old versions.
drop policy resume_read on storage.objects;
create policy resume_read on storage.objects for select to authenticated using(bucket_id='resumes' and (
 exists(select 1 from public.resume_documents d join public.candidates c on c.id=d.candidate_id and c.company_id=d.company_id
  where d.object_path=name and not c.excluido and private.has_role(d.company_id)) or
 exists(select 1 from public.candidates c where c.arquivo_original_path=name and not c.excluido and private.has_role(c.company_id)
  and not exists(select 1 from public.resume_documents d where d.object_path=name))));

create function public.reserve_resume_version(p_actor uuid,p_company uuid,p_batch uuid,p_slot integer,p_sha text,p_filename text,p_mime text,p_size integer,p_pages integer,p_candidate uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.resume_batches;d public.resume_documents;v_candidate uuid;v_existing uuid;v_owned boolean:=false;
begin
 perform 1 from public.companies where id=p_company for update;
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501';end if;
 select * into b from public.resume_batches where id=p_batch and company_id=p_company and uploaded_by=p_actor for update;
 if not found or b.created_at<now()-interval '1 hour' or p_slot<0 or p_slot>=b.file_count then raise exception 'Lote inválido';end if;
 if exists(select 1 from public.resume_batch_entries where batch_id=p_batch and slot=p_slot and state='cancelled') then raise exception 'Envio cancelado';end if;
 if p_candidate is not null and not exists(select 1 from public.candidates where id=p_candidate and company_id=p_company and not excluido) then raise exception 'Candidato indisponível' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company::text||p_sha,0));
 select * into d from public.resume_documents where company_id=p_company and sha256=p_sha for update;
 select document_id into v_existing from public.resume_batch_items where batch_id=p_batch and slot=p_slot;
 if v_existing is not null and (d.id is null or v_existing<>d.id) then raise exception 'Posição já utilizada';end if;
 if d.id is null then
  v_candidate:=p_candidate;
  if v_candidate is null then
   insert into public.candidates(company_id,arquivo_nome,created_by) values(p_company,p_filename,p_actor) returning id into v_candidate;
  end if;
  insert into public.resume_documents(company_id,candidate_id,sha256,filename,mime_type,byte_size,page_count,source,uploaded_by)
   values(p_company,v_candidate,p_sha,p_filename,p_mime,p_size,p_pages,b.source,p_actor) returning * into d;
  v_owned:=true;
 elsif exists(select 1 from public.candidates where id=d.candidate_id and excluido) then raise exception 'Currículo arquivado';
 elsif p_candidate is not null and p_candidate<>d.candidate_id then
  -- Do not move a matching file between people based on a request parameter.
  return jsonb_build_object('documentId',d.id,'candidateId',d.candidate_id,'state',d.state,'owned',false,
   'message','Este arquivo já pertence a outro cadastro. Confira os dois candidatos antes de reunir os documentos.');
 elsif d.state='error' and d.ai_started_at is null and not exists(select 1 from storage.objects where bucket_id='resumes' and name=d.object_path) then
  update public.resume_documents set state='receiving',error_message=null,operation_token=gen_random_uuid(),updated_at=now() where id=d.id returning * into d;
  v_owned:=true;
 end if;
 insert into public.resume_batch_items values(p_batch,p_slot,d.id) on conflict do nothing;
 return jsonb_build_object('documentId',d.id,'candidateId',d.candidate_id,'state',d.state,'owned',v_owned,
  'token',case when v_owned then d.operation_token end,'path',d.object_path,'message',d.error_message);
end $$;
create or replace function public.reserve_resume(p_actor uuid,p_company uuid,p_batch uuid,p_slot integer,p_sha text,p_filename text,p_mime text,p_size integer,p_pages integer)
returns jsonb language sql security invoker set search_path='' as $$
 select public.reserve_resume_version(p_actor,p_company,p_batch,p_slot,p_sha,p_filename,p_mime,p_size,p_pages,null)
$$;
-- Retire the old bypass, while preserving the public compatibility entrypoint.
revoke execute on function public.reserve_resume_validated(uuid,uuid,uuid,integer,text,text,text,integer,integer) from service_role;
revoke all on function private.prepare_document_version(),private.activate_document(uuid,uuid,uuid,text),private.initialize_active_document(),
 public.select_candidate_document(uuid,uuid,uuid,bigint),public.reserve_resume_version(uuid,uuid,uuid,integer,text,text,text,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.select_candidate_document(uuid,uuid,uuid,bigint) to authenticated;
grant execute on function public.reserve_resume_version(uuid,uuid,uuid,integer,text,text,text,integer,integer,uuid) to service_role;


create or replace function private.enqueue_document(p_actor uuid,p_company uuid,p_document uuid,p_mode text,p_request uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare p_candidate uuid; d public.resume_documents; j public.resume_jobs; result uuid;
begin
 perform 1 from public.companies where id=p_company for update;
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter')) then raise exception 'Sem permissão para leitura.' using errcode='42501';end if;
 select candidate_id into p_candidate from public.resume_documents where id=p_document and company_id=p_company;
 if not exists(select 1 from public.candidates where id=p_candidate and company_id=p_company and not excluido) then raise exception 'Candidato indisponível';end if;
 select * into d from public.resume_documents where id=p_document and company_id=p_company for update;
 if not found or d.stored_at is null then raise exception 'Selecione o arquivo novamente: o original não foi recebido.';end if;
 select id into result from public.resume_jobs where company_id=p_company and request_id=p_request;
 if result is not null then
 if not exists(select 1 from public.resume_jobs where id=result and document_id=d.id) then raise exception 'Solicitação já usada para outro documento';end if;return result;end if;
 select * into j from public.resume_jobs where document_id=d.id order by generation desc limit 1;
 if j.state in ('queued','running','retry_wait') then return j.id;end if;
 if p_mode='normal' and j.id is not null then return j.id;end if;
 if p_mode='retry' and (j.id is null or j.state not in ('failed','blocked')) then raise exception 'Somente leituras que falharam podem ser repetidas.';end if;
 if p_mode not in ('normal','retry','reprocess') then raise exception 'Modo inválido';end if;
 insert into public.resume_jobs(company_id,document_id,candidate_id,requested_by,request_id,generation)
 values(p_company,d.id,p_candidate,p_actor,p_request,coalesce(j.generation,0)+1) returning id into result;
 update public.resume_documents set state='uploaded',error_message=null,finished_at=null,updated_at=now() where id=d.id;
 update public.candidates set processing_status='processando',processing_error=null where id=p_candidate and active_document_id=d.id;
 return result;
end $$;

create or replace function private.enqueue_resume(p_actor uuid,p_company uuid,p_candidate uuid,p_mode text,p_request uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare d uuid;
begin
 select active_document_id into d from public.candidates where id=p_candidate and company_id=p_company and not excluido;
 return private.enqueue_document(p_actor,p_company,d,p_mode,p_request);
end $$;

create or replace function private.queue_received_resume() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.stored_at is not null and old.stored_at is null and new.state='uploaded' then
  perform private.activate_document(new.company_id,new.id,new.uploaded_by,'received');
  perform private.enqueue_document(new.uploaded_by,new.company_id,new.id,'normal',new.id);
  update public.resume_batch_entries e set state='received',message=null,updated_at=now() from public.resume_batch_items i
   where i.document_id=new.id and e.batch_id=i.batch_id and e.slot=i.slot and e.state<>'cancelled';
 end if;return new;
end $$;

create or replace function private.control_resume_job(p_company uuid,p_job uuid,p_action text) returns uuid
language plpgsql security definer set search_path='' as $$
declare j public.resume_jobs;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão' using errcode='42501';end if;
 select * into j from public.resume_jobs where id=p_job and company_id=p_company for update;
 if not found then raise exception 'Trabalho indisponível';end if;
 if p_action='cancel' then
  if j.state not in ('queued','retry_wait') then raise exception 'Somente trabalhos aguardando início podem ser cancelados.';end if;
  update public.resume_jobs set state='cancelled',phase='done',message='Cancelado pela equipe.',finished_at=now(),updated_at=now() where id=j.id;
  update public.resume_documents set state='error',error_message='Leitura cancelada pela equipe.',updated_at=now() where id=j.document_id;
  update public.candidates set processing_status='erro',processing_error='Leitura cancelada pela equipe.' where id=j.candidate_id and active_document_id=j.document_id;
  return j.id;
 elsif p_action='retry' then
  return private.enqueue_document(auth.uid(),p_company,j.document_id,'retry',gen_random_uuid());
 else raise exception 'Ação inválida';end if;
end $$;

create or replace function public.claim_resume_jobs() returns setof public.resume_jobs
language plpgsql security invoker set search_path='' as $$
declare company record; j public.resume_jobs; active integer; taken integer:=0;
begin
 update public.resume_batch_entries e set state='missing',message='Arquivo não recebido. Selecione-o novamente.',updated_at=now()
 from public.resume_batches b where b.id=e.batch_id and e.state='waiting' and b.created_at<now()-interval '1 hour';
 for company in select c.id from public.companies c where exists(select 1 from public.resume_jobs q where q.company_id=c.id and
  ((q.state in ('queued','retry_wait') and q.available_at<=now()) or (q.state='running' and q.lease_until<now())))
 order by (select min(q.available_at) from public.resume_jobs q where q.company_id=c.id and q.state in ('queued','retry_wait','running'))
 for update of c skip locked loop
  for j in select * from public.resume_jobs where company_id=company.id and state='running' and lease_until<now() for update loop
   update public.resume_job_attempts set finished_at=now(),outcome='interrupted',error_kind='interrupted',message='Processo interrompido; reserva expirada.' where job_id=j.id and attempt=j.attempts;
   update public.resume_jobs set state=case when attempts<3 then 'retry_wait' else 'failed' end,phase='queued',
    available_at=now()+case when attempts=1 then interval '1 minute' else interval '5 minutes' end,
    lease_token=null,lease_until=null,error_kind='interrupted',message='Leitura interrompida pelo sistema.',
    finished_at=case when attempts=3 then now() else null end,updated_at=now() where id=j.id;
   update public.resume_documents set state=case when j.attempts<3 then 'uploaded' else 'error' end,error_message='Leitura interrompida pelo sistema.',updated_at=now() where id=j.document_id;
   update public.candidates set processing_status=case when j.attempts<3 then 'processando' else 'erro' end,processing_error='Leitura interrompida pelo sistema.' where id=j.candidate_id and active_document_id=j.document_id;
  end loop;
  select count(*) into active from public.resume_jobs where company_id=company.id and state='running';
  for j in select * from public.resume_jobs where company_id=company.id and state in ('queued','retry_wait') and available_at<=now()
   order by available_at,created_at for update skip locked loop
   exit when active>=2 or taken>=2;
   if not exists(select 1 from public.company_members where company_id=j.company_id and user_id=j.requested_by and role in ('owner','admin','recruiter')) or
      not exists(select 1 from public.candidates where id=j.candidate_id and not excluido) then
    update public.resume_jobs set state='cancelled',phase='done',error_kind='authorization',message='Acesso retirado ou candidato arquivado.',finished_at=now(),updated_at=now() where id=j.id;
    continue;
   end if;
   update public.resume_jobs set state='running',phase='downloading',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '4 minutes',started_at=now(),finished_at=null,updated_at=now() where id=j.id returning * into j;
   insert into public.resume_job_attempts(job_id,attempt) values(j.id,j.attempts);
   update public.resume_documents set state='reading',ai_started_at=now(),updated_at=now() where id=j.document_id;
   active:=active+1;taken:=taken+1;return next j;
  end loop;
  exit when taken>=2;
 end loop;
end $$;

create or replace function private.settle_resume_job_trusted(p_job uuid,p_token uuid,p_outcome text,p_extraction jsonb default '{}',p_kind text default null,p_message text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.resume_jobs; final_state text;
begin
 select * into j from public.resume_jobs where id=p_job;
 if not found then return false;end if;
 perform 1 from public.companies where id=j.company_id for update;
 select * into j from public.resume_jobs where id=p_job and state='running' and lease_token=p_token and lease_until>now() for update;
 if not found then return false;end if;
 if not exists(select 1 from public.company_members where company_id=j.company_id and user_id=j.requested_by and role in ('owner','admin','recruiter')) or
    not exists(select 1 from public.candidates where id=j.candidate_id and not excluido) then
  final_state:='cancelled';p_kind:='authorization';p_message:='Acesso retirado ou candidato arquivado.';
 elsif p_outcome in ('succeeded','review') then
  update public.resume_documents set latest_extraction=p_extraction where id=j.document_id;
  if exists(select 1 from public.candidates where id=j.candidate_id and active_document_id=j.document_id) then
   perform public.save_candidate_extraction(j.requested_by,j.company_id,j.candidate_id,p_extraction,case when p_outcome='succeeded' then 'concluido' else 'revisao_manual' end);
  end if;
  final_state:=p_outcome;
 elsif p_outcome='error' and p_kind in ('transient','permanent','configuration','authorization','interrupted') then
  final_state:=case when p_kind in ('transient','interrupted') and j.attempts<3 then 'retry_wait' when p_kind='configuration' then 'blocked' when p_kind='permanent' then 'review' when p_kind='authorization' then 'cancelled' else 'failed' end;
  update public.candidates set processing_status=case when final_state='retry_wait' then 'processando' when final_state='review' then 'revisao_manual' else 'erro' end,processing_error=left(p_message,500) where id=j.candidate_id and active_document_id=j.document_id;
 else raise exception 'Resultado inválido';end if;
 update public.resume_jobs set state=final_state,phase=case when final_state='retry_wait' then 'queued' else 'done' end,
  available_at=now()+case when j.attempts=1 then interval '1 minute' else interval '5 minutes' end,
  error_kind=p_kind,message=left(p_message,500),lease_token=null,lease_until=null,
  finished_at=case when final_state='retry_wait' then null else now() end,updated_at=now() where id=j.id;
 update public.resume_job_attempts set outcome=final_state,error_kind=p_kind,message=left(p_message,500),finished_at=now() where job_id=j.id and attempt=j.attempts;
 update public.resume_documents set state=case when final_state='succeeded' then 'completed' when final_state='review' then 'review' when final_state='retry_wait' then 'uploaded' else 'error' end,
  error_message=left(p_message,500),finished_at=case when final_state='retry_wait' then null else now() end,updated_at=now() where id=j.document_id;
 return true;
end $$;

create or replace function private.sync_resume_cancellation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.state='cancelled' and old.state is distinct from new.state then
  update public.resume_documents set state='error',error_message=coalesce(new.message,'Leitura cancelada.'),finished_at=now(),updated_at=now() where id=new.document_id;
  update public.candidates set processing_status='erro',processing_error=coalesce(new.message,'Leitura cancelada.') where id=new.candidate_id and company_id=new.company_id and active_document_id=new.document_id;
 end if;
 return new;
end $$;

create or replace function public.claim_resume_cleanup(p_actor uuid,p_company uuid)
returns table(document_id uuid,object_path text) language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
 update public.resume_documents set state='review',error_message='A leitura foi interrompida. Revise os dados; não haverá nova cobrança automática.',updated_at=now()
 where company_id=p_company and not exists(select 1 from public.resume_jobs q where q.document_id=resume_documents.id) and state='reading' and updated_at<now()-interval '1 hour';
 update public.candidates c set processing_status='revisao_manual',processing_error=d.error_message
 from public.resume_documents d where c.id=d.candidate_id and c.active_document_id=d.id and d.company_id=p_company and d.state='review' and d.finished_at is null;
 return query with stale as (
  select d.id from public.resume_documents d where d.company_id=p_company and not exists(select 1 from public.resume_jobs q where q.document_id=d.id) and (d.state in ('receiving','cleaning') or (d.state='error' and d.ai_started_at is null and exists(select 1 from storage.objects o where o.bucket_id='resumes' and o.name=d.object_path)))
   and d.updated_at<now()-interval '1 hour' order by d.updated_at limit 50 for update skip locked
 ), claimed as (
  update public.resume_documents d set state='cleaning',updated_at=now() from stale s where d.id=s.id returning d.id,d.object_path
 ) select x.id,x.object_path from claimed x;
 return query select null::uuid,o.name from storage.objects o where o.bucket_id='resumes' and starts_with(o.name,p_company::text||'/')
 and o.created_at<now()-interval '1 hour'
 and not exists(select 1 from public.candidates c where c.arquivo_original_path=o.name)
 and not exists(select 1 from public.resume_documents d where d.object_path=o.name)
 and not exists(select 1 from private.legacy_records l where l.original_object_path=o.name) limit 50;
end $$;

create or replace function public.finish_resume_cleanup(p_company uuid,p_document uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.resume_documents set state='error',error_message='Envio interrompido; arquivo temporário removido. Selecione o arquivo novamente.',updated_at=now()
 where id=p_document and company_id=p_company and state='cleaning';
 update public.candidates c set processing_status='erro',processing_error=d.error_message from public.resume_documents d
 where d.id=p_document and d.company_id=p_company and c.id=d.candidate_id and c.active_document_id=d.id and d.state='error';
end $$;

revoke all on function private.enqueue_document(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.enqueue_document(uuid,uuid,uuid,text,uuid) to service_role;

create function public.request_document_analysis(p_company uuid,p_document uuid,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin return private.enqueue_document(auth.uid(),p_company,p_document,'reprocess',p_request);end $$;
revoke all on function public.request_document_analysis(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_document_analysis(uuid,uuid,uuid) to authenticated;

-- Exact contacts suggest review, never prove identity. Names are not matching keys.
create index candidates_email_identity on public.candidates(company_id,lower(btrim(email))) where not excluido;
create index candidates_phone_identity on public.candidates(company_id,regexp_replace(telefone,'[^0-9]','','g')) where not excluido;
create function public.suggest_candidate_duplicates(p_company uuid,p_candidate uuid)
returns table(candidate_id uuid,nome text,email text,telefone text,review_version bigint,reasons text[])
language sql stable security invoker set search_path='' as $$
 select c.id,c.nome,c.email,c.telefone,c.review_version,
 array_remove(array[
  case when length(btrim(s.email))>3 and lower(btrim(c.email))=lower(btrim(s.email)) then 'E-mail idêntico' end,
  case when length(regexp_replace(s.telefone,'[^0-9]','','g'))>=7 and regexp_replace(c.telefone,'[^0-9]','','g')=regexp_replace(s.telefone,'[^0-9]','','g') then 'Telefone idêntico' end],null)
 from public.candidates s join public.candidates c on c.company_id=s.company_id and c.id<>s.id and not c.excluido
 where s.company_id=p_company and s.id=p_candidate and not s.excluido
 and ((length(btrim(s.email))>3 and lower(btrim(c.email))=lower(btrim(s.email))) or
 (length(regexp_replace(s.telefone,'[^0-9]','','g'))>=7 and regexp_replace(c.telefone,'[^0-9]','','g')=regexp_replace(s.telefone,'[^0-9]','','g')))
 order by c.id limit 30
$$;

create table public.candidate_job_links (
 company_id uuid not null,candidate_id uuid not null,job_id uuid not null,
 active boolean not null default true,created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(company_id,candidate_id,job_id),
 foreign key(company_id,candidate_id) references public.candidates(company_id,id),
 foreign key(company_id,job_id) references public.jobs(company_id,id)
);
create index candidate_job_links_job on public.candidate_job_links(company_id,job_id);
create index candidate_job_links_creator on public.candidate_job_links(created_by);
create index candidate_job_links_editor on public.candidate_job_links(updated_by);
create table public.candidate_link_events (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,candidate_id uuid not null,job_id uuid not null,
 actor_id uuid references auth.users(id) on delete set null,active boolean not null,created_at timestamptz not null default now(),
 foreign key(company_id,candidate_id,job_id) references public.candidate_job_links(company_id,candidate_id,job_id)
);
create index link_events_link on public.candidate_link_events(company_id,candidate_id,job_id);
create index link_events_actor on public.candidate_link_events(actor_id);
alter table public.candidate_job_links enable row level security;
alter table public.candidate_link_events enable row level security;
revoke all on public.candidate_job_links,public.candidate_link_events from public,anon,authenticated;
grant select on public.candidate_job_links,public.candidate_link_events to authenticated;
grant all on public.candidate_job_links,public.candidate_link_events to service_role;
create policy candidate_links_read on public.candidate_job_links for select to authenticated using(private.has_role(company_id)
 and exists(select 1 from public.candidates c where c.id=candidate_id and not c.excluido)
 and exists(select 1 from public.jobs j where j.id=job_id and not j.excluido));
create policy link_events_read on public.candidate_link_events for select to authenticated using(exists(
 select 1 from public.candidate_job_links l where l.company_id=candidate_link_events.company_id and l.candidate_id=candidate_link_events.candidate_id and l.job_id=candidate_link_events.job_id));
create function public.set_candidate_job_link(p_company uuid,p_candidate uuid,p_job uuid,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$
declare changed boolean;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_active is null or not exists(select 1 from public.candidates where id=p_candidate and company_id=p_company and not excluido)
 or not exists(select 1 from public.jobs where id=p_job and company_id=p_company and not excluido and (not p_active or status='aberta'))
 then raise exception 'Candidato ou vaga indisponível';end if;
 insert into public.candidate_job_links(company_id,candidate_id,job_id,active,created_by,updated_by)
 values(p_company,p_candidate,p_job,p_active,auth.uid(),auth.uid())
 on conflict(company_id,candidate_id,job_id) do update set active=excluded.active,updated_by=auth.uid(),updated_at=now()
 where candidate_job_links.active is distinct from excluded.active;
 changed:=found;
 if changed then insert into public.candidate_link_events(company_id,candidate_id,job_id,actor_id,active) values(p_company,p_candidate,p_job,auth.uid(),p_active);end if;
end $$;

create table public.candidate_merges (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,source_id uuid not null,target_id uuid not null,
 actor_id uuid references auth.users(id) on delete set null,reason text not null check(length(btrim(reason)) between 15 and 1000),
 created_at timestamptz not null default now(),source_snapshot jsonb not null,target_snapshot jsonb not null,source_revisions jsonb not null,
 unique(company_id,source_id),foreign key(company_id,source_id) references public.candidates(company_id,id),
 foreign key(company_id,target_id) references public.candidates(company_id,id),check(source_id<>target_id)
);
create index candidate_merges_target on public.candidate_merges(company_id,target_id);
create index candidate_merges_actor on public.candidate_merges(actor_id);
alter table public.candidate_merges enable row level security;
revoke all on public.candidate_merges from public,anon,authenticated;
grant select on public.candidate_merges to authenticated;grant all on public.candidate_merges to service_role;
create policy candidate_merges_read on public.candidate_merges for select to authenticated using(private.has_role(company_id)
 and exists(select 1 from public.candidates c where c.id=target_id and not c.excluido));
create function public.confirm_candidate_merge(p_company uuid,p_source uuid,p_target uuid,p_source_version bigint,p_target_version bigint,p_reason text,p_confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.candidates;t public.candidates;doc record;link record;n integer;result uuid;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Somente administradores podem reunir cadastros' using errcode='42501';end if;
 if p_confirmed is distinct from true or p_source=p_target or coalesce(length(btrim(p_reason)),0) not between 15 and 1000 then raise exception 'Confira os dois cadastros e registre a justificativa';end if;
 select * into s from public.candidates where company_id=p_company and id=p_source for update;
 select * into t from public.candidates where company_id=p_company and id=p_target and not excluido for update;
 if s.id is null or t.id is null then raise exception 'Cadastro indisponível';end if;
 select id into result from public.candidate_merges where company_id=p_company and source_id=p_source and target_id=p_target;
 if result is not null then return p_target;end if;
 if s.excluido then raise exception 'Cadastro indisponível';end if;
 if s.review_version is distinct from p_source_version or t.review_version is distinct from p_target_version then raise exception 'Cadastros alterados. Confira novamente.' using errcode='40001';end if;
 if exists(select 1 from public.resume_jobs where company_id=p_company and candidate_id in(p_source,p_target) and state in ('queued','running','retry_wait')) or
 exists(select 1 from public.resume_documents where company_id=p_company and candidate_id in(p_source,p_target) and state in ('receiving','cleaning')) then raise exception 'Aguarde ou cancele os trabalhos pendentes antes de reunir os cadastros';end if;
 insert into public.candidate_merges(company_id,source_id,target_id,actor_id,reason,source_snapshot,target_snapshot,source_revisions)
 values(p_company,p_source,p_target,auth.uid(),btrim(p_reason),to_jsonb(s),to_jsonb(t),coalesce((select jsonb_agg(to_jsonb(r)) from public.candidate_revisions r where r.company_id=p_company and r.candidate_id=p_source),'[]'));
 update public.candidates set active_document_id=null,merged_into_id=p_target,excluido=true,review_version=review_version+1 where id=p_source;
 select coalesce(max(version),0) into n from public.resume_documents where candidate_id=p_target;
 for doc in select id from public.resume_documents where company_id=p_company and candidate_id=p_source order by version loop
  n:=n+1;update public.resume_documents set candidate_id=p_target,version=n where id=doc.id;
 end loop;
 -- Keep the destination's chosen original and corrections; source history is audited above.
 update public.candidates set review_status='pending',review_version=review_version+1,reviewed_by=null,reviewed_at=null where id=p_target;
 for link in select job_id from public.candidate_job_links where company_id=p_company and candidate_id=p_source and active loop
  if exists(select 1 from public.jobs where id=link.job_id and status='aberta' and not excluido) then
   perform public.set_candidate_job_link(p_company,p_target,link.job_id,true);
  end if;
 end loop;
 return p_target;
end $$;

-- Query current effective values at the source, without a 1,000-person browser cap.
create function public.search_candidates(p_company uuid,p_query text default '',p_status text default 'todos',p_offset integer default 0)
returns setof public.candidates language sql stable security invoker set search_path='' as $$
 select c.* from public.candidates c where c.company_id=p_company and not c.excluido
 and (p_status='todos' or c.status=p_status)
 and (btrim(coalesce(p_query,''))='' or position(lower(left(btrim(p_query),200)) in lower(concat_ws(' ',c.nome,c.email,c.telefone,c.localizacao,array_to_string(c.skills,' '))))>0)
 order by c.created_at desc,c.id limit 51 offset greatest(0,coalesce(p_offset,0))
$$;
revoke all on function public.suggest_candidate_duplicates(uuid,uuid),public.set_candidate_job_link(uuid,uuid,uuid,boolean),
 public.confirm_candidate_merge(uuid,uuid,uuid,bigint,bigint,text,boolean),public.search_candidates(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.suggest_candidate_duplicates(uuid,uuid),public.set_candidate_job_link(uuid,uuid,uuid,boolean),
 public.confirm_candidate_merge(uuid,uuid,uuid,bigint,bigint,text,boolean),public.search_candidates(uuid,text,text,integer) to authenticated;
