-- Vacancy decisions never derive from a person's legacy global status.
alter table public.candidate_job_links
 add column decision_status text not null default 'novo' check(decision_status in ('novo','em_analise','aprovado','rejeitado','contratado')),
 add column shortlisted boolean not null default false,
 add column decision_version bigint not null default 0;
create index candidate_shortlist on public.candidate_job_links(company_id,job_id,candidate_id) where active and shortlisted;
create table public.candidate_decision_events (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,candidate_id uuid not null,job_id uuid not null,
 version bigint not null,actor_id uuid references auth.users(id) on delete set null,actor_name text,
 created_at timestamptz not null default now(),before_status text not null,after_status text not null,
 before_selected boolean not null,after_selected boolean not null,reason text not null check(length(btrim(reason)) between 5 and 2000),
 request_id uuid not null,unique(company_id,candidate_id,job_id,version),unique(company_id,request_id),
 foreign key(company_id,candidate_id,job_id) references public.candidate_job_links(company_id,candidate_id,job_id)
);
create index decision_events_actor on public.candidate_decision_events(actor_id);
create table public.candidate_notes (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,candidate_id uuid not null,job_id uuid,
 actor_id uuid references auth.users(id) on delete set null,actor_name text,
 created_at timestamptz not null default now(),body text not null check(length(btrim(body)) between 1 and 10000),
 request_id uuid not null,unique(company_id,request_id),
 foreign key(company_id,candidate_id) references public.candidates(company_id,id),
 foreign key(company_id,job_id) references public.jobs(company_id,id)
);
create index candidate_notes_timeline on public.candidate_notes(company_id,candidate_id,job_id,created_at desc,id);
create index candidate_notes_job on public.candidate_notes(company_id,job_id);
create index candidate_notes_actor on public.candidate_notes(actor_id);
create table public.candidate_favorites (
 company_id uuid not null,candidate_id uuid not null,user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(company_id,candidate_id,user_id),
 foreign key(company_id,candidate_id) references public.candidates(company_id,id)
);
create index candidate_favorites_user on public.candidate_favorites(user_id,company_id,candidate_id);
alter table public.candidate_decision_events enable row level security;
alter table public.candidate_notes enable row level security;
alter table public.candidate_favorites enable row level security;
revoke all on public.candidate_decision_events,public.candidate_notes,public.candidate_favorites from public,anon,authenticated;
grant select on public.candidate_decision_events,public.candidate_notes,public.candidate_favorites to authenticated;
grant all on public.candidate_decision_events,public.candidate_notes,public.candidate_favorites to service_role;
create policy decision_events_read on public.candidate_decision_events for select to authenticated using(exists(
 select 1 from public.candidate_job_links l where l.company_id=candidate_decision_events.company_id and l.candidate_id=candidate_decision_events.candidate_id and l.job_id=candidate_decision_events.job_id));
create policy candidate_notes_read on public.candidate_notes for select to authenticated using(private.has_role(company_id)
 and exists(select 1 from public.candidates c where c.company_id=candidate_notes.company_id and c.id=candidate_id and not c.excluido)
 and (job_id is null or exists(select 1 from public.jobs j where j.company_id=candidate_notes.company_id and j.id=job_id and not j.excluido)));
create policy candidate_favorites_read on public.candidate_favorites for select to authenticated using(user_id=(select auth.uid()) and private.has_role(company_id)
 and exists(select 1 from public.candidates c where c.company_id=candidate_favorites.company_id and c.id=candidate_id and not c.excluido));

create function private.save_candidate_decision(p_company uuid,p_candidate uuid,p_job uuid,p_version bigint,p_status text,p_selected boolean,p_reason text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.candidate_job_links; previous public.candidate_decision_events;actor_label text;
begin
 perform 1 from public.companies where id=p_company for update;
 if auth.uid() is null or not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_request is null or p_status is null or p_status not in ('novo','em_analise','aprovado','rejeitado','contratado') or p_selected is null
 or coalesce(length(btrim(p_reason)),0) not between 5 and 2000 then raise exception 'Informe a situação e uma justificativa de 5 a 2000 caracteres' using errcode='22023';end if;
 if not exists(select 1 from public.candidates where id=p_candidate and company_id=p_company and not excluido)
 or not exists(select 1 from public.jobs where id=p_job and company_id=p_company and not excluido and status='aberta')
 then raise exception 'Candidato ou vaga indisponível' using errcode='42501';end if;
 select * into previous from public.candidate_decision_events where company_id=p_company and request_id=p_request;
 if found then
  if previous.actor_id is distinct from auth.uid() or previous.candidate_id<>p_candidate or previous.job_id<>p_job
   or previous.after_status<>p_status or previous.after_selected<>p_selected or previous.reason<>btrim(p_reason)
  then raise exception 'Solicitação já utilizada' using errcode='22023';end if;
  return jsonb_build_object('version',previous.version,'reused',true);
 end if;
 select * into l from public.candidate_job_links where company_id=p_company and candidate_id=p_candidate and job_id=p_job and active for update;
 if not found then raise exception 'Associe o candidato à vaga antes de registrar a decisão' using errcode='22023';end if;
 if l.decision_version is distinct from p_version then raise exception 'DECISION_CONFLICT' using errcode='40001';end if;
 if l.decision_status=p_status and l.shortlisted=p_selected then return jsonb_build_object('version',l.decision_version,'unchanged',true);end if;
 select left(full_name,160) into actor_label from public.profiles where id=auth.uid();
 update public.candidate_job_links set decision_status=p_status,shortlisted=p_selected,decision_version=l.decision_version+1,updated_by=auth.uid(),updated_at=now()
 where company_id=p_company and candidate_id=p_candidate and job_id=p_job;
 insert into public.candidate_decision_events(company_id,candidate_id,job_id,version,actor_id,actor_name,before_status,after_status,before_selected,after_selected,reason,request_id)
 values(p_company,p_candidate,p_job,l.decision_version+1,auth.uid(),actor_label,l.decision_status,p_status,l.shortlisted,p_selected,btrim(p_reason),p_request);
 return jsonb_build_object('version',l.decision_version+1,'reused',false);
end $$;
create function public.save_candidate_decision(p_company uuid,p_candidate uuid,p_job uuid,p_version bigint,p_status text,p_selected boolean,p_reason text,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.save_candidate_decision(p_company,p_candidate,p_job,p_version,p_status,p_selected,p_reason,p_request)$$;

create function private.add_candidate_note(p_company uuid,p_candidate uuid,p_job uuid,p_body text,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.candidate_notes;result uuid;actor_label text;
begin
 perform 1 from public.companies where id=p_company for update;
 if auth.uid() is null or not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_request is null or coalesce(length(btrim(p_body)),0) not between 1 and 10000 then raise exception 'Escreva uma nota de até 10000 caracteres' using errcode='22023';end if;
 if not exists(select 1 from public.candidates where company_id=p_company and id=p_candidate and not excluido)
 or (p_job is not null and not exists(select 1 from public.candidate_job_links l join public.jobs j on j.company_id=l.company_id and j.id=l.job_id
 where l.company_id=p_company and l.candidate_id=p_candidate and l.job_id=p_job and l.active and not j.excluido))
 then raise exception 'Candidato ou vínculo indisponível' using errcode='42501';end if;
 select * into previous from public.candidate_notes where company_id=p_company and request_id=p_request;
 if found then
  if previous.actor_id is distinct from auth.uid() or previous.candidate_id<>p_candidate or previous.job_id is distinct from p_job or previous.body<>btrim(p_body)
  then raise exception 'Solicitação já utilizada' using errcode='22023';end if;return previous.id;
 end if;
 select left(full_name,160) into actor_label from public.profiles where id=auth.uid();
 insert into public.candidate_notes(company_id,candidate_id,job_id,actor_id,actor_name,body,request_id)
 values(p_company,p_candidate,p_job,auth.uid(),actor_label,btrim(p_body),p_request) returning id into result;
 return result;
end $$;
create function public.add_candidate_note(p_company uuid,p_candidate uuid,p_job uuid,p_body text,p_request uuid)
returns uuid language sql security invoker set search_path='' as $$select private.add_candidate_note(p_company,p_candidate,p_job,p_body,p_request)$$;

create function private.set_candidate_favorite(p_company uuid,p_candidate uuid,p_favorite boolean) returns void
language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.companies where id=p_company for update;
 if auth.uid() is null or not private.has_role(p_company) then raise exception 'Sem permissão' using errcode='42501';end if;
 if p_favorite is null or not exists(select 1 from public.candidates where company_id=p_company and id=p_candidate and not excluido) then raise exception 'Candidato indisponível' using errcode='42501';end if;
 if p_favorite then insert into public.candidate_favorites(company_id,candidate_id,user_id) values(p_company,p_candidate,auth.uid()) on conflict do nothing;
 else delete from public.candidate_favorites where company_id=p_company and candidate_id=p_candidate and user_id=auth.uid();end if;
end $$;
create function public.set_candidate_favorite(p_company uuid,p_candidate uuid,p_favorite boolean) returns void
language sql security invoker set search_path='' as $$select private.set_candidate_favorite(p_company,p_candidate,p_favorite)$$;

-- One run supplies every comparison column, including candidates without a final result.
create function public.compare_job_candidates(p_company uuid,p_job uuid,p_candidates uuid[])
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare j public.jobs;r public.ranking_runs;result jsonb;
begin
 if coalesce(cardinality(p_candidates),0) not between 2 and 4 or array_position(p_candidates,null) is not null
 or (select count(distinct id) from unnest(p_candidates) id)<>cardinality(p_candidates) then raise exception 'Escolha de 2 a 4 pessoas diferentes' using errcode='22023';end if;
 select * into j from public.jobs where company_id=p_company and id=p_job and not excluido;
 if not found or (select count(*) from public.candidates where company_id=p_company and id=any(p_candidates) and not excluido)<>cardinality(p_candidates)
 then raise exception 'Comparação indisponível' using errcode='42501';end if;
 select * into r from public.ranking_runs where company_id=p_company and job_id=p_job and status='completed' order by completed_at desc,id desc limit 1;
 select jsonb_agg(jsonb_build_object('current',jsonb_build_object('id',c.id,'nome',c.nome,'localizacao',c.localizacao,'skills',c.skills,'anos_experiencia',c.anos_experiencia,
 'review_status',c.review_status,'processing_status',c.processing_status,'review_version',c.review_version,'data_version',c.data_version,'active_document_id',c.active_document_id),
 'entry',to_jsonb(e)) order by array_position(p_candidates,c.id)) into result
 from public.candidates c left join public.ranking_entries e on e.company_id=c.company_id and e.candidate_id=c.id and e.run_id=r.id
 where c.company_id=p_company and c.id=any(p_candidates) and not c.excluido;
 return jsonb_build_object('job',to_jsonb(j),'run',case when r.id is null then null else to_jsonb(r) end,'candidates',result);
end $$;

-- Retire global decision/note editing; prior values and their revision history are retained.
alter function private.validate_review_patch(jsonb) rename to validate_review_patch_v1;
create function private.validate_review_patch(p_patch jsonb) returns void language plpgsql set search_path='' as $$begin
 if p_patch ?| array['status','observacoes'] then raise exception 'Use decisões por vaga ou acrescente uma nota ao histórico' using errcode='22023';end if;
 perform private.validate_review_patch_v1(p_patch);
end $$;
revoke all on function private.validate_review_patch(jsonb) from public,anon,authenticated;

revoke all on function private.save_candidate_decision(uuid,uuid,uuid,bigint,text,boolean,text,uuid),public.save_candidate_decision(uuid,uuid,uuid,bigint,text,boolean,text,uuid),
 private.add_candidate_note(uuid,uuid,uuid,text,uuid),public.add_candidate_note(uuid,uuid,uuid,text,uuid),
 private.set_candidate_favorite(uuid,uuid,boolean),public.set_candidate_favorite(uuid,uuid,boolean),public.compare_job_candidates(uuid,uuid,uuid[]) from public,anon;
grant execute on function private.save_candidate_decision(uuid,uuid,uuid,bigint,text,boolean,text,uuid),public.save_candidate_decision(uuid,uuid,uuid,bigint,text,boolean,text,uuid),
 private.add_candidate_note(uuid,uuid,uuid,text,uuid),public.add_candidate_note(uuid,uuid,uuid,text,uuid),
 private.set_candidate_favorite(uuid,uuid,boolean),public.set_candidate_favorite(uuid,uuid,boolean),public.compare_job_candidates(uuid,uuid,uuid[]) to authenticated;

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
 'notas',coalesce((select jsonb_agg(to_jsonb(e)) from public.candidate_notes e where e.company_id=p_company and e.candidate_id=p_source),'[]'),
 'decisoes',coalesce((select jsonb_agg(to_jsonb(e)) from public.candidate_decision_events e where e.company_id=p_company and e.candidate_id=p_source),'[]'),
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

create or replace function public.browse_candidates(p_company uuid,p_filters jsonb default '{}',p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with args as (select private.search_query(p_filters->>'q') q,private.search_query(p_filters->>'skill') skill,
 private.search_query(p_filters->>'location') location, private.search_min(p_filters->>'minExperience') min_exp),
 base as not materialized (select id,nome,email,telefone,localizacao,arquivo_nome,skills,anos_experiencia,status,processing_status,review_status,created_at,exists(select 1 from public.candidate_favorites f where f.company_id=p_company and f.candidate_id=candidates.id and f.user_id=(select auth.uid())) is_favorite
 from public.candidates where company_id=p_company and not excluido),
 filtered as materialized (select c.* from base c,args a where
 (numnode(a.q)=0 or private.search_vector(coalesce(nome,'')||' '||coalesce(email,'')||' '||coalesce(telefone,'')||' '||coalesce(localizacao,'')||' '||private.skill_search_text(skills)) @@ a.q)
 and (numnode(a.skill)=0 or private.search_vector(private.skill_search_text(skills)) @@ a.skill)
 and (numnode(a.location)=0 or private.search_vector(localizacao) @@ a.location)
 and (a.min_exp is null or anos_experiencia>=a.min_exp)
 and (coalesce(p_filters->>'favorite','all')='all' or is_favorite)
 and (coalesce(p_filters->>'status','todos')='todos' or status=p_filters->>'status')
 and (coalesce(p_filters->>'processing','todos')='todos' or processing_status=p_filters->>'processing')
 and (coalesce(p_filters->>'review','todos')='todos' or review_status=p_filters->>'review')),
 counts as (select (select count(*) from base) total,count(*) filtered from filtered),
 meta as (select *,least(greatest(coalesce(p_page,0),0),greatest(0,(filtered-1)/25)) page from counts),
 items as (select * from filtered order by created_at desc,id limit 25 offset (select page*25 from meta))
 select jsonb_build_object('total',total,'filtered',filtered,'page',page,'pageSize',25,'items',
 coalesce((select jsonb_agg(to_jsonb(i) order by created_at desc,id) from items i),'[]'::jsonb)) from meta
$$;
