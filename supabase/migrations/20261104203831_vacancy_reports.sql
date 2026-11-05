-- Immutable, minimized reports. Legacy job_reports are deliberately left untouched.
create table public.vacancy_reports (
 id uuid primary key default gen_random_uuid(), company_id uuid not null, job_id uuid not null,
 run_id uuid not null, candidate_ids uuid[] not null, request_id uuid not null,
 include_names boolean not null default false, include_notes boolean not null default false,
 created_by uuid references auth.users(id) on delete set null, actor_name text,
 created_at timestamptz not null default clock_timestamp(), payload jsonb not null,
 unique(company_id,id), unique(company_id,request_id),
 foreign key(company_id,job_id) references public.jobs(company_id,id),
 foreign key(company_id,run_id) references public.ranking_runs(company_id,id),
 check(cardinality(candidate_ids) between 1 and 100)
);
create index vacancy_reports_history on public.vacancy_reports(company_id,job_id,created_at desc,id);
create index vacancy_reports_run on public.vacancy_reports(company_id,run_id);
create index vacancy_reports_actor on public.vacancy_reports(created_by);
create table public.vacancy_report_events (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,report_id uuid not null,
 actor_id uuid references auth.users(id) on delete set null,actor_name text,
 action text not null check(action in ('generated','view','pdf','csv')),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(company_id,report_id) references public.vacancy_reports(company_id,id)
);
create index vacancy_report_events_history on public.vacancy_report_events(company_id,report_id,created_at desc,id);
create index vacancy_report_events_actor on public.vacancy_report_events(actor_id);
alter table public.vacancy_reports enable row level security;
alter table public.vacancy_report_events enable row level security;
revoke all on public.vacancy_reports,public.vacancy_report_events from public,anon,authenticated;
-- Content cannot be fetched directly, bypassing access checks and audit.
grant select(id,company_id,job_id,run_id,candidate_ids,include_names,include_notes,created_by,actor_name,created_at) on public.vacancy_reports to authenticated;
grant select on public.vacancy_report_events to authenticated;
grant all on public.vacancy_reports,public.vacancy_report_events to service_role;

create function private.can_read_vacancy_report(p_company uuid,p_job uuid,p_candidates uuid[])
returns boolean language sql stable security invoker set search_path='' as $$
 select private.has_role(p_company)
 and exists(select 1 from public.jobs where company_id=p_company and id=p_job and not excluido)
 and cardinality(p_candidates)=(select count(*) from public.candidates where company_id=p_company and id=any(p_candidates) and not excluido)
$$;
create policy vacancy_reports_read on public.vacancy_reports for select to authenticated
 using(private.can_read_vacancy_report(company_id,job_id,candidate_ids));
create policy vacancy_report_events_read on public.vacancy_report_events for select to authenticated
 using(exists(select 1 from public.vacancy_reports r where r.company_id=vacancy_report_events.company_id and r.id=report_id));

-- Applied only to allowlisted professional text, never to whole candidate records.
create function private.report_text(p_text text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(regexp_replace(regexp_replace(coalesce(p_text,''),
 '[[:alnum:]._%+\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}','[contato omitido]','gi'),
 '(https?://|www\.)[^[:space:]]+','[link omitido]','gi'),
 '(\+?[0-9][0-9 ()./\-]{7,}[0-9])','[dado pessoal omitido]','g')
$$;
create function private.report_clean(p_value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb;
begin
 case jsonb_typeof(p_value)
 when 'string' then return to_jsonb(private.report_text(p_value#>>'{}'));
 when 'array' then select coalesce(jsonb_agg(private.report_clean(v) order by n),'[]') into result from jsonb_array_elements(p_value) with ordinality a(v,n);return result;
 when 'object' then select coalesce(jsonb_object_agg(k,case when k in ('id','actor_id','date','document') then v else private.report_clean(v) end),'{}') into result from jsonb_each(p_value) a(k,v);return result;
 else return p_value;end case;
end $$;

create function private.generate_vacancy_report(p_company uuid,p_job uuid,p_run uuid,p_candidates uuid[],p_names boolean,p_notes boolean,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.ranking_runs;j public.jobs;existing public.vacancy_reports;rid uuid:=gen_random_uuid();actor_label text;
 people jsonb;criteria jsonb;generated timestamptz:=clock_timestamp();
begin
 -- Serialize with membership changes, revisions, ranking publication and RH commands.
 perform 1 from public.companies where id=p_company for update;
 if auth.uid() is null or not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_request is null or p_names is null or p_notes is null or coalesce(cardinality(p_candidates),0) not between 1 and 100
 or array_position(p_candidates,null) is not null or (select count(distinct id) from unnest(p_candidates) id)<>cardinality(p_candidates)
 then raise exception 'Selecione de 1 a 100 candidatos diferentes' using errcode='22023';end if;
 if not private.can_read_vacancy_report(p_company,p_job,p_candidates) then raise exception 'Relatório indisponível' using errcode='42501';end if;
 select * into existing from public.vacancy_reports where company_id=p_company and request_id=p_request;
 if found then
  if existing.created_by is distinct from auth.uid() or existing.job_id<>p_job or existing.run_id<>p_run or existing.candidate_ids<>p_candidates or existing.include_names<>p_names or existing.include_notes<>p_notes
  then raise exception 'Solicitação já utilizada' using errcode='22023';end if;
  return existing.id;
 end if;
 select * into j from public.jobs where company_id=p_company and id=p_job;
 select * into r from public.ranking_runs where company_id=p_company and job_id=p_job and id=p_run and status='completed';
 if not found then raise exception 'Escolha uma avaliação publicada da vaga' using errcode='22023';end if;
 if (select count(*) from public.ranking_entries where company_id=p_company and run_id=p_run and candidate_id=any(p_candidates))<>cardinality(p_candidates)
 then raise exception 'Há candidatos fora desta avaliação. Atualize a avaliação ou a seleção.' using errcode='22023';end if;
 select left(full_name,160) into actor_label from public.profiles where id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('kind',v->'kind','text',v->'text','required',v->'required','weight',v->'weight','min_years',v->'min_years') order by n),'[]') into criteria
 from jsonb_array_elements(r.job_snapshot->'criteria') with ordinality a(v,n);
 select jsonb_agg(jsonb_build_object(
  'id',c.id,'label',case when p_names then coalesce(nullif(e.snapshot->>'nome',''),'Nome não informado') else 'Candidato '||array_position(p_candidates,c.id) end,
  'versions',jsonb_build_object('data',e.snapshot->'data_version','review',e.snapshot->'review_version','document',e.snapshot->'active_document_id'),
  'stale_at_generation',r.stale or r.formula<>'evidence-v3' or (r.job_snapshot->>'version')::bigint<>j.version
     or (e.snapshot->>'data_version')::bigint is distinct from c.data_version or (e.snapshot->>'review_version')::bigint is distinct from c.review_version
     or e.snapshot->>'active_document_id' is distinct from c.active_document_id::text,
  'qualifications',jsonb_build_object('skills',e.snapshot->'skills','experience_years',e.snapshot->'anos_experiencia',
    'education',coalesce((select jsonb_agg(jsonb_build_object('course',f->'curso','institution',f->'instituicao','level',f->'nivel'))
      from jsonb_array_elements(coalesce(e.snapshot->'dados_efetivos'->'formacao_academica',e.snapshot->'correcoes_rh'->'formacao_academica',e.snapshot->'dados_extraidos'->'formacao_academica','[]')) f),'[]')),
  'automatic',jsonb_build_object('score',case when e.reason is null then e.score else null end,'reason',e.reason,
    'criteria',case when e.reason is null and e.score is not null then coalesce((select jsonb_agg(jsonb_build_object(
      'kind',v->'kind','text',v->'text','required',v->'required','weight',v->'weight','min_years',v->'min_years',
      'state',v->'estado','reason',v->'motivo',
      'evidence',coalesce((select jsonb_agg(jsonb_build_object('field',ev->'campo','text',ev->'trecho','page',ev->'pagina','origin',ev->'origem') order by en)
       from jsonb_array_elements(coalesce(v->'evidencias','[]')) with ordinality b(ev,en)),'[]')) order by vn)
      from jsonb_array_elements(coalesce(e.details->'criterios','[]')) with ordinality a(v,vn)),'[]') else '[]'::jsonb end),
  'rh',jsonb_build_object('status',l.decision_status,'selected',l.shortlisted,'version',l.decision_version,'active_link',coalesce(l.active,false),
    'decision', (select jsonb_build_object('actor',d.actor_name,'actor_id',d.actor_id,'date',d.created_at,'reason',d.reason) from public.candidate_decision_events d
      where d.company_id=p_company and d.job_id=p_job and d.candidate_id=c.id and d.version=l.decision_version),
    'notes',case when p_notes then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'actor',n.actor_name,'actor_id',n.actor_id,'date',n.created_at,'body',n.body) order by n.created_at,n.id)
      from public.candidate_notes n where n.company_id=p_company and n.job_id=p_job and n.candidate_id=c.id),'[]') else '[]'::jsonb end)
 ) order by array_position(p_candidates,c.id)) into people
 from public.candidates c join public.ranking_entries e on e.company_id=c.company_id and e.candidate_id=c.id and e.run_id=p_run
 left join public.candidate_job_links l on l.company_id=c.company_id and l.candidate_id=c.id and l.job_id=p_job
 where c.company_id=p_company and c.id=any(p_candidates) and not c.excluido;
 if octet_length(people::text)>8000000 then raise exception 'Relatório muito extenso. Reduza a seleção ou retire as notas.' using errcode='22023';end if;
 insert into public.vacancy_reports(id,company_id,job_id,run_id,candidate_ids,request_id,include_names,include_notes,created_by,actor_name,created_at,payload)
 values(rid,p_company,p_job,p_run,p_candidates,p_request,p_names,p_notes,auth.uid(),actor_label,generated,
 jsonb_build_object('schema_version',1,'id',rid,'created_at',generated,'created_by',auth.uid(),'actor',actor_label,
 'include_names',p_names,'include_notes',p_notes,
 'job',jsonb_build_object('id',p_job,'title',private.report_text(r.job_snapshot->>'titulo'),'version',r.job_snapshot->'version','criteria',private.report_clean(criteria)),
 'evaluation',jsonb_build_object('id',r.id,'date',r.completed_at,'formula',r.formula),
 'candidates',private.report_clean(people)));
 insert into public.vacancy_report_events(company_id,report_id,actor_id,actor_name,action) values(p_company,rid,auth.uid(),actor_label,'generated');
 return rid;
end $$;

create function private.access_vacancy_report(p_company uuid,p_report uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.vacancy_reports;actor_label text;outdated boolean;event_id uuid;
begin
 perform 1 from public.companies where id=p_company for update;
 if auth.uid() is null or not private.has_role(p_company) or p_action is null or p_action not in ('view','pdf','csv')
 or (p_action<>'view' and not private.has_role(p_company,array['owner','admin','recruiter'])) then raise exception 'Sem permissão' using errcode='42501';end if;
 select * into r from public.vacancy_reports where company_id=p_company and id=p_report;
 if not found or not private.can_read_vacancy_report(p_company,r.job_id,r.candidate_ids) then raise exception 'Relatório indisponível' using errcode='42501';end if;
 select left(full_name,160) into actor_label from public.profiles where id=auth.uid();
 select exists(select 1 from public.ranking_runs rr join public.jobs j on j.id=rr.job_id and j.company_id=rr.company_id
   where rr.company_id=p_company and rr.id=r.run_id and (rr.stale or rr.formula<>'evidence-v3' or j.version<>(r.payload->'job'->>'version')::bigint))
 or exists(select 1 from jsonb_array_elements(r.payload->'candidates') p join public.candidates c on c.id=(p->>'id')::uuid and c.company_id=p_company
   left join public.candidate_job_links l on l.company_id=c.company_id and l.candidate_id=c.id and l.job_id=r.job_id
   where c.data_version is distinct from (p->'versions'->>'data')::bigint or c.review_version is distinct from (p->'versions'->>'review')::bigint
   or c.active_document_id::text is distinct from p->'versions'->>'document' or l.decision_version is distinct from (p->'rh'->>'version')::bigint
   or coalesce(l.active,false) is distinct from (p->'rh'->>'active_link')::boolean)
 or (r.include_notes and exists(select 1 from public.candidate_notes where company_id=p_company and job_id=r.job_id and candidate_id=any(r.candidate_ids) and created_at>r.created_at))
 into outdated;
 insert into public.vacancy_report_events(company_id,report_id,actor_id,actor_name,action) values(p_company,r.id,auth.uid(),actor_label,p_action) returning id into event_id;
 return jsonb_build_object('report',r.payload,'outdated_now',outdated,'access_id',event_id,'accessed_at',clock_timestamp());
end $$;
create function public.generate_vacancy_report(p_company uuid,p_job uuid,p_run uuid,p_candidates uuid[],p_names boolean,p_notes boolean,p_request uuid) returns uuid
 language sql security invoker set search_path='' as $$select private.generate_vacancy_report(p_company,p_job,p_run,p_candidates,p_names,p_notes,p_request)$$;
create function public.access_vacancy_report(p_company uuid,p_report uuid,p_action text) returns jsonb
 language sql security invoker set search_path='' as $$select private.access_vacancy_report(p_company,p_report,p_action)$$;
revoke all on function private.report_text(text),private.report_clean(jsonb) from public,anon,authenticated;
revoke all on function private.can_read_vacancy_report(uuid,uuid,uuid[]),private.generate_vacancy_report(uuid,uuid,uuid,uuid[],boolean,boolean,uuid),
 public.generate_vacancy_report(uuid,uuid,uuid,uuid[],boolean,boolean,uuid),private.access_vacancy_report(uuid,uuid,text),public.access_vacancy_report(uuid,uuid,text) from public,anon;
grant execute on function private.can_read_vacancy_report(uuid,uuid,uuid[]),private.generate_vacancy_report(uuid,uuid,uuid,uuid[],boolean,boolean,uuid),
 public.generate_vacancy_report(uuid,uuid,uuid,uuid[],boolean,boolean,uuid),private.access_vacancy_report(uuid,uuid,text),public.access_vacancy_report(uuid,uuid,text) to authenticated;
