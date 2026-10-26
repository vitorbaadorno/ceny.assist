create or replace function public.claim_resume_cleanup(p_actor uuid,p_company uuid)
returns table(document_id uuid,object_path text) language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
 update public.resume_documents set state='review',error_message='A leitura foi interrompida. Revise os dados; não haverá nova cobrança automática.',updated_at=now()
 where company_id=p_company and state='reading' and updated_at<now()-interval '1 hour';
 update public.candidates c set processing_status='revisao_manual',processing_error=d.error_message
 from public.resume_documents d where c.id=d.candidate_id and d.company_id=p_company and d.state='review' and d.finished_at is null;
 return query with stale as (
  select d.id from public.resume_documents d where d.company_id=p_company and (d.state in ('receiving','cleaning') or (d.state='error' and d.ai_started_at is null and exists(select 1 from storage.objects o join public.candidates c on c.arquivo_original_path=o.name where o.bucket_id='resumes' and c.id=d.candidate_id)))
   and d.updated_at<now()-interval '1 hour' order by d.updated_at limit 50 for update skip locked
 ), claimed as (
  update public.resume_documents d set state='cleaning',updated_at=now() from stale s where d.id=s.id returning d.id,d.candidate_id
 ) select x.id,c.arquivo_original_path from claimed x join public.candidates c on c.id=x.candidate_id;
 return query select null::uuid,o.name from storage.objects o where o.bucket_id='resumes' and starts_with(o.name,p_company::text||'/')
 and o.created_at<now()-interval '1 hour'
 and not exists(select 1 from public.candidates c where c.arquivo_original_path=o.name)
 and not exists(select 1 from private.legacy_records l where l.original_object_path=o.name) limit 50;
end $$;
