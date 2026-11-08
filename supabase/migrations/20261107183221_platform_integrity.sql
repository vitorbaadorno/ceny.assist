begin;
-- Keep the inventory stable while validating historical relationships. A busy system
-- can retry the entire migration without leaving partially applied changes.
set local lock_timeout='10s';
lock table public.jobs,public.candidates,public.resume_documents,public.candidate_revisions,
 public.job_revisions,public.ranking_runs,public.ranking_entries,public.candidate_scores,
 public.candidate_document_events in share row exclusive mode;

create temporary table ceny_before_integrity on commit drop as
select (select count(*) from public.jobs) jobs,(select count(*) from public.candidates) candidates,
 (select count(*) from public.resume_documents) documents,(select count(*) from public.candidate_revisions) revisions,
 (select count(*) from public.job_revisions) job_revisions,(select count(*) from public.ranking_entries) evaluations,
 (select count(*) from public.candidate_scores) scores;

create table private.legacy_job_states(
 job_id uuid primary key references public.jobs(id) on delete cascade, original_status text not null
);
create table private.legacy_score_runs(
 score_id uuid primary key references public.candidate_scores(id) on delete cascade, original_run uuid not null
);
alter table private.legacy_job_states enable row level security;
alter table private.legacy_score_runs enable row level security;
revoke all on private.legacy_job_states,private.legacy_score_runs from public,anon,authenticated,service_role;
-- Existing normal writes still accept only the two operational states. A legacy row
-- may enter or remain in review until the responsible team explicitly resolves it.
create or replace function private.guard_job_criteria() returns trigger language plpgsql set search_path='' as $$
declare p jsonb;old_hash text;
begin
 if length(btrim(new.titulo)) not between 3 and 160 or length(coalesce(new.descricao,''))>20000 or new.experiencia_minima not between 0 and 100 or new.experiencia_minima::text in ('NaN','Infinity','-Infinity')
 or (new.status not in ('aberta','encerrada') and not (
     tg_op='UPDATE' and new.status='indefinida' and old.status not in ('aberta','encerrada')
   )) or new.categoria not in ('regular','jovem_aprendiz') then raise exception 'Dados de vaga inválidos' using errcode='22023';end if;
 new.titulo:=btrim(new.titulo);new.criteria:=private.normalize_job_criteria(new.criteria);
 -- Canonical criteria own all legacy scoring columns.
 new.requisitos_obrigatorios:=array(select c->>'text' from jsonb_array_elements(new.criteria)c where c->>'kind'='skill' and (c->>'required')::boolean);
 new.requisitos_desejaveis:=array(select c->>'text' from jsonb_array_elements(new.criteria)c where c->>'kind'='skill' and not(c->>'required')::boolean);
 new.experiencia_minima:=coalesce((select (c->>'min_years')::numeric from jsonb_array_elements(new.criteria)c where c->>'kind'='experience'),0);
 new.formacao_exigida:=(select c->>'text' from jsonb_array_elements(new.criteria)c where c->>'kind'='education');
 new.localizacao:=(select c->>'text' from jsonb_array_elements(new.criteria)c where c->>'kind'='location');
 p:=private.job_payload(new.titulo,coalesce(new.descricao,''),new.categoria,new.criteria);
 if new.approved_hash is distinct from private.job_hash(p) then new.approved_hash:=null;new.approved_by:=null;new.approved_at:=null;end if;
 if new.approved_hash is not null then perform private.validate_job_payload(p,true);end if;
 if tg_op='UPDATE' then
  new.version:=old.version;
  if row(new.titulo,new.descricao,new.categoria,new.criteria,new.status,new.approved_hash,new.approved_by,new.approved_at,new.excluido) is distinct from row(old.titulo,old.descricao,old.categoria,old.criteria,old.status,old.approved_hash,old.approved_by,old.approved_at,old.excluido) then new.version:=old.version+1;end if;
 end if;
 return new;
end $$;

insert into private.legacy_job_states select id,status from public.jobs where status not in('aberta','encerrada','indefinida');
update public.jobs j set status=case lower(trim(l.original_status)) when 'aberta' then 'aberta' when 'encerrada' then 'encerrada' else 'indefinida' end
 from private.legacy_job_states l where j.id=l.job_id;
alter table public.jobs add constraint jobs_workflow_status check(status in('aberta','encerrada','indefinida')) not valid;
alter table public.jobs validate constraint jobs_workflow_status;

insert into private.legacy_score_runs select s.id,s.run_id from public.candidate_scores s
 where s.run_id is not null and not exists(select 1 from public.ranking_runs r where (r.id,r.company_id,r.job_id)=(s.run_id,s.company_id,s.job_id));
update public.candidate_scores s set run_id=null,stale=true from private.legacy_score_runs l where l.score_id=s.id;
alter table public.ranking_runs add constraint ranking_run_company_job unique(company_id,id,job_id);
alter table public.candidate_scores add constraint score_run_company_job foreign key(company_id,run_id,job_id) references public.ranking_runs(company_id,id,job_id) not valid;
alter table public.candidate_scores validate constraint score_run_company_job;

alter table public.resume_documents add constraint document_company_identity unique(company_id,id);
alter table public.candidate_document_events add constraint event_document_company foreign key(company_id,document_id)
 references public.resume_documents(company_id,id) not valid;
alter table public.candidate_document_events validate constraint event_document_company;
-- Older revisions retain unknown provenance. The active document today cannot prove which version was reviewed in the past.
alter table public.candidate_revisions add column source_document_id uuid;
alter table public.candidate_revisions add constraint revision_document_company foreign key(company_id,source_document_id)
 references public.resume_documents(company_id,id) on delete set null (source_document_id) deferrable initially deferred;
create index revision_source_document on public.candidate_revisions(company_id,source_document_id) where source_document_id is not null;
create index score_run_job_lookup on public.candidate_scores(company_id,run_id,job_id) where run_id is not null;

create function private.stamp_review_origin() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null then
  new.actor_id:=auth.uid();
  select full_name into new.actor_name from public.profiles where id=new.actor_id;
 end if;
 if tg_table_name='candidate_revisions' then
  select active_document_id into new.source_document_id from public.candidates where id=new.candidate_id and company_id=new.company_id;
 end if;
 return new;
end$$;
revoke all on function private.stamp_review_origin() from public,anon,authenticated,service_role;
create trigger review_origin before insert on public.candidate_revisions for each row execute function private.stamp_review_origin();
create trigger revision_author before insert on public.job_revisions for each row execute function private.stamp_review_origin();

-- The document/generation unique index supports one backwards lookup per requested document.
create function public.batch_current_jobs(p_company uuid,p_documents uuid[])
returns table(id uuid,document_id uuid,candidate_id uuid,state text,phase text,generation integer,attempts integer,available_at timestamptz,message text,created_at timestamptz)
language plpgsql stable security invoker set search_path='' as $$
begin
 if cardinality(p_documents)>100 then raise exception 'Limite de 100 documentos por consulta.' using errcode='22023';end if;
 return query select j.id,j.document_id,j.candidate_id,j.state,j.phase,j.generation,j.attempts,j.available_at,j.message,j.created_at
 from (select distinct unnest(p_documents) as doc) d cross join lateral
 (select q.* from public.resume_jobs q where q.company_id=p_company and q.document_id=d.doc order by q.generation desc limit 1) j;
end$$;
revoke all on function public.batch_current_jobs(uuid,uuid[]) from public,anon;
grant execute on function public.batch_current_jobs(uuid,uuid[]) to authenticated;

create function public.browse_job_cards(p_company uuid,p_filters jsonb default '{}',p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with args as (select private.search_query(p_filters->>'q') q,private.search_query(p_filters->>'location') location),
 base as not materialized (select id,titulo,descricao,localizacao,categoria,status,created_at,approved_hash,requisitos_obrigatorios from public.jobs where company_id=p_company and not excluido),
 filtered as not materialized (select j.* from base j,args a where
 (numnode(a.q)=0 or private.search_vector(coalesce(titulo,'')||' '||coalesce(descricao,'')||' '||coalesce(localizacao,'')) @@ a.q)
 and (numnode(a.location)=0 or private.search_vector(localizacao) @@ a.location)
 and (coalesce(p_filters->>'status','todas')='todas' or status=p_filters->>'status')
 and (coalesce(p_filters->>'category','todas')='todas' or categoria=p_filters->>'category')),
 counts as (select (select count(*) from base) total,count(*) filtered from filtered),
 meta as (select *,least(greatest(coalesce(p_page,0),0),greatest(0,(filtered-1)/25)) page from counts),
 items as (select id,titulo,left(descricao,500) as descricao,categoria,status,created_at,approved_hash,requisitos_obrigatorios[1:8] as requisitos_obrigatorios from filtered order by created_at desc,id limit 25 offset (select page*25 from meta))
 select jsonb_build_object('total',total,'filtered',filtered,'page',page,'pageSize',25,'items',
 coalesce((select jsonb_agg(to_jsonb(i) order by created_at desc,id) from items i),'[]'::jsonb)) from meta
$$;

revoke all on function public.browse_job_cards(uuid,jsonb,integer) from public,anon;
grant execute on function public.browse_job_cards(uuid,jsonb,integer) to authenticated;
create index ranking_unscored_page on public.ranking_entries(company_id,run_id,candidate_id) where reason is null;
create index candidates_pending_page on public.candidates(company_id,id)
 where not excluido and (review_status <> 'completed' or processing_status not in ('concluido','revisao_manual'));
do $$begin
 if not exists(select 1 from ceny_before_integrity b where
 b.jobs=(select count(*) from public.jobs) and b.candidates=(select count(*) from public.candidates)
 and b.documents=(select count(*) from public.resume_documents) and b.revisions=(select count(*) from public.candidate_revisions)
 -- The audit trigger appends one immutable revision for each repaired status.
 and b.job_revisions+(select count(*) from private.legacy_job_states)=(select count(*) from public.job_revisions) and b.evaluations=(select count(*) from public.ranking_entries)
 and b.scores=(select count(*) from public.candidate_scores))
 then raise exception 'Inventário divergente. Reverter a migração.';end if;
 if exists (
   select 1 from private.legacy_job_states l join public.jobs j on j.id=l.job_id
   where not exists (select 1 from public.job_revisions r
      where r.company_id=j.company_id and r.job_id=j.id and r.version=j.version
      and r.before_data->>'status'=l.original_status and r.after_data->>'status'=j.status)
 ) then raise exception 'Revisão de correção histórica ausente.';end if;
end$$;

commit;
