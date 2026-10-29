create or replace function public.reserve_resume_version(p_actor uuid,p_company uuid,p_batch uuid,p_slot integer,p_sha text,p_filename text,p_mime text,p_size integer,p_pages integer,p_candidate uuid default null)
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
  -- Keep a manifest reference to the existing document without moving its owner.
  insert into public.resume_batch_items values(p_batch,p_slot,d.id) on conflict do nothing;
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

create or replace function public.claim_resume_cleanup(p_actor uuid,p_company uuid)
returns table(document_id uuid,object_path text) language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.companies where id=p_company for update;
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

create or replace function public.begin_ranking(p_actor uuid,p_company uuid,p_job uuid,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.jobs;r public.ranking_runs;
begin
 perform 1 from public.companies where id=p_company for update;
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter')) then raise exception 'Sem permissão' using errcode='42501';end if;
 select * into r from public.ranking_runs where company_id=p_company and job_id=p_job and request_id=p_request for update;
 if found then
  if r.actor_id is distinct from p_actor then raise exception 'Solicitação de outro usuário' using errcode='42501';end if;
  if r.status='failed' then raise exception 'Inicie um novo cálculo' using errcode='40001';end if;
  return to_jsonb(r);
 end if;
 select * into j from public.jobs where company_id=p_company and id=p_job and not excluido for update;
 if not found then raise exception 'Vaga indisponível' using errcode='42501';end if;
 if j.status<>'aberta' or j.approved_hash is null then raise exception 'Aprove e reabra a vaga' using errcode='22023';end if;
 perform private.validate_job_payload(private.job_payload(j.titulo,coalesce(j.descricao,''),j.categoria,j.criteria),true);
 update public.ranking_runs set status='failed' where job_id=p_job and status='processing' and expires_at<clock_timestamp();
 if exists(select 1 from public.ranking_runs where job_id=p_job and status='processing') then raise exception 'Já existe um cálculo em andamento' using errcode='55000';end if;
 insert into public.ranking_runs(company_id,job_id,request_id,actor_id,job_snapshot) values(p_company,p_job,p_request,p_actor,to_jsonb(j)) returning * into r;
 insert into public.ranking_entries(company_id,run_id,candidate_id,snapshot,documents,reason)
 select p_company,r.id,c.id,to_jsonb(c),coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'sha256',d.sha256,'filename',d.filename,'state',d.state,'version',d.version,'selected',d.id=c.active_document_id,'analysis_id',(select q.id from public.resume_jobs q where q.document_id=d.id and q.state in ('succeeded','review') order by q.generation desc limit 1))) from public.resume_documents d where d.company_id=p_company and d.candidate_id=c.id),'[]'),
 case when c.processing_status='erro' then 'A leitura falhou. Corrija ou reprocesse o currículo.' when c.processing_status not in ('concluido','revisao_manual') then 'O currículo ainda precisa de processamento.' when c.review_status<>'completed' then 'A revisão humana ainda não foi concluída.' else null end
 from public.candidates c where c.company_id=p_company and not c.excluido;
 update public.ranking_runs set total=(select count(*) from public.ranking_entries where run_id=r.id),eligible=(select count(*) from public.ranking_entries where run_id=r.id and reason is null) where id=r.id returning * into r;
 return to_jsonb(r);
end $$;
