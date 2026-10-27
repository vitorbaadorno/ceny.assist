-- Original bytes, AI extraction and human corrections have independent lifecycles.
alter table public.candidates
 add column correcoes_rh jsonb not null default '{}',
 add column dados_efetivos jsonb not null default '{}',
 add column review_version bigint not null default 0,
 add column data_version bigint not null default 0,
 add column review_status text not null default 'pending' check(review_status in ('pending','draft','completed')),
 add column reviewed_at timestamptz,
 add column reviewed_by uuid references auth.users(id) on delete set null;
create index candidates_reviewed_by on public.candidates(reviewed_by);
alter table public.candidate_scores add column candidate_version bigint, add column stale boolean not null default true;
alter table public.job_reports add column stale boolean not null default true;

create table public.candidate_revisions (
 id uuid primary key default gen_random_uuid(), company_id uuid not null, candidate_id uuid not null,
 version bigint not null, actor_id uuid references auth.users(id) on delete set null,
 actor_name text, created_at timestamptz not null default clock_timestamp(),
 action text not null check(action in ('save','complete','legacy_baseline')),
 changes jsonb not null, unique(candidate_id,version),
 foreign key(company_id,candidate_id) references public.candidates(company_id,id) on delete cascade
);
create index candidate_revisions_company_candidate on public.candidate_revisions(company_id,candidate_id,version desc);
create index candidate_revisions_actor on public.candidate_revisions(actor_id);
alter table public.candidate_revisions enable row level security;
revoke all on public.candidate_revisions from public,anon,authenticated;
grant select on public.candidate_revisions to authenticated;
grant all on public.candidate_revisions to service_role;
create policy revisions_read on public.candidate_revisions for select to authenticated using(
 private.has_role(company_id) and exists(select 1 from public.candidates c where c.company_id=candidate_revisions.company_id and c.id=candidate_id and not c.excluido));

create function private.review_fields() returns text[] language sql immutable set search_path='' as $$
 select array['nome_completo','email','telefone','localizacao','data_nascimento','formacao_academica','experiencias','skills','idiomas','certificacoes','anos_experiencia_total']::text[]
$$;
create function private.review_defaults() returns jsonb language sql immutable set search_path='' as $$
 select '{"nome_completo":null,"email":null,"telefone":null,"localizacao":null,"data_nascimento":null,"formacao_academica":[],"experiencias":[],"skills":[],"idiomas":[],"certificacoes":[],"anos_experiencia_total":null}'::jsonb
$$;

-- Preserve existing differing scalar values without falsely assigning a reviewer.
update public.candidates c set correcoes_rh=coalesce((select jsonb_object_agg(key,value) from jsonb_each(jsonb_build_object(
 'nome_completo',c.nome,'email',c.email,'telefone',c.telefone,'localizacao',c.localizacao,'data_nascimento',c.data_nascimento,
 'skills',c.skills,'anos_experiencia_total',c.anos_experiencia)) where value is distinct from coalesce(c.dados_extraidos->key,'null'::jsonb)
 and not (key='skills' and value='[]'::jsonb and not c.dados_extraidos ? key)), '{}'::jsonb);
update public.candidates set dados_efetivos=private.review_defaults()||dados_extraidos||correcoes_rh;
insert into public.candidate_revisions(company_id,candidate_id,version,action,changes)
 select company_id,id,0,'legacy_baseline',jsonb_build_object('valores_preservados',correcoes_rh) from public.candidates where correcoes_rh<>'{}';

create function private.merge_candidate_review() returns trigger language plpgsql set search_path='' as $$
begin
 new.dados_efetivos:=private.review_defaults()||new.dados_extraidos||new.correcoes_rh;
 new.nome:=new.dados_efetivos->>'nome_completo';new.email:=new.dados_efetivos->>'email';
 new.telefone:=new.dados_efetivos->>'telefone';new.localizacao:=new.dados_efetivos->>'localizacao';
 new.data_nascimento:=(new.dados_efetivos->>'data_nascimento')::date;
 new.skills:=array(select jsonb_array_elements_text(new.dados_efetivos->'skills'));
 new.anos_experiencia:=(new.dados_efetivos->>'anos_experiencia_total')::numeric;
 if tg_op='UPDATE' then
  if new.dados_extraidos is distinct from old.dados_extraidos or new.correcoes_rh is distinct from old.correcoes_rh then
   new.review_version:=old.review_version+1;
  end if;
  if new.dados_efetivos is distinct from old.dados_efetivos then new.data_version:=old.data_version+1;end if;
 end if;
 return new;
end $$;
create trigger merge_candidate_review before update of dados_extraidos,correcoes_rh on public.candidates for each row execute function private.merge_candidate_review();
create trigger initialize_candidate_review before insert on public.candidates for each row execute function private.merge_candidate_review();
create function private.invalidate_candidate_assessments() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.data_version<>old.data_version then
  update public.candidate_scores set stale=true where company_id=new.company_id and candidate_id=new.id;
  update public.job_reports set stale=true where company_id=new.company_id;
 end if;
 return new;
end $$;
create trigger invalidate_candidate_assessments after update of data_version on public.candidates for each row execute function private.invalidate_candidate_assessments();
-- Trigger changed columns also fire when not named in UPDATE.
drop trigger invalidate_candidate_assessments on public.candidates;
create trigger invalidate_candidate_assessments after update on public.candidates for each row when(new.data_version is distinct from old.data_version) execute function private.invalidate_candidate_assessments();

create function private.validate_review_patch(p_patch jsonb) returns void language plpgsql set search_path='' as $$
declare k text;v jsonb;item jsonb;field text;dt date;starts text;ends text;
begin
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or octet_length(p_patch::text)>100000 then raise exception 'Dados de revisão inválidos' using errcode='22023';end if;
 for k,v in select * from jsonb_each(p_patch) loop
  if not k=any(private.review_fields()||array['status','observacoes']) then raise exception 'Campo não permitido' using errcode='22023';end if;
  if k=any(array['skills','idiomas','certificacoes']) then
   if jsonb_typeof(v)<>'array' then raise exception 'Lista inválida' using errcode='22023';end if;
   if jsonb_array_length(v)>100 then raise exception 'Lista excede o limite' using errcode='22023';end if;
   for item in select * from jsonb_array_elements(v) loop
    if jsonb_typeof(item)<>'string' or length(btrim(item#>>'{}')) not between 1 and 120 then raise exception 'Item de lista inválido' using errcode='22023';end if;
   end loop;
  elsif k in ('experiencias','formacao_academica') then
   if jsonb_typeof(v)<>'array' then raise exception 'Lista inválida' using errcode='22023';end if;
   if jsonb_array_length(v)>60 then raise exception 'Lista excede o limite' using errcode='22023';end if;
   for item in select * from jsonb_array_elements(v) loop
    if jsonb_typeof(item)<>'object' then raise exception 'Registro inválido' using errcode='22023';end if;
    for field in select jsonb_object_keys(item) loop
     if not field=any(case when k='experiencias' then array['empresa','cargo','periodo','descricao','inicio','fim','atual'] else array['curso','instituicao','nivel','periodo','inicio','fim'] end) then raise exception 'Campo de registro inválido' using errcode='22023';end if;
     if field='atual' then
      if jsonb_typeof(item->field)<>'boolean' then raise exception 'Situação do trabalho inválida' using errcode='22023';end if;
     elsif item->field<>'null'::jsonb and (jsonb_typeof(item->field)<>'string' or length(item->>field)>2000) then raise exception 'Texto inválido' using errcode='22023';end if;
    end loop;
    starts:=item->>'inicio';ends:=item->>'fim';
    if (starts is not null and starts!~'^(19|20)[0-9]{2}(-(0[1-9]|1[0-2]))?$') or (ends is not null and ends!~'^(19|20)[0-9]{2}(-(0[1-9]|1[0-2]))?$') then raise exception 'Use AAAA ou AAAA-MM nos períodos' using errcode='22023';end if;
    if starts is not null and ends is not null and starts>ends then raise exception 'O fim não pode anteceder o início' using errcode='22023';end if;
    if k='experiencias' and (starts>to_char(current_date,'YYYY-MM') or ends>to_char(current_date,'YYYY-MM') or (coalesce((item->>'atual')::boolean,false) and ends is not null)) then raise exception 'Período de trabalho inválido' using errcode='22023';end if;
   end loop;
  elsif k='anos_experiencia_total' then
   if v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric not between 0 and 100) then raise exception 'Tempo de experiência inválido' using errcode='22023';end if;
  else
   if v<>'null'::jsonb and (jsonb_typeof(v)<>'string' or length(v#>>'{}')>case when k='observacoes' then 10000 else 500 end) then raise exception 'Texto inválido' using errcode='22023';end if;
   if k='email' and v<>'null'::jsonb and ((v#>>'{}')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v#>>'{}')>254) then raise exception 'E-mail inválido' using errcode='22023';end if;
   if k='telefone' and v<>'null'::jsonb and ((v#>>'{}')!~'^\+?[0-9 ().-]+$' or length(regexp_replace(v#>>'{}','[^0-9]','','g')) not between 7 and 15) then raise exception 'Telefone inválido' using errcode='22023';end if;
   if k='data_nascimento' and v<>'null'::jsonb then
    if (v#>>'{}')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Data inválida' using errcode='22023';end if;
    dt:=(v#>>'{}')::date;if dt<date '1900-01-01' or dt>current_date then raise exception 'Data inválida' using errcode='22023';end if;
   end if;
   if k='status' and (v='null'::jsonb or (v#>>'{}') not in ('novo','em_analise','aprovado','rejeitado','contratado')) then raise exception 'Status inválido' using errcode='22023';end if;
  end if;
 end loop;
end $$;

create function private.save_candidate_review(p_company uuid,p_candidate uuid,p_expected_version bigint,p_patch jsonb,p_complete boolean,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.candidates; saved public.candidates;changes jsonb:='{}'; corrections jsonb;k text;v jsonb;before_value jsonb;display_name text;
begin
 if auth.uid() is null then raise exception 'Acesso negado' using errcode='42501';end if;
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão para revisar' using errcode='42501';end if;
 select * into c from public.candidates where company_id=p_company and id=p_candidate and not excluido for update;
 if not found then raise exception 'Candidato indisponível' using errcode='42501';end if;
 if p_expected_version is distinct from c.review_version then raise exception 'REVIEW_CONFLICT' using errcode='40001';end if;
 perform private.validate_review_patch(p_patch);
 if p_complete is true and p_confirmed is distinct from true then raise exception 'Confirme a conferência do original e dos campos pendentes' using errcode='22023';end if;
 corrections:=c.correcoes_rh;
 for k,v in select * from jsonb_each(p_patch) loop
  before_value:=case when k='status' then to_jsonb(c.status) when k='observacoes' then coalesce(to_jsonb(c.observacoes),'null') else coalesce(c.dados_efetivos->k,private.review_defaults()->k) end;
  if before_value is distinct from v then
   changes:=changes||jsonb_build_object(k,jsonb_build_object('antes',before_value,'depois',v));
   if k not in ('status','observacoes') then corrections:=corrections||jsonb_build_object(k,v);end if;
  end if;
 end loop;
 if p_complete is true then
  -- Explicit confirmation freezes ALL reviewed fields, including nulls and empty lists.
  foreach k in array private.review_fields() loop corrections:=corrections||jsonb_build_object(k,coalesce(corrections->k,c.dados_efetivos->k,private.review_defaults()->k));end loop;
 elsif changes='{}' then return to_jsonb(c);end if;
 update public.candidates set correcoes_rh=corrections,
  status=case when p_patch ? 'status' then p_patch->>'status' else status end,
  observacoes=case when p_patch ? 'observacoes' then p_patch->>'observacoes' else observacoes end,
  review_version=c.review_version+1,review_status=case when p_complete is true then 'completed' else 'draft' end,
  reviewed_by=case when p_complete is true then auth.uid() else reviewed_by end,
  reviewed_at=case when p_complete is true then clock_timestamp() else reviewed_at end
 where company_id=p_company and id=p_candidate returning * into saved;
 select left(full_name,160) into display_name from public.profiles where id=auth.uid();
 insert into public.candidate_revisions(company_id,candidate_id,version,actor_id,actor_name,action,changes)
 values(p_company,p_candidate,saved.review_version,auth.uid(),display_name,case when p_complete is true then 'complete' else 'save' end,changes);
 return to_jsonb(saved);
end $$;
create function public.save_candidate_review(p_company uuid,p_candidate uuid,p_expected_version bigint,p_patch jsonb,p_complete boolean default false,p_confirmed boolean default false)
returns jsonb language sql security invoker set search_path='' as $$ select private.save_candidate_review(p_company,p_candidate,p_expected_version,p_patch,p_complete,p_confirmed) $$;
revoke update(status,observacoes,localizacao,data_nascimento) on public.candidates from authenticated;
revoke all on function private.review_fields(),private.review_defaults(),private.merge_candidate_review(),private.invalidate_candidate_assessments(),private.validate_review_patch(jsonb),private.save_candidate_review(uuid,uuid,bigint,jsonb,boolean,boolean),public.save_candidate_review(uuid,uuid,bigint,jsonb,boolean,boolean) from public,anon,authenticated;
grant execute on function private.review_defaults() to service_role;
grant execute on function private.save_candidate_review(uuid,uuid,bigint,jsonb,boolean,boolean),public.save_candidate_review(uuid,uuid,bigint,jsonb,boolean,boolean) to authenticated;

create or replace function public.save_candidate_extraction(p_actor uuid,p_company uuid,p_id uuid,p_extraction jsonb,p_status text,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.companies where id=p_company for update;
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501';end if;
 if p_status not in ('concluido','revisao_manual','erro') then raise exception 'Estado inválido';end if;
 if p_status='erro' then
  update public.candidates set processing_status='erro',processing_error=p_error where id=p_id and company_id=p_company and not excluido;
 else
  update public.candidates set dados_extraidos=p_extraction,processing_status=p_status,processing_error=null,
   review_status='pending',review_version=review_version+1
  where id=p_id and company_id=p_company and not excluido;
 end if;
 if not found then raise exception 'Candidato indisponível' using errcode='42501';end if;
end $$;

create or replace function public.replace_job_scores(p_actor uuid,p_company uuid,p_job uuid,p_scores jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.companies where id=p_company for update;
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501';end if;
 perform 1 from public.jobs where id=p_job and company_id=p_company and not excluido for update;
 if not found then raise exception 'Vaga indisponível' using errcode='42501';end if;
 perform 1 from public.candidates where company_id=p_company and id in(select (value->>'candidate_id')::uuid from jsonb_array_elements(p_scores)) order by id for share;
 if exists(select 1 from jsonb_array_elements(p_scores) s where not exists(select 1 from public.candidates c where c.id=(s->>'candidate_id')::uuid and c.company_id=p_company and not c.excluido and c.processing_status in ('concluido','revisao_manual'))) then raise exception 'Candidato incompatível' using errcode='23503';end if;
 if exists(select 1 from jsonb_array_elements(p_scores) s join public.candidates c on c.id=(s->>'candidate_id')::uuid where s ? 'candidate_version' and (s->>'candidate_version')::bigint is distinct from c.data_version) then raise exception 'Dados alterados durante a avaliação. Calcule novamente.' using errcode='40001';end if;
 delete from public.candidate_scores where company_id=p_company and job_id=p_job;
 insert into public.candidate_scores(company_id,candidate_id,job_id,score,detalhes_matching,candidate_version,stale)
 select p_company,(s->>'candidate_id')::uuid,p_job,(s->>'score')::numeric,s->'detalhes_matching',(s->>'candidate_version')::bigint,not(s ? 'candidate_version') from jsonb_array_elements(p_scores) s;
 update public.job_reports set stale=true where company_id=p_company and job_id=p_job;
end $$;
create or replace function public.settle_resume_job(p_job uuid,p_token uuid,p_outcome text,p_extraction jsonb default '{}',p_kind text default null,p_message text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.resume_jobs; saved boolean; version text;
begin
 select * into j from public.resume_jobs where id=p_job;
 if not found then return false;end if;
 perform 1 from public.companies where id=j.company_id for update;
 select * into j from public.resume_jobs where id=p_job and state='running' and lease_token=p_token and lease_until>now() for update;
 if not found then return false;end if;
 select prompt_version into version from public.resume_job_attempts where job_id=j.id and attempt=j.attempts;
 if p_outcome in ('succeeded','review') and version is not null then
  if p_extraction->>'schema_version' is distinct from '2' or jsonb_typeof(p_extraction->'evidencias') is distinct from 'array' or jsonb_typeof(p_extraction->'resumo_profissional') is distinct from 'object'
   or jsonb_typeof(p_extraction->'experiencias') is distinct from 'array' or jsonb_typeof(p_extraction->'skills') is distinct from 'array'
   or jsonb_typeof(p_extraction->'controle_qualidade') is distinct from 'object' or octet_length(p_extraction::text)>1000000 then raise exception 'Extração incompleta';end if;
  if p_outcome='succeeded' and jsonb_array_length(p_extraction->'controle_qualidade'->'motivos_revisao')>0 then raise exception 'Revisão obrigatória';end if;
 end if;
 saved:=private.settle_resume_job_trusted(p_job,p_token,p_outcome,p_extraction,p_kind,p_message);
 if saved and p_outcome in ('succeeded','review') and exists(select 1 from public.resume_jobs where id=j.id and state in ('succeeded','review')) then
  update public.resume_job_attempts set extraction=p_extraction where job_id=j.id and attempt=j.attempts;
 end if;
 return saved;
end $$;
