-- Bounded company browsing. All reads use caller privileges and existing RLS.
create function private.search_normalize(value text) returns text
language sql immutable parallel safe set search_path='' as $$
 select translate(lower(coalesce(value,'')), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')
$$;
create function private.search_terms(value text) returns text
language plpgsql immutable parallel safe set search_path='' as $$
declare result text:=private.search_normalize(value); aliases text[]; pair text[];
begin
 -- Literal boundaries prevent JavaScript/Java and C/C++ confusion.
 result:=regexp_replace(result,'\mc\+\+',' cplusplus ','g');
 result:=regexp_replace(result,'\mc#',' csharp ','g');
 foreach aliases slice 1 in array array[
 ['javascript','js|ecmascript'],['typescript','ts'],['excel','microsoft excel|ms excel'],
 ['powerbi','microsoft power bi|power bi'],['postgresql','postgres'],
 ['rh','recursos humanos'],['gestaoprojetos','gestao de projetos|gerenciamento de projetos|project management'],
 ['ingles','english'],['administracao','administration']
 ] loop
 result:=regexp_replace(result,'\m('||aliases[2]||')\M',aliases[1],'g');
 end loop;
 return result;
end $$;
create function private.search_vector(value text) returns tsvector
language sql immutable parallel safe set search_path='' as $$select to_tsvector('simple'::regconfig,private.search_terms(value))$$;
create function private.search_query(value text) returns tsquery
language sql immutable parallel safe set search_path='' as $$
 select plainto_tsquery('simple'::regconfig,regexp_replace(
 regexp_replace(private.search_terms(left(coalesce(value,''),200)), '^\s*(buscar|busco|procuro|procurar|encontrar)\s+(candidatos?|pessoas?|profissionais)\s*','','g'),
 '\m(com|de|da|do|em|e|para)\M',' ','g'))
$$;
create function private.skill_search_text(value text[]) returns text
language sql immutable parallel safe set search_path='' as $$
 select coalesce(string_agg(s,' '),'') from unnest(value) s
 where private.search_normalize(s) !~ '\m(nao|sem|nunca|not|no|never|without)\M'
$$;
create function private.search_min(value text) returns numeric
language plpgsql immutable set search_path='' as $$begin
 if value is null or value='' then return null;end if;
 if value !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' or value::numeric>100 then
 raise exception 'Use um número entre 0 e 100' using errcode='22023';end if;
 return value::numeric;
end $$;
create index candidates_browse_order on public.candidates(company_id,created_at desc,id) where not excluido;
create index jobs_browse_order on public.jobs(company_id,created_at desc,id) where not excluido;
create index candidates_search_terms on public.candidates using gin(private.search_vector(coalesce(nome,'')||' '||coalesce(email,'')||' '||coalesce(telefone,'')||' '||coalesce(localizacao,'')||' '||private.skill_search_text(skills))) where not excluido;
create index candidates_search_skills on public.candidates using gin(private.search_vector(private.skill_search_text(skills))) where not excluido;
create index jobs_search_terms on public.jobs using gin(private.search_vector(coalesce(titulo,'')||' '||coalesce(descricao,'')||' '||coalesce(localizacao,''))) where not excluido;
create index ranking_browse_score on public.ranking_entries(company_id,run_id,score desc,candidate_id);

create function public.browse_candidates(p_company uuid,p_filters jsonb default '{}',p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with args as (select private.search_query(p_filters->>'q') q,private.search_query(p_filters->>'skill') skill,
 private.search_query(p_filters->>'location') location, private.search_min(p_filters->>'minExperience') min_exp),
 base as not materialized (select id,nome,email,telefone,localizacao,arquivo_nome,skills,anos_experiencia,status,processing_status,review_status,created_at
 from public.candidates where company_id=p_company and not excluido),
 filtered as materialized (select c.* from base c,args a where
 (numnode(a.q)=0 or private.search_vector(coalesce(nome,'')||' '||coalesce(email,'')||' '||coalesce(telefone,'')||' '||coalesce(localizacao,'')||' '||private.skill_search_text(skills)) @@ a.q)
 and (numnode(a.skill)=0 or private.search_vector(private.skill_search_text(skills)) @@ a.skill)
 and (numnode(a.location)=0 or private.search_vector(localizacao) @@ a.location)
 and (a.min_exp is null or anos_experiencia>=a.min_exp)
 and (coalesce(p_filters->>'status','todos')='todos' or status=p_filters->>'status')
 and (coalesce(p_filters->>'processing','todos')='todos' or processing_status=p_filters->>'processing')
 and (coalesce(p_filters->>'review','todos')='todos' or review_status=p_filters->>'review')),
 counts as (select (select count(*) from base) total,count(*) filtered from filtered),
 meta as (select *,least(greatest(coalesce(p_page,0),0),greatest(0,(filtered-1)/25)) page from counts),
 items as (select * from filtered order by created_at desc,id limit 25 offset (select page*25 from meta))
 select jsonb_build_object('total',total,'filtered',filtered,'page',page,'pageSize',25,'items',
 coalesce((select jsonb_agg(to_jsonb(i) order by created_at desc,id) from items i),'[]'::jsonb)) from meta
$$;
create function public.browse_jobs(p_company uuid,p_filters jsonb default '{}',p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with args as (select private.search_query(p_filters->>'q') q,private.search_query(p_filters->>'location') location),
 base as not materialized (select * from public.jobs where company_id=p_company and not excluido),
 filtered as materialized (select j.* from base j,args a where
 (numnode(a.q)=0 or private.search_vector(coalesce(titulo,'')||' '||coalesce(descricao,'')||' '||coalesce(localizacao,'')) @@ a.q)
 and (numnode(a.location)=0 or private.search_vector(localizacao) @@ a.location)
 and (coalesce(p_filters->>'status','todas')='todas' or status=p_filters->>'status')
 and (coalesce(p_filters->>'category','todas')='todas' or categoria=p_filters->>'category')),
 counts as (select (select count(*) from base) total,count(*) filtered from filtered),
 meta as (select *,least(greatest(coalesce(p_page,0),0),greatest(0,(filtered-1)/25)) page from counts),
 items as (select * from filtered order by created_at desc,id limit 25 offset (select page*25 from meta))
 select jsonb_build_object('total',total,'filtered',filtered,'page',page,'pageSize',25,'items',
 coalesce((select jsonb_agg(to_jsonb(i) order by created_at desc,id) from items i),'[]'::jsonb)) from meta
$$;
create function public.browse_ranking(p_company uuid,p_run uuid,p_filters jsonb default '{}',p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with args as (select private.search_query(p_filters->>'q') q,private.search_query(p_filters->>'location') location,
 private.search_min(p_filters->>'minExperience') min_exp,private.search_min(p_filters->>'minScore') min_score),
 base as not materialized (select e.* from public.ranking_entries e where e.company_id=p_company and e.run_id=p_run
 and exists(select 1 from public.ranking_runs r where r.id=e.run_id and r.company_id=p_company and r.status='completed')),
 filtered as materialized (select e.* from base e,args a where
 (numnode(a.q)=0 or private.search_vector(coalesce(snapshot->>'nome','')||' '||coalesce(snapshot->>'localizacao','')||' '||coalesce(snapshot->>'skills','')) @@ a.q)
 and (numnode(a.location)=0 or private.search_vector(snapshot->>'localizacao') @@ a.location)
 and (a.min_exp is null or (snapshot->>'anos_experiencia')::numeric>=a.min_exp)
 and (a.min_score is null or score>=a.min_score)
 and (case coalesce(p_filters->>'outcome','final') when 'all' then true when 'pending' then reason is not null else reason is null and score is not null end)
 and (coalesce(p_filters->>'required','all')='all' or
 (jsonb_array_length(coalesce(details->'criterios','[]'))>0 and not exists(select 1 from jsonb_array_elements(details->'criterios') criterion
 where criterion->>'required'='true' and criterion->>'estado' is distinct from 'atendido')))
 and (coalesce(p_filters->>'criterion','')='' or exists(select 1 from jsonb_array_elements(details->'criterios') criterion
 where private.search_vector(criterion->>'text') @@ private.search_query(p_filters->>'criterion')
 and (coalesce(p_filters->>'criterionState','all')='all' or criterion->>'estado'=p_filters->>'criterionState')))),
 counts as (select (select count(*) from base) total,count(*) filtered from filtered),
 meta as (select *,least(greatest(coalesce(p_page,0),0),greatest(0,(filtered-1)/25)) page from counts),
 items as (select * from filtered order by score desc nulls last,candidate_id limit 25 offset (select page*25 from meta))
 select jsonb_build_object('total',total,'filtered',filtered,'page',page,'pageSize',25,'items',
 coalesce((select jsonb_agg(to_jsonb(i) order by score desc nulls last,candidate_id) from items i),'[]'::jsonb)) from meta
$$;
revoke all on function private.search_normalize(text), private.search_terms(text),private.search_vector(text),private.search_query(text),private.skill_search_text(text[]),private.search_min(text) from public,anon;
grant execute on function private.search_normalize(text),private.search_terms(text),private.search_vector(text),private.search_query(text),private.skill_search_text(text[]),private.search_min(text) to authenticated,service_role;
revoke all on function public.browse_candidates(uuid,jsonb,integer), public.browse_jobs(uuid,jsonb,integer),public.browse_ranking(uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.browse_candidates(uuid,jsonb,integer), public.browse_jobs(uuid,jsonb,integer),public.browse_ranking(uuid,uuid,jsonb,integer) to authenticated,service_role;
