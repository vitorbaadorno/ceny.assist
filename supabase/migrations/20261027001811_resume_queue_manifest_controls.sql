create function private.reject_resume_entry(p_company uuid,p_batch uuid,p_slot integer,p_message text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) or not exists(select 1 from public.resume_batches where id=p_batch and company_id=p_company and uploaded_by=auth.uid()) then raise exception 'Sem permissão' using errcode='42501';end if;
 update public.resume_batch_entries set state='rejected',message=left(p_message,500),updated_at=now()
 where batch_id=p_batch and slot=p_slot and state='waiting' and not exists(select 1 from public.resume_batch_items i where i.batch_id=p_batch and i.slot=p_slot);
end $$;
create or replace function public.claim_resume_cleanup(p_actor uuid,p_company uuid)
returns table(document_id uuid,object_path text) language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
 update public.resume_documents set state='review',error_message='A leitura foi interrompida. Revise os dados; não haverá nova cobrança automática.',updated_at=now()
 where company_id=p_company and not exists(select 1 from public.resume_jobs q where q.document_id=resume_documents.id) and state='reading' and updated_at<now()-interval '1 hour';
 update public.candidates c set processing_status='revisao_manual',processing_error=d.error_message
 from public.resume_documents d where c.id=d.candidate_id and d.company_id=p_company and d.state='review' and d.finished_at is null;
 return query with stale as (
  select d.id from public.resume_documents d where d.company_id=p_company and not exists(select 1 from public.resume_jobs q where q.document_id=d.id) and (d.state in ('receiving','cleaning') or (d.state='error' and d.ai_started_at is null and exists(select 1 from storage.objects o join public.candidates c on c.arquivo_original_path=o.name where o.bucket_id='resumes' and c.id=d.candidate_id)))
   and d.updated_at<now()-interval '1 hour' order by d.updated_at limit 50 for update skip locked
 ), claimed as (
  update public.resume_documents d set state='cleaning',updated_at=now() from stale s where d.id=s.id returning d.id,d.candidate_id
 ) select x.id,c.arquivo_original_path from claimed x join public.candidates c on c.id=x.candidate_id;
 return query select null::uuid,o.name from storage.objects o where o.bucket_id='resumes' and starts_with(o.name,p_company::text||'/')
 and o.created_at<now()-interval '1 hour'
 and not exists(select 1 from public.candidates c where c.arquivo_original_path=o.name)
 and not exists(select 1 from private.legacy_records l where l.original_object_path=o.name) limit 50;
end $$;
create function public.reject_resume_entry(p_company uuid,p_batch uuid,p_slot integer,p_message text) returns void
language sql security invoker set search_path='' as $$select private.reject_resume_entry(p_company,p_batch,p_slot,p_message)$$;
revoke all on function private.reject_resume_entry(uuid,uuid,integer,text),public.reject_resume_entry(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function private.reject_resume_entry(uuid,uuid,integer,text),public.reject_resume_entry(uuid,uuid,integer,text) to authenticated;

-- Every queued document belongs to the same company and candidate as its job.
alter table public.resume_documents add constraint resume_documents_job_identity unique(company_id,id,candidate_id);
alter table public.resume_jobs add constraint resume_jobs_document_identity foreign key(company_id,document_id,candidate_id) references public.resume_documents(company_id,id,candidate_id);

-- Existing accepted originals join the queue; no files are resent or copied.
do $$ declare d record;begin
 for d in select * from public.resume_documents where state='uploaded' and stored_at is not null and uploaded_by is not null loop
  if exists(select 1 from public.company_members where company_id=d.company_id and user_id=d.uploaded_by and role in ('owner','admin','recruiter')) then
   perform private.enqueue_resume(d.uploaded_by,d.company_id,d.candidate_id,'normal',d.id);
  end if;
 end loop;
end $$;
