-- Civil dates are checked at the persistence boundary as well as in the UI/AI parser.
create function private.guard_birth_date() returns trigger language plpgsql set search_path='' as $$begin
 if new.data_nascimento is not null and (not isfinite(new.data_nascimento) or new.data_nascimento<date '1900-01-01' or new.data_nascimento>(clock_timestamp() at time zone 'America/Sao_Paulo')::date) then
  raise exception 'Data de nascimento inválida' using errcode='22023';
 end if;
 return new;
end$$;
revoke all on function private.guard_birth_date() from public,anon,authenticated;
create trigger zz_guard_birth_date before insert or update on public.candidates for each row execute function private.guard_birth_date();

-- Administrative notes are segregated from general recruitment access and AI inputs.
create table public.apprentice_case_reviews (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,run_id uuid not null,candidate_id uuid not null,
 request_id uuid not null,version bigint not null,
 actor_id uuid references auth.users(id) on delete set null,actor_name text,
 created_at timestamptz not null default clock_timestamp(),reference_date date not null,
 candidate_version bigint not null,review_version bigint not null,job_version bigint not null,
 status text not null check(status in ('pending_legal','legal_recorded')),
 justification text not null check(length(btrim(justification)) between 20 and 1000),
 legal_responsible text,legal_reference text,
 check(status<>'legal_recorded' or (length(btrim(legal_responsible)) between 3 and 160 and length(btrim(legal_reference)) between 5 and 300 and legal_responsible is not null and legal_reference is not null)),
 unique(company_id,request_id),unique(run_id,candidate_id,version),
 foreign key(company_id,run_id) references public.ranking_runs(company_id,id) on delete cascade,
 foreign key(run_id,candidate_id) references public.ranking_entries(run_id,candidate_id) on delete cascade
);
create index apprentice_case_history on public.apprentice_case_reviews(company_id,run_id,candidate_id,version desc);
create index apprentice_case_actor on public.apprentice_case_reviews(actor_id);
alter table public.apprentice_case_reviews enable row level security;
revoke all on public.apprentice_case_reviews from public,anon,authenticated;
grant select on public.apprentice_case_reviews to authenticated;
grant all on public.apprentice_case_reviews to service_role;
create policy apprentice_case_admin_read on public.apprentice_case_reviews for select to authenticated using (
 private.has_role(company_id,array['owner','admin']) and exists(select 1 from public.ranking_entries e where e.company_id=apprentice_case_reviews.company_id and e.run_id=apprentice_case_reviews.run_id and e.candidate_id=apprentice_case_reviews.candidate_id)
);

create function private.record_apprentice_review(p_company uuid,p_run uuid,p_candidate uuid,p_request uuid,p_expected_version bigint,p_status text,p_justification text,p_legal_responsible text,p_legal_reference text,p_confirmed boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.ranking_runs;e public.ranking_entries;c public.candidates;j public.jobs;previous public.apprentice_case_reviews;saved public.apprentice_case_reviews;v bigint;display_name text;
begin
 perform 1 from public.companies where id=p_company for update;
 if auth.uid() is null or not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão para conferência especial' using errcode='42501';end if;
 select * into r from public.ranking_runs where id=p_run and company_id=p_company;
 select * into e from public.ranking_entries where company_id=p_company and run_id=p_run and candidate_id=p_candidate;
 select * into c from public.candidates where company_id=p_company and id=p_candidate and not excluido;
 select * into j from public.jobs where company_id=p_company and id=r.job_id and not excluido;
 if r.id is null or e.candidate_id is null or c.id is null or j.id is null or r.status<>'completed' or r.job_snapshot->>'categoria'<>'jovem_aprendiz' then raise exception 'Conferência indisponível' using errcode='42501';end if;
 select * into previous from public.apprentice_case_reviews where company_id=p_company and request_id=p_request;
 if found then
  if previous.actor_id is distinct from auth.uid() or previous.run_id<>p_run or previous.candidate_id<>p_candidate or previous.status is distinct from p_status or previous.justification is distinct from btrim(p_justification) or previous.legal_responsible is distinct from nullif(btrim(p_legal_responsible),'') or previous.legal_reference is distinct from nullif(btrim(p_legal_reference),'') then raise exception 'Solicitação diferente' using errcode='22023';end if;
  return to_jsonb(previous);
 end if;
 if r.stale or c.data_version is distinct from (e.snapshot->>'data_version')::bigint or c.review_version is distinct from (e.snapshot->>'review_version')::bigint or j.version is distinct from (r.job_snapshot->>'version')::bigint then raise exception 'Conferência desatualizada; recalcule a avaliação' using errcode='40001';end if;
 select coalesce(max(version),0) into v from public.apprentice_case_reviews where run_id=p_run and candidate_id=p_candidate;
 if p_expected_version is distinct from v then raise exception 'Outra pessoa registrou uma conferência; atualize' using errcode='40001';end if;
 if p_confirmed is distinct from true or p_request is null or p_status not in ('pending_legal','legal_recorded') or p_status is null or p_justification is null or length(btrim(p_justification)) not between 20 and 1000 or length(coalesce(p_legal_responsible,''))>160 or length(coalesce(p_legal_reference,''))>300 then raise exception 'Confira os campos e confirme a revisão' using errcode='22023';end if;
 if p_status='legal_recorded' and (coalesce(length(btrim(p_legal_responsible)),0)<3 or coalesce(length(btrim(p_legal_reference)),0)<5) then raise exception 'Informe o responsável e a referência do parecer' using errcode='22023';end if;
 select left(full_name,160) into display_name from public.profiles where id=auth.uid();
 insert into public.apprentice_case_reviews(company_id,run_id,candidate_id,request_id,version,actor_id,actor_name,reference_date,candidate_version,review_version,job_version,status,justification,legal_responsible,legal_reference)
 values(p_company,p_run,p_candidate,p_request,v+1,auth.uid(),display_name,(r.created_at at time zone 'America/Sao_Paulo')::date,c.data_version,c.review_version,j.version,p_status,btrim(p_justification),nullif(btrim(p_legal_responsible),''),nullif(btrim(p_legal_reference),'')) returning * into saved;
 return to_jsonb(saved);
end$$;
revoke all on function private.record_apprentice_review(uuid,uuid,uuid,uuid,bigint,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function private.record_apprentice_review(uuid,uuid,uuid,uuid,bigint,text,text,text,text,boolean) to authenticated;
create function public.record_apprentice_review(p_company uuid,p_run uuid,p_candidate uuid,p_request uuid,p_expected_version bigint,p_status text,p_justification text,p_legal_responsible text default null,p_legal_reference text default null,p_confirmed boolean default false) returns jsonb language sql security invoker set search_path='' as $$
 select private.record_apprentice_review(p_company,p_run,p_candidate,p_request,p_expected_version,p_status,p_justification,p_legal_responsible,p_legal_reference,p_confirmed)
$$;
revoke all on function public.record_apprentice_review(uuid,uuid,uuid,uuid,bigint,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_apprentice_review(uuid,uuid,uuid,uuid,bigint,text,text,text,text,boolean) to authenticated;
