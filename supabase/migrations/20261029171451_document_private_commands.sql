-- Expose invoker wrappers; privileged implementations live outside the API schema.
alter function public.confirm_candidate_merge(uuid,uuid,uuid,bigint,bigint,text,boolean) set schema private;
alter function public.request_document_analysis(uuid,uuid,uuid) set schema private;
alter function public.select_candidate_document(uuid,uuid,uuid,bigint) set schema private;
alter function public.set_candidate_job_link(uuid,uuid,uuid,boolean) set schema private;
create function public.confirm_candidate_merge(p_company uuid,p_source uuid,p_target uuid,p_source_version bigint,p_target_version bigint,p_reason text,p_confirmed boolean) returns uuid
language sql security invoker set search_path='' as $$select private.confirm_candidate_merge(p_company,p_source,p_target,p_source_version,p_target_version,p_reason,p_confirmed)$$;
create function public.request_document_analysis(p_company uuid,p_document uuid,p_request uuid) returns uuid
language sql security invoker set search_path='' as $$select private.request_document_analysis(p_company,p_document,p_request)$$;
create function public.select_candidate_document(p_company uuid,p_candidate uuid,p_document uuid,p_expected_version bigint) returns void
language sql security invoker set search_path='' as $$select private.select_candidate_document(p_company,p_candidate,p_document,p_expected_version)$$;
create function public.set_candidate_job_link(p_company uuid,p_candidate uuid,p_job uuid,p_active boolean) returns void
language sql security invoker set search_path='' as $$select private.set_candidate_job_link(p_company,p_candidate,p_job,p_active)$$;
revoke all on function public.confirm_candidate_merge(uuid,uuid,uuid,bigint,bigint,text,boolean),public.request_document_analysis(uuid,uuid,uuid),
 public.select_candidate_document(uuid,uuid,uuid,bigint),public.set_candidate_job_link(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.confirm_candidate_merge(uuid,uuid,uuid,bigint,bigint,text,boolean),public.request_document_analysis(uuid,uuid,uuid),
 public.select_candidate_document(uuid,uuid,uuid,bigint),public.set_candidate_job_link(uuid,uuid,uuid,boolean) to authenticated;
