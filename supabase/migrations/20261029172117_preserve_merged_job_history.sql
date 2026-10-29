alter table public.candidate_merges add column source_relationships jsonb not null default '{}';
create or replace function private.confirm_candidate_merge(p_company uuid,p_source uuid,p_target uuid,p_source_version bigint,p_target_version bigint,p_reason text,p_confirmed boolean) returns uuid
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
 insert into public.candidate_merges(company_id,source_id,target_id,actor_id,reason,source_snapshot,target_snapshot,source_revisions,source_relationships)
 values(p_company,p_source,p_target,auth.uid(),btrim(p_reason),to_jsonb(s),to_jsonb(t),coalesce((select jsonb_agg(to_jsonb(r)) from public.candidate_revisions r where r.company_id=p_company and r.candidate_id=p_source),'[]'),jsonb_build_object(
 'vagas',coalesce((select jsonb_agg(to_jsonb(l)) from public.candidate_job_links l where l.company_id=p_company and l.candidate_id=p_source),'[]'),
 'eventos_vagas',coalesce((select jsonb_agg(to_jsonb(e)) from public.candidate_link_events e where e.company_id=p_company and e.candidate_id=p_source),'[]'),
 'documentos',coalesce((select jsonb_agg(to_jsonb(d)) from public.resume_documents d where d.company_id=p_company and d.candidate_id=p_source),'[]'),
 'eventos_documentos',coalesce((select jsonb_agg(to_jsonb(e)) from public.candidate_document_events e where e.company_id=p_company and e.candidate_id=p_source),'[]')));
 update public.candidates set active_document_id=null,merged_into_id=p_target,excluido=true,review_version=review_version+1 where id=p_source;
 select coalesce(max(version),0) into n from public.resume_documents where candidate_id=p_target;
 for doc in select id from public.resume_documents where company_id=p_company and candidate_id=p_source order by version loop
  n:=n+1;update public.resume_documents set candidate_id=p_target,version=n where id=doc.id;
 end loop;
 -- Keep the destination's chosen original and corrections; source history is audited above.
 update public.candidates set review_status='pending',review_version=review_version+1,reviewed_by=null,reviewed_at=null where id=p_target;
 for link in select job_id from public.candidate_job_links where company_id=p_company and candidate_id=p_source and active loop
  -- This is a verified identity transfer, not a new application to a closed job.
  insert into public.candidate_job_links(company_id,candidate_id,job_id,active,created_by,updated_by)
   values(p_company,p_target,link.job_id,true,auth.uid(),auth.uid())
   on conflict(company_id,candidate_id,job_id) do update set active=true,updated_by=auth.uid(),updated_at=now()
   where not candidate_job_links.active;
  if found then insert into public.candidate_link_events(company_id,candidate_id,job_id,actor_id,active)
   values(p_company,p_target,link.job_id,auth.uid(),true);end if;
 end loop;
 return p_target;
end $$;
