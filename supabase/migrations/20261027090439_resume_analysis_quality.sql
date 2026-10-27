alter table public.resume_job_attempts
 add column model_requested text,
 add column model_reported text,
 add column prompt_version text,
 add column prompt_hash text,
 add column prompt_snapshot text,
 add column response_id text,
 add column input_tokens bigint check(input_tokens>=0),
 add column output_tokens bigint check(output_tokens>=0),
 add column total_tokens bigint check(total_tokens>=0),
 add column duration_ms bigint check(duration_ms>=0),
 add column extraction jsonb;

create function public.record_resume_analysis(p_job uuid,p_token uuid,p_metadata jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.resume_jobs; k text;
begin
 select * into j from public.resume_jobs where id=p_job;
 if not found then return false;end if;
 perform 1 from public.companies where id=j.company_id for update;
 if not exists(select 1 from public.resume_jobs where id=p_job and state='running' and lease_token=p_token and lease_until>now()) then return false;end if;
 if jsonb_typeof(p_metadata)<>'object' or octet_length(p_metadata::text)>100000 then raise exception 'Metadados inválidos';end if;
 foreach k in array array['input_tokens','output_tokens','total_tokens'] loop
  if p_metadata->>k is not null and (jsonb_typeof(p_metadata->k)<>'number' or (p_metadata->>k)!~'^[0-9]{1,12}$') then raise exception 'Consumo inválido';end if;
 end loop;
 if exists(select 1 from public.resume_job_attempts where job_id=j.id and attempt=j.attempts and prompt_snapshot is null) and
 (coalesce(length(p_metadata->>'prompt_snapshot'),0) not between 1 and 90000 or coalesce(length(p_metadata->>'model_requested'),0) not between 1 and 200 or coalesce(length(p_metadata->>'prompt_version'),0) not between 1 and 100) then raise exception 'Identidade da análise ausente';end if;
 update public.resume_job_attempts set
  model_requested=coalesce(model_requested,left(p_metadata->>'model_requested',200)),
  prompt_version=coalesce(prompt_version,left(p_metadata->>'prompt_version',100)),
  prompt_snapshot=coalesce(prompt_snapshot,p_metadata->>'prompt_snapshot'),
  prompt_hash=coalesce(prompt_hash,encode(extensions.digest(p_metadata->>'prompt_snapshot','sha256'),'hex')),
  model_reported=coalesce(left(p_metadata->>'model_reported',200),model_reported),
  response_id=coalesce(left(p_metadata->>'response_id',200),response_id),
  input_tokens=coalesce((p_metadata->>'input_tokens')::bigint,input_tokens),
  output_tokens=coalesce((p_metadata->>'output_tokens')::bigint,output_tokens),
  total_tokens=coalesce((p_metadata->>'total_tokens')::bigint,total_tokens)
 where job_id=j.id and attempt=j.attempts;
 return found;
end $$;
revoke all on function public.record_resume_analysis(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_resume_analysis(uuid,uuid,jsonb) to service_role;

create function private.time_resume_attempt() returns trigger language plpgsql set search_path='' as $$
begin
 if new.finished_at is not null then new.duration_ms:=greatest(0,floor(extract(epoch from (clock_timestamp()-new.started_at))*1000))::bigint;end if;
 return new;
end $$;
revoke all on function private.time_resume_attempt() from public,anon,authenticated,service_role;
create trigger time_resume_attempt before update of finished_at on public.resume_job_attempts for each row execute function private.time_resume_attempt();

alter function public.settle_resume_job(uuid,uuid,text,jsonb,text,text) rename to settle_resume_job_base;
revoke execute on function public.settle_resume_job_base(uuid,uuid,text,jsonb,text,text) from service_role;
create function public.settle_resume_job(p_job uuid,p_token uuid,p_outcome text,p_extraction jsonb default '{}',p_kind text default null,p_message text default null)
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
  if p_extraction->>'schema_version'='2' then update public.candidates set nome=p_extraction->>'nome_completo' where id=j.candidate_id and company_id=j.company_id;end if;
 end if;
 return saved;
end $$;
-- Keep the old implementation private. The public wrapper performs validation.
alter function public.settle_resume_job_base(uuid,uuid,text,jsonb,text,text) set schema private;
alter function private.settle_resume_job_base(uuid,uuid,text,jsonb,text,text) rename to settle_resume_job_trusted;
grant execute on function private.settle_resume_job_trusted(uuid,uuid,text,jsonb,text,text) to service_role;
revoke all on function public.settle_resume_job(uuid,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.settle_resume_job(uuid,uuid,text,jsonb,text,text) to service_role;
