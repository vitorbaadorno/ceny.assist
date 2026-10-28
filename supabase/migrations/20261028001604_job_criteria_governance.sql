alter table public.jobs add column criteria jsonb not null default '[]', add column version bigint not null default 0,
 add column approved_hash text, add column approved_by uuid references auth.users(id) on delete set null,
 add column approved_at timestamptz, add column updated_by uuid references auth.users(id) on delete set null;
create index jobs_updated_by on public.jobs(updated_by);
create index jobs_approved_by on public.jobs(approved_by);
alter table public.candidate_scores add column job_version bigint, add column criteria_hash text;
update public.candidate_scores set stale=true;
update public.job_reports set stale=true;

create table public.job_revisions (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,job_id uuid not null,version bigint not null,
 actor_id uuid references auth.users(id) on delete set null,actor_name text,created_at timestamptz not null default clock_timestamp(),
 action text not null, before_data jsonb,after_data jsonb not null,unique(job_id,version),
 foreign key(company_id,job_id) references public.jobs(company_id,id) on delete cascade
);
create index job_revisions_company_job on public.job_revisions(company_id,job_id,version desc);
create index job_revisions_actor on public.job_revisions(actor_id);
create table public.job_templates (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),name text not null check(length(btrim(name)) between 3 and 160),
 payload jsonb not null,created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default clock_timestamp()
);
create index job_templates_company on public.job_templates(company_id,created_at desc);
create index job_templates_creator on public.job_templates(created_by);
alter table public.job_revisions enable row level security;
alter table public.job_templates enable row level security;
revoke all on public.job_revisions,public.job_templates from public,anon,authenticated;
grant select on public.job_revisions,public.job_templates to authenticated;
grant all on public.job_revisions,public.job_templates to service_role;
create policy job_revisions_read on public.job_revisions for select to authenticated using(private.has_role(company_id) and exists(select 1 from public.jobs j where j.id=job_id and j.company_id=job_revisions.company_id and not j.excluido));
create policy job_templates_read on public.job_templates for select to authenticated using(private.has_role(company_id));

create function private.criterion_key(p_text text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(btrim(translate(lower(p_text),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn')),'\s+',' ','g')
$$;
create function private.normalize_job_criteria(p_items jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare item jsonb; result jsonb:='[]'; k text; previous jsonb; idx integer; n integer;
begin
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Critérios inválidos' using errcode='22023';end if;
 if jsonb_array_length(p_items)>60 or octet_length(p_items::text)>60000 then raise exception 'Limite de critérios excedido' using errcode='22023';end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or not item ?& array['kind','text','min_years','required','weight','source'] then raise exception 'Critério incompleto' using errcode='22023';end if;
  if exists(select 1 from jsonb_object_keys(item) f where f<>all(array['kind','text','min_years','required','weight','source'])) then raise exception 'Campo de critério inválido' using errcode='22023';end if;
  if item->>'kind' not in ('skill','experience','education','location') or jsonb_typeof(item->'kind')<>'string' or jsonb_typeof(item->'text')<>'string' or length(btrim(item->>'text')) not between 1 and 200
   or jsonb_typeof(item->'required')<>'boolean' or jsonb_typeof(item->'weight')<>'number' then raise exception 'Critério inválido' using errcode='22023';end if;
  if (item->>'weight')::numeric not between 1 and 100 or trunc((item->>'weight')::numeric)<>(item->>'weight')::numeric then raise exception 'Peso deve ser inteiro entre 1 e 100' using errcode='22023';end if;
  if item->>'kind'='experience' then
   if jsonb_typeof(item->'min_years')<>'number' then raise exception 'Informe experiência mínima numérica' using errcode='22023';end if;
   if (item->>'min_years')::numeric not between 0 and 100 then raise exception 'Experiência mínima inválida' using errcode='22023';end if;
  elsif item->'min_years'<>'null'::jsonb then raise exception 'Experiência numérica somente no critério de experiência' using errcode='22023';end if;
  if item->'source'<>'null'::jsonb and (jsonb_typeof(item->'source')<>'string' or length(item->>'source') not between 1 and 2000) then raise exception 'Trecho de origem inválido' using errcode='22023';end if;
  item:=item||jsonb_build_object('text',btrim(item->>'text'));
  k:=item->>'kind'||':'||case when item->>'kind'='skill' then private.criterion_key(item->>'text') else '' end;
  idx:=null;n:=0;
  for previous in select * from jsonb_array_elements(result) loop
   if ((previous->>'kind')||':'||(case when previous->>'kind'='skill' then private.criterion_key(previous->>'text') else '' end))=k then idx:=n;exit;end if;
   n:=n+1;
  end loop;
  if idx is null then result:=result||jsonb_build_array(item);
  else
   if item->>'kind'<>'skill' and (private.criterion_key(item->>'text')<>private.criterion_key(previous->>'text') or item->'min_years'<>previous->'min_years') then raise exception 'Defina um único critério coerente de experiência, formação ou localização' using errcode='22023';end if;
   result:=jsonb_set(result,array[idx::text],previous||jsonb_build_object('required',(previous->>'required')::boolean or (item->>'required')::boolean,'weight',greatest((previous->>'weight')::integer,(item->>'weight')::integer)));
  end if;
 end loop;
 return result;
end $$;
create function private.job_payload(p_title text,p_description text,p_category text,p_criteria jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('titulo',p_title,'descricao',p_description,'categoria',p_category,'criteria',p_criteria)
$$;
create function private.job_hash(p_payload jsonb) returns text language sql immutable set search_path='' as $$ select encode(extensions.digest(p_payload::text,'sha256'),'hex') $$;
create function private.validate_job_payload(p_payload jsonb,p_approve boolean default false) returns jsonb language plpgsql set search_path='' as $$
declare p jsonb; item jsonb;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>100000 or not p_payload ?& array['titulo','descricao','categoria','criteria'] then raise exception 'Dados da vaga inválidos' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(array['titulo','descricao','categoria','criteria'])) then raise exception 'Campo da vaga não permitido' using errcode='22023';end if;
 if jsonb_typeof(p_payload->'titulo')<>'string' or length(btrim(p_payload->>'titulo')) not between 3 and 160 or jsonb_typeof(p_payload->'descricao')<>'string' or length(p_payload->>'descricao')>20000
 or jsonb_typeof(p_payload->'categoria')<>'string' or p_payload->>'categoria' not in ('regular','jovem_aprendiz') then raise exception 'Confira título, descrição e categoria' using errcode='22023';end if;
 p:=private.job_payload(btrim(p_payload->>'titulo'),btrim(p_payload->>'descricao'),p_payload->>'categoria',private.normalize_job_criteria(p_payload->'criteria'));
 if p_approve is true then
  if length(p->>'descricao')<20 or not exists(select 1 from jsonb_array_elements(p->'criteria') c where c->>'kind' in ('skill','education') or (c->>'kind'='experience' and (c->>'min_years')::numeric>0)) then raise exception 'Descreva a vaga e defina ao menos uma competência, formação ou experiência positiva antes de aprovar' using errcode='22023';end if;
  for item in select * from jsonb_array_elements(p->'criteria') loop
   if item->>'source' is not null and strpos(private.criterion_key(p->>'descricao'),private.criterion_key(item->>'source'))=0 then raise exception 'Um trecho de origem mudou. Confira o critério e sua relação com a descrição' using errcode='22023';end if;
  end loop;
 end if;
 return p;
end $$;

-- Preserve preexisting criteria as an unapproved baseline; no invented approval.
update public.jobs j set criteria=coalesce((select jsonb_agg(item) from (
 select jsonb_build_object('kind','skill','text',r,'min_years',null,'required',true,'weight',5,'source',null) item from unnest(j.requisitos_obrigatorios) r where length(btrim(r))>0
 union all select jsonb_build_object('kind','skill','text',r,'min_years',null,'required',false,'weight',3,'source',null) from unnest(j.requisitos_desejaveis) r where length(btrim(r))>0
 union all select jsonb_build_object('kind','experience','text','Experiência mínima','min_years',j.experiencia_minima,'required',true,'weight',5,'source',null) where j.experiencia_minima>0
 union all select jsonb_build_object('kind','education','text',j.formacao_exigida,'min_years',null,'required',true,'weight',5,'source',null) where length(btrim(j.formacao_exigida))>0
 union all select jsonb_build_object('kind','location','text',j.localizacao,'min_years',null,'required',false,'weight',2,'source',null) where length(btrim(j.localizacao))>0
 ) s),'[]');
insert into public.job_revisions(company_id,job_id,version,actor_id,action,after_data)
 select company_id,id,0,created_by,'legacy_baseline',to_jsonb(j) from public.jobs j;

create function private.guard_job_criteria() returns trigger language plpgsql set search_path='' as $$
declare p jsonb;old_hash text;
begin
 if length(btrim(new.titulo)) not between 3 and 160 or length(coalesce(new.descricao,''))>20000 or new.experiencia_minima not between 0 and 100 or new.experiencia_minima::text in ('NaN','Infinity','-Infinity')
 or new.status not in ('aberta','encerrada') or new.categoria not in ('regular','jovem_aprendiz') then raise exception 'Dados de vaga inválidos' using errcode='22023';end if;
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
create trigger guard_job_criteria before insert or update on public.jobs for each row execute function private.guard_job_criteria();
create function private.audit_job_change() returns trigger language plpgsql security definer set search_path='' as $$
declare who uuid;display_name text;
begin
 if tg_op='UPDATE' and new.version=old.version then return new;end if;
 who:=auth.uid();if who is not null and not private.has_role(new.company_id,array['owner','admin','recruiter']) then who:=null;end if;
 select left(full_name,160) into display_name from public.profiles where id=who;
 insert into public.job_revisions(company_id,job_id,version,actor_id,actor_name,action,before_data,after_data)
 values(new.company_id,new.id,new.version,who,display_name,case when tg_op='INSERT' then 'create' when new.excluido then 'archive' when new.status<>old.status then new.status when new.approved_hash is not null then 'approve' else 'edit' end,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 if tg_op='UPDATE' then
  update public.candidate_scores set stale=true where company_id=new.company_id and job_id=new.id;
  update public.job_reports set stale=true where company_id=new.company_id and job_id=new.id;
 end if;
 return new;
end $$;
create trigger audit_job_change after insert or update on public.jobs for each row execute function private.audit_job_change();

create function private.save_job(p_company uuid,p_job uuid,p_expected_version bigint,p_payload jsonb,p_approve boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs;p jsonb;h text;
begin
 if auth.uid() is null then raise exception 'Sem permissão' using errcode='42501';end if;
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão para gerenciar vagas' using errcode='42501';end if;
 p:=private.validate_job_payload(p_payload,p_approve);
 if p_job is null then
  if p_expected_version is distinct from 0 then raise exception 'JOB_CONFLICT' using errcode='40001';end if;
  insert into public.jobs(company_id,titulo,descricao,categoria,criteria,created_by,updated_by,approved_hash,approved_by,approved_at)
  values(p_company,p->>'titulo',p->>'descricao',p->>'categoria',p->'criteria',auth.uid(),auth.uid(),case when p_approve then private.job_hash(p) end,case when p_approve then auth.uid() end,case when p_approve then clock_timestamp() end) returning * into j;
 else
  select * into j from public.jobs where id=p_job and company_id=p_company and not excluido for update;
  if not found then raise exception 'Vaga indisponível' using errcode='42501';end if;
  if p_expected_version is distinct from j.version then raise exception 'JOB_CONFLICT' using errcode='40001';end if;
  h:=case when p_approve then private.job_hash(p) when j.approved_hash=private.job_hash(p) then j.approved_hash else null end;
  update public.jobs set titulo=p->>'titulo',descricao=p->>'descricao',categoria=p->>'categoria',criteria=p->'criteria',updated_by=auth.uid(),
   approved_hash=h,approved_by=case when p_approve then auth.uid() when h is not null then approved_by end,approved_at=case when p_approve then clock_timestamp() when h is not null then approved_at end
  where id=p_job and company_id=p_company returning * into j;
 end if;
 return to_jsonb(j);
end $$;
create function public.save_job(p_company uuid,p_job uuid,p_expected_version bigint,p_payload jsonb,p_approve boolean default false) returns jsonb language sql security invoker set search_path='' as $$select private.save_job(p_company,p_job,p_expected_version,p_payload,p_approve)$$;
create function private.set_job_status(p_company uuid,p_job uuid,p_expected_version bigint,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs;
begin
 if auth.uid() is null then raise exception 'Sem permissão' using errcode='42501';end if;
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão' using errcode='42501';end if;
 select * into j from public.jobs where id=p_job and company_id=p_company and not excluido for update;
 if not found then raise exception 'Vaga indisponível' using errcode='42501';end if;
 if p_expected_version is distinct from j.version then raise exception 'JOB_CONFLICT' using errcode='40001';end if;
 if p_status is null or p_status not in ('aberta','encerrada') then raise exception 'Status inválido' using errcode='22023';end if;
 update public.jobs set status=p_status,updated_by=auth.uid() where id=p_job and company_id=p_company returning * into j;
 return to_jsonb(j);
end $$;
create function public.set_job_status(p_company uuid,p_job uuid,p_expected_version bigint,p_status text) returns jsonb language sql security invoker set search_path='' as $$select private.set_job_status(p_company,p_job,p_expected_version,p_status)$$;
create function private.create_job_template(p_company uuid,p_name text,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare template uuid;p jsonb;
begin
 if auth.uid() is null then raise exception 'Sem permissão' using errcode='42501';end if;
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão' using errcode='42501';end if;
 p:=private.validate_job_payload(p_payload,false);
 insert into public.job_templates(company_id,name,payload,created_by) values(p_company,btrim(p_name),p,auth.uid()) returning id into template;return template;
end $$;
create function public.create_job_template(p_company uuid,p_name text,p_payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.create_job_template(p_company,p_name,p_payload) $$;

revoke insert(company_id,titulo,descricao,requisitos_obrigatorios,requisitos_desejaveis,experiencia_minima,formacao_exigida,localizacao,categoria),update(titulo,descricao,requisitos_obrigatorios,requisitos_desejaveis,experiencia_minima,formacao_exigida,localizacao,categoria,status) on public.jobs from authenticated;
revoke all on function private.criterion_key(text),private.normalize_job_criteria(jsonb),private.job_payload(text,text,text,jsonb),private.job_hash(jsonb),private.validate_job_payload(jsonb,boolean),private.guard_job_criteria(),private.audit_job_change(),private.save_job(uuid,uuid,bigint,jsonb,boolean),public.save_job(uuid,uuid,bigint,jsonb,boolean),private.set_job_status(uuid,uuid,bigint,text),public.set_job_status(uuid,uuid,bigint,text),private.create_job_template(uuid,text,jsonb),public.create_job_template(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.save_job(uuid,uuid,bigint,jsonb,boolean),public.save_job(uuid,uuid,bigint,jsonb,boolean),private.set_job_status(uuid,uuid,bigint,text),public.set_job_status(uuid,uuid,bigint,text),private.create_job_template(uuid,text,jsonb),public.create_job_template(uuid,text,jsonb) to authenticated;
grant execute on function private.criterion_key(text),private.normalize_job_criteria(jsonb),private.job_payload(text,text,text,jsonb),private.job_hash(jsonb),private.validate_job_payload(jsonb,boolean) to service_role;

-- Retire the unversioned ranking writer. Empty batches also require a version.
revoke execute on function public.replace_job_scores(uuid,uuid,uuid,jsonb) from service_role;
create function public.replace_job_scores_v2(p_actor uuid,p_company uuid,p_job uuid,p_job_version bigint,p_criteria_hash text,p_scores jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare j public.jobs;
begin
 perform 1 from public.companies where id=p_company for update;
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501';end if;
 select * into j from public.jobs where id=p_job and company_id=p_company and not excluido for update;
 if not found then raise exception 'Vaga indisponível' using errcode='42501';end if;
 if j.version is distinct from p_job_version or j.approved_hash is distinct from p_criteria_hash then raise exception 'Critérios alterados durante a avaliação' using errcode='40001';end if;
 if j.status<>'aberta' or j.approved_hash is null or j.approved_hash<>private.job_hash(private.job_payload(j.titulo,coalesce(j.descricao,''),j.categoria,j.criteria)) then raise exception 'Vaga encerrada ou critérios não aprovados' using errcode='22023';end if;
 perform private.validate_job_payload(private.job_payload(j.titulo,coalesce(j.descricao,''),j.categoria,j.criteria),true);
 if p_scores is null or jsonb_typeof(p_scores)<>'array' then raise exception 'Avaliação inválida' using errcode='22023';end if;
 perform 1 from public.candidates where company_id=p_company and id in(select (value->>'candidate_id')::uuid from jsonb_array_elements(p_scores)) order by id for share;
 if exists(select 1 from jsonb_array_elements(p_scores) s where not exists(select 1 from public.candidates c where c.id=(s->>'candidate_id')::uuid and c.company_id=p_company and not c.excluido and c.processing_status in ('concluido','revisao_manual'))) then raise exception 'Candidato incompatível' using errcode='23503';end if;
 if exists(select 1 from jsonb_array_elements(p_scores) s join public.candidates c on c.id=(s->>'candidate_id')::uuid where (s->>'candidate_version')::bigint is distinct from c.data_version) then raise exception 'Dados do candidato alterados' using errcode='40001';end if;
 delete from public.candidate_scores where company_id=p_company and job_id=p_job;
 insert into public.candidate_scores(company_id,candidate_id,job_id,score,detalhes_matching,candidate_version,stale,job_version,criteria_hash)
 select p_company,(s->>'candidate_id')::uuid,p_job,(s->>'score')::numeric,s->'detalhes_matching',(s->>'candidate_version')::bigint,false,j.version,j.approved_hash from jsonb_array_elements(p_scores)s;
 update public.job_reports set stale=true where company_id=p_company and job_id=p_job;
end $$;
revoke all on function public.replace_job_scores_v2(uuid,uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.replace_job_scores_v2(uuid,uuid,uuid,bigint,text,jsonb) to service_role;
