create table private.gemini_request_windows(
 company_id uuid not null references public.companies on delete cascade,
 actor_id uuid not null references auth.users on delete cascade,
 window_at timestamptz not null,n integer not null check(n between 1 and 10),
 primary key(company_id,actor_id)
);
create index gemini_window_actor on private.gemini_request_windows(actor_id);
alter table private.gemini_request_windows enable row level security;
revoke all on private.gemini_request_windows from public,anon,authenticated,service_role;
create function private.admit_ai_request(p_company uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão.' using errcode='42501';end if;
 insert into private.gemini_request_windows as w values(p_company,auth.uid(),date_trunc('minute',clock_timestamp()),1)
 on conflict(company_id,actor_id) do update set
 window_at=excluded.window_at,n=case when w.window_at=excluded.window_at then w.n+1 else 1 end
 where w.window_at<>excluded.window_at or w.n<10
 returning true into allowed;
 return coalesce(allowed,false);
end$$;
create function public.admit_ai_request(p_company uuid) returns boolean language sql security invoker set search_path='' as $$select private.admit_ai_request(p_company)$$;
revoke all on function private.admit_ai_request(uuid),public.admit_ai_request(uuid) from public,anon,authenticated,service_role;
grant execute on function private.admit_ai_request(uuid),public.admit_ai_request(uuid) to authenticated;

alter table public.resume_jobs add constraint job_tenant_candidate unique(company_id,id,candidate_id);
create table public.resume_job_vacancies(
 company_id uuid not null,candidate_id uuid not null,resume_job_id uuid not null,job_id uuid not null,
 job_version bigint not null,criteria jsonb not null,created_by uuid references auth.users on delete set null,
 created_at timestamptz not null default now(),
 primary key(company_id,resume_job_id,job_id),
 foreign key(company_id,resume_job_id,candidate_id) references public.resume_jobs(company_id,id,candidate_id) on delete cascade,
 foreign key(company_id,job_id) references public.jobs(company_id,id) on delete cascade
);
create index resume_vacancy_job on public.resume_job_vacancies(company_id,job_id);
create index resume_vacancy_creator on public.resume_job_vacancies(created_by);
alter table public.resume_job_vacancies enable row level security;
revoke all on public.resume_job_vacancies from public,anon,authenticated,service_role;
grant select on public.resume_job_vacancies to authenticated;
create policy resume_vacancy_read on public.resume_job_vacancies for select to authenticated using(private.has_role(company_id));
create function private.request_vacancy_analysis(p_company uuid,p_candidate uuid,p_job uuid,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare j public.jobs; d uuid; result uuid;
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão.' using errcode='42501';end if;
 select * into j from public.jobs where company_id=p_company and id=p_job and status='aberta' and not excluido and approved_hash is not null;
 if not found or not exists(select 1 from public.candidate_job_links where company_id=p_company and candidate_id=p_candidate and job_id=p_job and active) then raise exception 'Vínculo ou vaga indisponível.' using errcode='42501';end if;
 select active_document_id into d from public.candidates where company_id=p_company and id=p_candidate and not excluido;
 if d is null then raise exception 'Documento indisponível.' using errcode='22023';end if;
 result:=private.request_document_analysis(p_company,d,p_request);
 insert into public.resume_job_vacancies values(p_company,p_candidate,result,p_job,j.version,j.criteria,auth.uid(),now()) on conflict do nothing;
 return result;
end$$;
create function public.request_vacancy_analysis(p_company uuid,p_candidate uuid,p_job uuid,p_request uuid) returns uuid
language sql security invoker set search_path='' as $$select private.request_vacancy_analysis(p_company,p_candidate,p_job,p_request)$$;
revoke all on function private.request_vacancy_analysis(uuid,uuid,uuid,uuid),public.request_vacancy_analysis(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.request_vacancy_analysis(uuid,uuid,uuid,uuid),public.request_vacancy_analysis(uuid,uuid,uuid,uuid) to authenticated;
