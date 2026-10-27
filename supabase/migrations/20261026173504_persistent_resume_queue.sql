create table public.resume_jobs (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 document_id uuid not null references public.resume_documents(id), candidate_id uuid not null,
 requested_by uuid references auth.users(id) on delete set null, request_id uuid not null,
 generation integer not null check(generation>0),
 state text not null default 'queued' check(state in ('queued','running','retry_wait','succeeded','review','failed','blocked','cancelled')),
 phase text not null default 'queued', attempts integer not null default 0 check(attempts between 0 and 3),
 available_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz,
 error_kind text check(error_kind in ('transient','permanent','configuration','authorization','interrupted')), message text,
 created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz, updated_at timestamptz not null default now(),
 unique(document_id,generation),unique(company_id,request_id),
 foreign key(company_id,candidate_id) references public.candidates(company_id,id)
);
create unique index resume_jobs_one_active on public.resume_jobs(document_id) where state in ('queued','running','retry_wait');
create index resume_jobs_ready on public.resume_jobs(available_at,company_id) where state in ('queued','retry_wait');
create index resume_jobs_leases on public.resume_jobs(company_id,lease_until) where state='running';
create index resume_jobs_candidate on public.resume_jobs(company_id,candidate_id,created_at desc);
create index resume_jobs_actor on public.resume_jobs(requested_by);
create table public.resume_job_attempts (
 job_id uuid not null references public.resume_jobs(id), attempt integer not null,
 started_at timestamptz not null default now(), finished_at timestamptz,
 outcome text not null default 'running', error_kind text, message text, primary key(job_id,attempt)
);
create table public.resume_batch_entries (
 batch_id uuid not null references public.resume_batches(id), slot integer not null check(slot between 0 and 4),
 filename text not null check(length(filename) between 1 and 180),
 state text not null default 'waiting' check(state in ('waiting','received','rejected','missing','cancelled')),
 message text, updated_at timestamptz not null default now(), primary key(batch_id,slot)
);
alter table public.resume_jobs enable row level security;
alter table public.resume_job_attempts enable row level security;
alter table public.resume_batch_entries enable row level security;
revoke all on public.resume_jobs,public.resume_job_attempts,public.resume_batch_entries from public,anon,authenticated;
grant select on public.resume_jobs,public.resume_job_attempts,public.resume_batch_entries to authenticated;
grant all on public.resume_jobs,public.resume_job_attempts,public.resume_batch_entries to service_role;
create policy jobs_read on public.resume_jobs for select to authenticated using(private.has_role(company_id) and exists(select 1 from public.candidates c where c.id=candidate_id and not c.excluido));
create policy attempts_read on public.resume_job_attempts for select to authenticated using(exists(select 1 from public.resume_jobs j where j.id=job_id));
create policy entries_read on public.resume_batch_entries for select to authenticated using(exists(select 1 from public.resume_batches b where b.id=batch_id));

create function private.begin_resume_batch_files(p_company uuid,p_source text,p_files jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; f jsonb; n integer:=0;
begin
 if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files) not between 1 and 5 then raise exception 'Selecione de 1 a 5 arquivos.';end if;
 result:=private.begin_resume_batch(p_company,jsonb_array_length(p_files),p_source);
 for f in select value from jsonb_array_elements(p_files) loop
  insert into public.resume_batch_entries(batch_id,slot,filename) values(result,n,f->>'name');n:=n+1;
 end loop;return result;
end $$;
create function public.begin_resume_batch_files(p_company uuid,p_source text,p_files jsonb) returns uuid
language sql security invoker set search_path='' as $$select private.begin_resume_batch_files(p_company,p_source,p_files)$$;

-- Called only by trusted upload code. A cancellation cannot be overwritten by a late request.
create function public.record_resume_entry(p_actor uuid,p_company uuid,p_batch uuid,p_slot integer,p_filename text,p_state text,p_message text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare b public.resume_batches;
begin
 perform 1 from public.companies where id=p_company for update;
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter')) then raise exception 'Acesso revogado';end if;
 select * into b from public.resume_batches where id=p_batch and company_id=p_company and uploaded_by=p_actor;
 if not found or p_slot<0 or p_slot>=b.file_count or p_state not in ('received','rejected') then raise exception 'Lote inválido';end if;
 insert into public.resume_batch_entries(batch_id,slot,filename,state,message) values(p_batch,p_slot,p_filename,p_state,left(p_message,500))
 on conflict(batch_id,slot) do update set state=excluded.state,message=excluded.message,updated_at=now()
 where resume_batch_entries.state not in ('cancelled','received');
end $$;

create function private.enqueue_resume(p_actor uuid,p_company uuid,p_candidate uuid,p_mode text,p_request uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare d public.resume_documents; j public.resume_jobs; result uuid;
begin
 perform 1 from public.companies where id=p_company for update;
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter')) then raise exception 'Sem permissão para leitura.' using errcode='42501';end if;
 if not exists(select 1 from public.candidates where id=p_candidate and company_id=p_company and not excluido) then raise exception 'Candidato indisponível';end if;
 select * into d from public.resume_documents where candidate_id=p_candidate and company_id=p_company for update;
 if not found or d.stored_at is null then raise exception 'Selecione o arquivo novamente: o original não foi recebido.';end if;
 select id into result from public.resume_jobs where company_id=p_company and request_id=p_request;
 if result is not null then return result;end if;
 select * into j from public.resume_jobs where document_id=d.id order by generation desc limit 1;
 if j.state in ('queued','running','retry_wait') then return j.id;end if;
 if p_mode='normal' and j.id is not null then return j.id;end if;
 if p_mode='retry' and (j.id is null or j.state not in ('failed','blocked')) then raise exception 'Somente leituras que falharam podem ser repetidas.';end if;
 if p_mode not in ('normal','retry','reprocess') then raise exception 'Modo inválido';end if;
 insert into public.resume_jobs(company_id,document_id,candidate_id,requested_by,request_id,generation)
 values(p_company,d.id,p_candidate,p_actor,p_request,coalesce(j.generation,0)+1) returning id into result;
 update public.resume_documents set state='uploaded',error_message=null,finished_at=null,updated_at=now() where id=d.id;
 update public.candidates set processing_status='processando',processing_error=null where id=p_candidate;
 return result;
end $$;
create function private.request_resume_job(p_company uuid,p_candidate uuid,p_mode text,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin return private.enqueue_resume(auth.uid(),p_company,p_candidate,p_mode,p_request);end $$;
create function public.request_resume_job(p_company uuid,p_candidate uuid,p_mode text,p_request uuid) returns uuid
language sql security invoker set search_path='' as $$select private.request_resume_job(p_company,p_candidate,p_mode,p_request)$$;

create function private.queue_received_resume() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.stored_at is not null and old.stored_at is null and new.state='uploaded' then
  perform private.enqueue_resume(new.uploaded_by,new.company_id,new.candidate_id,'normal',new.id);
  update public.resume_batch_entries e set state='received',message=null,updated_at=now() from public.resume_batch_items i
   where i.document_id=new.id and e.batch_id=i.batch_id and e.slot=i.slot and e.state<>'cancelled';
 end if;return new;
end $$;
create trigger queue_received_resume after update of stored_at on public.resume_documents for each row execute function private.queue_received_resume();

create function private.control_resume_job(p_company uuid,p_job uuid,p_action text) returns uuid
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
  update public.candidates set processing_status='erro',processing_error='Leitura cancelada pela equipe.' where id=j.candidate_id;
  return j.id;
 elsif p_action='retry' then
  return private.enqueue_resume(auth.uid(),p_company,j.candidate_id,'retry',gen_random_uuid());
 else raise exception 'Ação inválida';end if;
end $$;
create function public.control_resume_job(p_company uuid,p_job uuid,p_action text) returns uuid
language sql security invoker set search_path='' as $$select private.control_resume_job(p_company,p_job,p_action)$$;
create function private.control_resume_batch(p_company uuid,p_batch uuid,p_action text) returns integer
language plpgsql security definer set search_path='' as $$
declare j record; n integer:=0;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão' using errcode='42501';end if;
 if not exists(select 1 from public.resume_batches where id=p_batch and company_id=p_company) then raise exception 'Lote indisponível';end if;
 if p_action not in ('retry','cancel') then raise exception 'Ação inválida';end if;
 for j in select distinct on (q.document_id) q.* from public.resume_jobs q join public.resume_batch_items i on i.document_id=q.document_id
  where i.batch_id=p_batch and q.company_id=p_company order by q.document_id,q.generation desc loop
  if (p_action='retry' and j.state in ('failed','blocked')) or (p_action='cancel' and j.state in ('queued','retry_wait')) then
   perform private.control_resume_job(p_company,j.id,p_action);n:=n+1;
  end if;
 end loop;
 if p_action='cancel' then update public.resume_batch_entries set state='cancelled',message='Envio cancelado antes do recebimento.',updated_at=now() where batch_id=p_batch and state='waiting';end if;
 return n;
end $$;
create function public.control_resume_batch(p_company uuid,p_batch uuid,p_action text) returns integer
language sql security invoker set search_path='' as $$select private.control_resume_batch(p_company,p_batch,p_action)$$;

-- Recovery and acquisition are serialized by company; no database lock spans AI I/O.
create function public.claim_resume_jobs() returns setof public.resume_jobs
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
   update public.candidates set processing_status=case when j.attempts<3 then 'processando' else 'erro' end,processing_error='Leitura interrompida pelo sistema.' where id=j.candidate_id;
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

create function public.advance_resume_job(p_job uuid,p_token uuid,p_phase text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.resume_jobs;
begin
 select * into j from public.resume_jobs where id=p_job;
 if not found then return false;end if;
 perform 1 from public.companies where id=j.company_id for update;
 update public.resume_jobs set phase=p_phase,updated_at=now() where id=p_job and lease_token=p_token and state='running' and lease_until>now()
 and exists(select 1 from public.company_members m where m.company_id=j.company_id and m.user_id=j.requested_by and m.role in ('owner','admin','recruiter'))
 and exists(select 1 from public.candidates c where c.id=j.candidate_id and not c.excluido);
 return found;
end $$;

create function public.settle_resume_job(p_job uuid,p_token uuid,p_outcome text,p_extraction jsonb default '{}',p_kind text default null,p_message text default null)
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
  perform public.save_candidate_extraction(j.requested_by,j.company_id,j.candidate_id,p_extraction,case when p_outcome='succeeded' then 'concluido' else 'revisao_manual' end);
  final_state:=p_outcome;
 elsif p_outcome='error' and p_kind in ('transient','permanent','configuration','authorization','interrupted') then
  final_state:=case when p_kind in ('transient','interrupted') and j.attempts<3 then 'retry_wait' when p_kind='configuration' then 'blocked' when p_kind='permanent' then 'review' when p_kind='authorization' then 'cancelled' else 'failed' end;
  update public.candidates set processing_status=case when final_state='retry_wait' then 'processando' when final_state='review' then 'revisao_manual' else 'erro' end,processing_error=left(p_message,500) where id=j.candidate_id;
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

-- Superseded synchronous processing entrypoints must not bypass the persistent queue.
revoke execute on function public.claim_resume_extraction(uuid,uuid,uuid),public.finish_resume_extraction(uuid,uuid,uuid,uuid,jsonb,text,text) from service_role;
revoke all on function private.begin_resume_batch_files(uuid,text,jsonb),private.enqueue_resume(uuid,uuid,uuid,text,uuid),private.request_resume_job(uuid,uuid,text,uuid),private.queue_received_resume(),private.control_resume_job(uuid,uuid,text),private.control_resume_batch(uuid,uuid,text),
 public.begin_resume_batch_files(uuid,text,jsonb),public.request_resume_job(uuid,uuid,text,uuid),public.control_resume_job(uuid,uuid,text),public.control_resume_batch(uuid,uuid,text),
 public.record_resume_entry(uuid,uuid,uuid,integer,text,text,text),public.claim_resume_jobs(),public.advance_resume_job(uuid,uuid,text),public.settle_resume_job(uuid,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function private.begin_resume_batch_files(uuid,text,jsonb),private.request_resume_job(uuid,uuid,text,uuid),private.control_resume_job(uuid,uuid,text),private.control_resume_batch(uuid,uuid,text),
 public.begin_resume_batch_files(uuid,text,jsonb),public.request_resume_job(uuid,uuid,text,uuid),public.control_resume_job(uuid,uuid,text),public.control_resume_batch(uuid,uuid,text) to authenticated;
grant execute on function private.enqueue_resume(uuid,uuid,uuid,text,uuid),public.record_resume_entry(uuid,uuid,uuid,integer,text,text,text),public.claim_resume_jobs(),public.advance_resume_job(uuid,uuid,text),public.settle_resume_job(uuid,uuid,text,jsonb,text,text) to service_role;

alter function public.reserve_resume(uuid,uuid,uuid,integer,text,text,text,integer,integer) rename to reserve_resume_validated;
create function public.reserve_resume(p_actor uuid,p_company uuid,p_batch uuid,p_slot integer,p_sha text,p_filename text,p_mime text,p_size integer,p_pages integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.companies where id=p_company for update;
 if exists(select 1 from public.resume_batch_entries where batch_id=p_batch and slot=p_slot and state='cancelled') then raise exception 'Envio cancelado.';end if;
 return public.reserve_resume_validated(p_actor,p_company,p_batch,p_slot,p_sha,p_filename,p_mime,p_size,p_pages);
end $$;
revoke all on function public.reserve_resume(uuid,uuid,uuid,integer,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_resume(uuid,uuid,uuid,integer,text,text,text,integer,integer) to service_role;
create or replace function public.finish_resume_upload(p_actor uuid,p_company uuid,p_document uuid,p_token uuid,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.companies where id=p_company for update;
 if p_error is null and exists(select 1 from public.resume_batch_items i join public.resume_batch_entries e on e.batch_id=i.batch_id and e.slot=i.slot where i.document_id=p_document and e.state='cancelled') and not exists(select 1 from public.resume_batch_items i join public.resume_batch_entries e on e.batch_id=i.batch_id and e.slot=i.slot where i.document_id=p_document and e.state<>'cancelled') then raise exception 'Envio cancelado.';end if;
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
 update public.resume_documents set state=case when p_error is null then 'uploaded' else 'error' end,
  stored_at=case when p_error is null then now() else null end,error_message=p_error,updated_at=now()
 where id=p_document and company_id=p_company and state='receiving' and operation_token=p_token;
 if not found then raise exception 'Envio não está mais ativo'; end if;
end $$;
