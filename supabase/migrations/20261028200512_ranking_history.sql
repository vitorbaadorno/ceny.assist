create table public.ranking_runs (
 id uuid primary key default gen_random_uuid(), company_id uuid not null,job_id uuid not null,
 request_id uuid not null,actor_id uuid references auth.users(id) on delete set null,
 status text not null default 'processing' check(status in ('processing','completed','failed')),
 job_snapshot jsonb not null,formula text not null default 'evidence-v3',
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 expires_at timestamptz not null default clock_timestamp()+interval '15 minutes',
 total integer not null default 0,eligible integer not null default 0,stale boolean not null default false,
 unique(company_id,job_id,request_id),unique(company_id,id),
 foreign key(company_id,job_id) references public.jobs(company_id,id) on delete cascade
);
create unique index ranking_one_active on public.ranking_runs(job_id) where status='processing';
create index ranking_history on public.ranking_runs(company_id,job_id,created_at desc);
create index ranking_actor on public.ranking_runs(actor_id);
create table public.ranking_entries (
 company_id uuid not null,run_id uuid not null,candidate_id uuid not null,
 snapshot jsonb not null,documents jsonb not null,reason text,
 score numeric check(score between 0 and 100),details jsonb,
 primary key(run_id,candidate_id),
 foreign key(company_id,run_id) references public.ranking_runs(company_id,id) on delete cascade,
 foreign key(company_id,candidate_id) references public.candidates(company_id,id) on delete cascade
);
create index ranking_entries_candidate on public.ranking_entries(company_id,candidate_id);
create index ranking_entries_run_company on public.ranking_entries(company_id,run_id);
alter table public.ranking_runs enable row level security;
alter table public.ranking_entries enable row level security;
revoke all on public.ranking_runs,public.ranking_entries from public,anon,authenticated;
grant select on public.ranking_runs,public.ranking_entries to authenticated;
grant all on public.ranking_runs,public.ranking_entries to service_role;
create policy ranking_runs_read on public.ranking_runs for select to authenticated using(private.has_role(company_id) and exists(select 1 from public.jobs j where j.company_id=ranking_runs.company_id and j.id=job_id and not j.excluido));
create policy ranking_entries_read on public.ranking_entries for select to authenticated using(private.has_role(company_id) and exists(select 1 from public.ranking_runs r where r.id=run_id and r.company_id=ranking_entries.company_id) and exists(select 1 from public.candidates c where c.id=candidate_id and c.company_id=ranking_entries.company_id and not c.excluido));
alter table public.candidate_scores add column run_id uuid references public.ranking_runs(id),add column review_version bigint;
create index candidate_scores_run on public.candidate_scores(run_id);

create function public.begin_ranking(p_actor uuid,p_company uuid,p_job uuid,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
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
 select p_company,r.id,c.id,to_jsonb(c),coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'sha256',d.sha256,'filename',d.filename,'state',d.state)) from public.resume_documents d where d.company_id=p_company and d.candidate_id=c.id),'[]'),
 case when c.processing_status='erro' then 'A leitura falhou. Corrija ou reprocesse o currículo.' when c.processing_status not in ('concluido','revisao_manual') then 'O currículo ainda precisa de processamento.' when c.review_status<>'completed' then 'A revisão humana ainda não foi concluída.' else null end
 from public.candidates c where c.company_id=p_company and not c.excluido;
 update public.ranking_runs set total=(select count(*) from public.ranking_entries where run_id=r.id),eligible=(select count(*) from public.ranking_entries where run_id=r.id and reason is null) where id=r.id returning * into r;
 return to_jsonb(r);
end $$;

create function public.stage_ranking(p_actor uuid,p_run uuid,p_rows jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare r public.ranking_runs;s jsonb;
begin
 select * into r from public.ranking_runs where id=p_run for update;
 if not found or r.actor_id is distinct from p_actor or not exists(select 1 from public.company_members where company_id=r.company_id and user_id=p_actor and role in ('owner','admin','recruiter')) then raise exception 'Sem permissão' using errcode='42501';end if;
 if r.status='completed' then return;end if;
 if r.status<>'processing' or r.expires_at<clock_timestamp() then raise exception 'Cálculo expirado' using errcode='40001';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>200 then raise exception 'Lote inválido' using errcode='22023';end if;
 for s in select * from jsonb_array_elements(p_rows) loop
  if s->'details'->>'formula' is distinct from r.formula or jsonb_typeof(s->'score') is distinct from 'number' then raise exception 'Resultado inválido' using errcode='22023';end if;
  update public.ranking_entries set score=(s->>'score')::numeric,details=s->'details' where run_id=r.id and candidate_id=(s->>'candidate_id')::uuid and reason is null and score is null;
 end loop;
 update public.ranking_runs set expires_at=clock_timestamp()+interval '15 minutes' where id=r.id;
end $$;

create function public.finish_ranking(p_actor uuid,p_run uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.ranking_runs;j public.jobs;
begin
 select * into r from public.ranking_runs where id=p_run;
 if not found then raise exception 'Cálculo indisponível' using errcode='42501';end if;
 perform 1 from public.companies where id=r.company_id for update;
 select * into r from public.ranking_runs where id=p_run for update;
 if r.actor_id is distinct from p_actor or not exists(select 1 from public.company_members where company_id=r.company_id and user_id=p_actor and role in ('owner','admin','recruiter')) then raise exception 'Sem permissão' using errcode='42501';end if;
 if r.status='completed' then return to_jsonb(r);end if;
 if r.status<>'processing' or r.expires_at<clock_timestamp() then raise exception 'Cálculo expirado' using errcode='40001';end if;
 select * into j from public.jobs where id=r.job_id and company_id=r.company_id and not excluido for update;
 if not found or j.version is distinct from (r.job_snapshot->>'version')::bigint or j.approved_hash is distinct from r.job_snapshot->>'approved_hash' or j.status<>'aberta' then raise exception 'Vaga alterada durante o cálculo' using errcode='40001';end if;
 perform 1 from public.candidates where company_id=r.company_id and not excluido order by id for share;
 if (select count(*) from public.candidates where company_id=r.company_id and not excluido)<>r.total or exists(
 select 1 from public.ranking_entries e left join public.candidates c on c.id=e.candidate_id and c.company_id=e.company_id and not c.excluido where e.run_id=r.id and (c.id is null or c.data_version is distinct from (e.snapshot->>'data_version')::bigint or c.review_version is distinct from (e.snapshot->>'review_version')::bigint or c.processing_status is distinct from e.snapshot->>'processing_status' or c.review_status is distinct from e.snapshot->>'review_status')) then raise exception 'Base alterada durante o cálculo' using errcode='40001';end if;
 if exists(select 1 from public.ranking_entries where run_id=r.id and reason is null and (score is null or details is null)) then raise exception 'Cálculo incompleto' using errcode='22023';end if;
 -- Both replacement and history completion commit together; any failure rolls back.
 delete from public.candidate_scores where company_id=r.company_id and job_id=r.job_id;
 insert into public.candidate_scores(company_id,job_id,candidate_id,score,detalhes_matching,candidate_version,review_version,job_version,criteria_hash,stale,run_id)
 select r.company_id,r.job_id,candidate_id,score,details,(snapshot->>'data_version')::bigint,(snapshot->>'review_version')::bigint,j.version,j.approved_hash,false,r.id from public.ranking_entries where run_id=r.id and reason is null;
 update public.job_reports set stale=true where company_id=r.company_id and job_id=r.job_id;
 update public.ranking_runs set status='completed',completed_at=clock_timestamp() where id=r.id returning * into r;
 return to_jsonb(r);
end $$;

create function public.fail_ranking(p_actor uuid,p_run uuid) returns void language sql security invoker set search_path='' as $$
 update public.ranking_runs set status='failed' where id=p_run and actor_id=p_actor and status='processing' and exists(select 1 from public.company_members where company_id=ranking_runs.company_id and user_id=p_actor and role in ('owner','admin','recruiter'))
$$;
revoke all on function public.begin_ranking(uuid,uuid,uuid,uuid),public.stage_ranking(uuid,uuid,jsonb),public.finish_ranking(uuid,uuid),public.fail_ranking(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_ranking(uuid,uuid,uuid,uuid),public.stage_ranking(uuid,uuid,jsonb),public.finish_ranking(uuid,uuid),public.fail_ranking(uuid,uuid) to service_role;
-- Compatibility writer can no longer publish unreviewed candidates.
create function private.require_final_review() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.candidates where id=new.candidate_id and company_id=new.company_id and processing_status in ('concluido','revisao_manual') and review_status='completed' and not excluido) then raise exception 'Revisão ou processamento pendente' using errcode='22023';end if;return new;end$$;
revoke all on function private.require_final_review() from public,anon,authenticated;
create trigger require_final_review before insert on public.candidate_scores for each row execute function private.require_final_review();
create function private.invalidate_ranking_history() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.ranking_runs set stale=true where company_id=coalesce(new.company_id,old.company_id) and status='completed';
 update public.candidate_scores set stale=true where company_id=coalesce(new.company_id,old.company_id);
 return coalesce(new,old);end$$;
revoke all on function private.invalidate_ranking_history() from public,anon,authenticated;
create trigger invalidate_ranking_history after insert or delete or update of data_version,review_version,processing_status,review_status,excluido on public.candidates for each row execute function private.invalidate_ranking_history();
update public.candidate_scores set stale=true;
