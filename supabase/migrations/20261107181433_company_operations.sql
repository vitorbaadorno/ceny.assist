-- Operational records contain only meter values, opaque IDs and controlled categories.
-- Keep them independent of resume/report payloads that may subsequently be erased.
create table private.ops_policy (
 company_id uuid primary key references public.companies on delete cascade,
 upload_limit integer check(upload_limit between 0 and 10000000),
 analysis_limit integer check(analysis_limit between 0 and 10000000),
 warn_percent integer not null default 80 check(warn_percent between 1 and 100),
 activity_days integer not null default 90 check(activity_days between 1 and 730),
 error_days integer not null default 30 check(error_days between 1 and 365),
 version bigint not null default 0
);
create table private.ops_events (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies on delete cascade,
 at timestamptz not null default clock_timestamp(), actor_id uuid, kind text not null check(kind in ('activity','error')),
 action text not null, operation_id uuid not null, source text not null, code text
);
create index ops_events_page on private.ops_events(company_id,kind,at desc,id);
create index ops_events_client_rate on private.ops_events(company_id,actor_id,at) where source='client';
create table private.ops_documents (
 id uuid primary key, company_id uuid not null references public.companies on delete cascade,
 admitted_at timestamptz not null, bytes bigint not null check(bytes>=0), stored_at timestamptz, removed_at timestamptz, erasure_id uuid
);
create index ops_docs_period on private.ops_documents(company_id,admitted_at);
create table private.ops_analyses (
 company_id uuid not null references public.companies on delete cascade, document_id uuid not null, generation integer not null,
 admitted_at timestamptz not null, job_id uuid unique, queued_at timestamptz, state text not null,
 primary key(company_id,document_id,generation)
);
create index ops_analyses_period on private.ops_analyses(company_id,admitted_at);
create table private.ops_attempts (
 job_id uuid not null, attempt integer not null, company_id uuid not null references public.companies on delete cascade,
 started_at timestamptz not null, finished_at timestamptz, outcome text not null, duration_ms bigint,
 input_tokens bigint, output_tokens bigint, total_tokens bigint, ai_usd numeric(20,8) check(ai_usd>=0),
 primary key(job_id,attempt)
);
create index ops_attempts_period on private.ops_attempts(company_id,started_at);
create table private.ops_storage_bills (
 company_id uuid not null references public.companies on delete cascade, month date not null, usd numeric(20,8) not null check(usd>=0),
 primary key(company_id,month)
);
create table private.ops_rejections (
 company_id uuid not null references public.companies on delete cascade,batch_id uuid not null,slot int not null,
 at timestamptz not null,primary key(batch_id,slot)
);
create index ops_rejections_period on private.ops_rejections(company_id,at);
do $$declare t text;begin
 foreach t in array array['ops_policy','ops_events','ops_documents','ops_analyses','ops_attempts','ops_storage_bills','ops_rejections'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public, anon, authenticated, service_role',t);
 end loop;
end$$;

-- Backfill measured facts only. Historical invoices and unknown token receipts stay NULL.
insert into private.ops_policy(company_id) select id from public.companies;
insert into private.ops_documents select id,company_id,created_at,byte_size,stored_at,null from public.resume_documents;
insert into private.ops_analyses select company_id,document_id,generation,created_at,id,created_at,state from public.resume_jobs;
insert into private.ops_attempts select j.id,a.attempt,j.company_id,a.started_at,a.finished_at,a.outcome,
 coalesce(a.duration_ms,(extract(epoch from (a.finished_at-a.started_at))*1000)::bigint),a.input_tokens,a.output_tokens,a.total_tokens,null
 from public.resume_job_attempts a join public.resume_jobs j on j.id=a.job_id;
insert into private.ops_rejections select b.company_id,b.id,e.slot,e.updated_at from public.resume_batch_entries e join public.resume_batches b on b.id=e.batch_id where e.state='rejected';

create function private.ops_event(c uuid,actor uuid,kind text,action text,op uuid,source text,code text default null)
returns void language sql security definer set search_path='' as $$
 insert into private.ops_events(company_id,actor_id,kind,action,operation_id,source,code) values(c,actor,kind,action,coalesce(op,gen_random_uuid()),source,code)
$$;
create function private.ops_lock(c uuid) returns private.ops_policy language plpgsql security definer set search_path='' as $$
declare p private.ops_policy;
begin
 insert into private.ops_policy(company_id) values(c) on conflict do nothing;
 select * into strict p from private.ops_policy where company_id=c for update;
 return p;
end$$;
create function private.ops_check_capacity(c uuid,upload boolean,analysis boolean) returns void language plpgsql security definer set search_path='' as $$
declare p private.ops_policy; m timestamptz:=date_trunc('month',now(),'UTC'); e timestamptz:=((date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC');
begin
 p:=private.ops_lock(c);
 if upload and p.upload_limit is not null and (select count(*) from private.ops_documents where company_id=c and admitted_at>=m and admitted_at<e)>=p.upload_limit then
 raise exception 'Limite mensal de envios atingido.' using errcode='P5401';end if;
 if analysis and p.analysis_limit is not null and (select count(*) from private.ops_analyses where company_id=c and admitted_at>=m and admitted_at<e)>=p.analysis_limit then
 raise exception 'Limite mensal de análises atingido.' using errcode='P5402';end if;
end$$;

-- Reserve the original AND its first analysis together, before bytes reach Storage.
create function private.ops_meter_document() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
 perform private.ops_check_capacity(new.company_id,true,true);
 insert into private.ops_documents values(new.id,new.company_id,now(),new.byte_size,new.stored_at,null);
 insert into private.ops_analyses values(new.company_id,new.id,1,now(),null,null,'reserved');
 elsif tg_op='UPDATE' then
 update private.ops_documents set stored_at=coalesce(stored_at,new.stored_at) where id=new.id;
 elsif old.stored_at is null and not exists(select 1 from private.ops_analyses where document_id=old.id and company_id=old.company_id and job_id is not null) then
 perform private.ops_lock(old.company_id);
 delete from private.ops_analyses where document_id=old.id and company_id=old.company_id and job_id is null;
 delete from private.ops_documents where id=old.id;
 else
 update private.ops_documents set erasure_id=(select id from public.privacy_erasure_operations
 where company_id=old.company_id and state='queued' and old.candidate_id=any(candidate_ids) order by created_at limit 1) where id=old.id;
 update private.ops_documents set removed_at=clock_timestamp() where id=old.id and erasure_id is null;
 delete from private.ops_analyses where document_id=old.id and company_id=old.company_id and job_id is null;
 end if;
 return null;
end$$;
create trigger ops_document_admission after insert or update of stored_at or delete on public.resume_documents for each row execute function private.ops_meter_document();

create index ops_docs_erasure on private.ops_documents(erasure_id) where erasure_id is not null;
create function private.ops_storage_removed() returns trigger language plpgsql security definer set search_path='' as $$
begin update private.ops_documents set removed_at=new.completed_at,erasure_id=null where erasure_id=new.id;return null;end$$;
create trigger ops_storage_removed after update of state on public.privacy_erasure_operations for each row
when(new.state='completed' and old.state<>'completed') execute function private.ops_storage_removed();

create function private.ops_meter_analysis() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
 perform private.ops_lock(new.company_id);
 update private.ops_analyses set job_id=new.id,queued_at=new.created_at,state=new.state
 where company_id=new.company_id and document_id=new.document_id and generation=new.generation and job_id is null;
 if not found then
 perform private.ops_check_capacity(new.company_id,false,true);
 insert into private.ops_analyses values(new.company_id,new.document_id,new.generation,now(),new.id,new.created_at,new.state);
 end if;
 perform private.ops_event(new.company_id,new.requested_by,'activity','analysis_requested',new.id,'database');
 else
 update private.ops_analyses set state=new.state where job_id=new.id;
 end if;
 return null;
end$$;
create trigger ops_job_meter after insert or update of state on public.resume_jobs for each row execute function private.ops_meter_analysis();

create function private.ops_meter_attempt() returns trigger language plpgsql security definer set search_path='' as $$
declare j public.resume_jobs;
begin
 select * into strict j from public.resume_jobs where id=new.job_id;
 insert into private.ops_attempts(job_id,attempt,company_id,started_at,finished_at,outcome,duration_ms,input_tokens,output_tokens,total_tokens)
 values(j.id,new.attempt,j.company_id,new.started_at,new.finished_at,new.outcome,coalesce(new.duration_ms,(extract(epoch from(new.finished_at-new.started_at))*1000)::bigint),new.input_tokens,new.output_tokens,new.total_tokens)
 on conflict(job_id,attempt) do update set finished_at=excluded.finished_at,outcome=excluded.outcome,duration_ms=excluded.duration_ms,input_tokens=excluded.input_tokens,output_tokens=excluded.output_tokens,total_tokens=excluded.total_tokens;
 if new.finished_at is not null and (tg_op='INSERT' or old.finished_at is null) and new.outcome not in ('succeeded','review') then
 perform private.ops_event(j.company_id,j.requested_by,'error','analysis_attempt_'||new.attempt,j.id,'queue',case when new.error_kind in ('transient','permanent','configuration','authorization','interrupted') then new.error_kind else 'processing' end);
 end if;
 return null;
end$$;
create trigger ops_attempt_meter after insert or update on public.resume_job_attempts for each row execute function private.ops_meter_attempt();
create function private.ops_meter_rejection() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.resume_batches;
begin
 select * into strict b from public.resume_batches where id=new.batch_id;
 insert into private.ops_rejections values(b.company_id,b.id,new.slot,new.updated_at) on conflict do nothing;
 if found then perform private.ops_event(b.company_id,b.uploaded_by,'error','upload_slot_'||new.slot,b.id,'intake','rejected');end if;
 return null;
end$$;
create trigger ops_rejection after insert or update of state on public.resume_batch_entries for each row when(new.state='rejected') execute function private.ops_meter_rejection();

-- Project only the operation, actor and opaque reference. Never copy the revision payload.
create function private.ops_audit_row() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; a text:=tg_argv[0]; actor uuid; op uuid; c uuid;
begin
 if tg_op='DELETE' then r:=to_jsonb(old);else r:=to_jsonb(new);end if;
 c:=(r->>'company_id')::uuid;
 if not exists(select 1 from public.companies where id=c) then return null;end if;
 actor:=coalesce(auth.uid(),(r->>tg_argv[1])::uuid);
 op:=(r->>tg_argv[2])::uuid;
 if tg_table_name='company_members' then a:='member_'||lower(tg_op);
 elsif tg_table_name='company_invitations' then a:='invitation_'||lower(tg_op);
 elsif tg_table_name='privacy_events' then a:=case r->>'action'
 when 'erasure_requested' then 'erase_requested' when 'database_purged' then 'database_erased' when 'erasure_completed' then 'erase_completed'
 when 'subject_export_requested' then 'subject_export' when 'hold_created' then 'hold_created' when 'hold_released' then 'hold_released' else 'privacy_change' end;
 elsif tg_table_name='vacancy_report_events' then a:='report_'||(r->>'action');
 elsif tg_table_name='job_revisions' then a:=case r->>'action' when 'create' then 'job_created' when 'archive' then 'job_archived' else 'job_changed' end;
 elsif tg_table_name='candidate_revisions' then a:=case r->>'action' when 'complete' then 'review_completed' else 'candidate_review' end;
 end if;
 perform private.ops_event(c,actor,'activity',a,op,'database');
 return null;
end$$;
create trigger ops_member_audit after insert or update of role or delete on public.company_members for each row execute function private.ops_audit_row('member','','user_id');
create trigger ops_invite_audit after insert or update on public.company_invitations for each row execute function private.ops_audit_row('invitation','invited_by','id');
create trigger ops_candidate_created after insert on public.candidates for each row execute function private.ops_audit_row('candidate_created','created_by','id');
create trigger ops_candidate_archived after update of excluido on public.candidates for each row when(new.excluido and not old.excluido) execute function private.ops_audit_row('candidate_archived','','id');
create trigger ops_note_audit after insert on public.candidate_notes for each row execute function private.ops_audit_row('note_added','actor_id','id');
create trigger ops_review_audit after insert on public.candidate_revisions for each row execute function private.ops_audit_row('candidate_review','actor_id','id');
create trigger ops_job_audit after insert on public.job_revisions for each row execute function private.ops_audit_row('job_changed','actor_id','id');
create trigger ops_decision_audit after insert on public.candidate_decision_events for each row execute function private.ops_audit_row('decision_saved','actor_id','id');
create trigger ops_link_audit after insert on public.candidate_link_events for each row execute function private.ops_audit_row('link_changed','actor_id','id');
create trigger ops_document_audit after insert on public.candidate_document_events for each row execute function private.ops_audit_row('document_changed','actor_id','id');
create trigger ops_case_audit after insert on public.apprentice_case_reviews for each row execute function private.ops_audit_row('case_review','actor_id','id');
create trigger ops_ranking_audit after update of status on public.ranking_runs for each row when(new.status='completed' and old.status is distinct from new.status) execute function private.ops_audit_row('ranking_published','actor_id','id');
create trigger ops_report_audit after insert on public.vacancy_report_events for each row execute function private.ops_audit_row('report','actor_id','report_id');
create trigger ops_privacy_audit after insert on public.privacy_events for each row execute function private.ops_audit_row('privacy','actor_id','subject_id');

create function private.ops_admin(c uuid) returns void language plpgsql stable security invoker set search_path='' as $$
begin if auth.uid() is null or not private.has_role(c,array['owner','admin']) then raise exception 'Sem permissão.' using errcode='42501';end if;end$$;
create function private.ops_configure(p_company uuid,p_version bigint,p_upload integer,p_analysis integer,p_warn integer,p_activity_days integer,p_error_days integer)
returns bigint language plpgsql security definer set search_path='' as $$
declare v bigint;
begin
 perform private.ops_admin(p_company);perform private.ops_lock(p_company);
 update private.ops_policy set upload_limit=p_upload,analysis_limit=p_analysis,warn_percent=p_warn,activity_days=p_activity_days,error_days=p_error_days,version=version+1
 where company_id=p_company and version=p_version returning version into v;
 if not found then raise exception 'Configuração alterada por outra pessoa.' using errcode='40001';end if;
 perform private.ops_event(p_company,auth.uid(),'activity','settings_changed',null,'database');return v;
end$$;
create function private.ops_prune() returns void language sql security definer set search_path='' as $$
 delete from private.ops_events e using private.ops_policy p where e.company_id=p.company_id and
 e.at<now()-make_interval(days=>case when e.kind='error' then p.error_days else p.activity_days end)
$$;
select cron.schedule('ceny-operations-retention','19 3 * * *','select private.ops_prune()');

-- Client diagnostics are explicitly distinguished from authoritative business events.
create function private.ops_report_error(p_company uuid,p_operation uuid,p_action text,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.has_role(p_company,array['owner','admin','recruiter','viewer']) then raise exception 'Sem permissão.' using errcode='42501';end if;
 if p_operation is null or p_action is null or p_action not in ('query','save','upload','review','reprocess','rank','export','erase','access','settings')
 or p_code is null or p_code not in ('connection','session','permission','missing','conflict','limit','invalid','service','unknown') then raise exception 'Categoria inválida.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company::text||auth.uid()::text,45));
 if (select count(*) from private.ops_events where company_id=p_company and actor_id=auth.uid() and source='client' and at>now()-interval '1 hour')>=120 then return;end if;
 if not exists(select 1 from private.ops_events where company_id=p_company and actor_id=auth.uid() and operation_id=p_operation and source='client' and at>now()-interval '1 hour') then
 perform private.ops_event(p_company,auth.uid(),'error',p_action,p_operation,'client',p_code);end if;
end$$;

create function private.ops_history(p_company uuid,p_kind text,p_page integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin perform private.ops_admin(p_company);
 if p_kind is null or p_kind not in ('activity','error') or p_page is null or p_page not between 0 and 100000 then raise exception 'Página inválida.';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.at desc,q.id),'[]'::jsonb) into result from
 (select e.id,e.at,e.actor_id,p.full_name actor_name,e.action,e.operation_id,e.source,e.code from private.ops_events e left join public.profiles p on p.id=e.actor_id
 where e.company_id=p_company and e.kind=p_kind order by e.at desc,e.id limit 26 offset 25*p_page) q;
 return result;
end$$;

-- Reconcile exact USD amounts from the company's invoice. Unknown is NULL; a confirmed zero is valid.
create function private.ops_reconcile(p_company uuid,p_month date,p_job uuid,p_attempt integer,p_usd numeric)
returns void language plpgsql security definer set search_path='' as $$
begin perform private.ops_admin(p_company);
 if p_usd is null or p_usd::text in ('NaN','Infinity','-Infinity') or p_usd<0 or p_usd>1000000000 or p_usd<>round(p_usd,8)
 or p_month is null or extract(day from p_month)<>1 or p_month>date_trunc('month',now() at time zone 'UTC')::date then raise exception 'Valor ou competência inválidos.' using errcode='22023';end if;
 if p_job is null and p_attempt is null then
 if p_month>=date_trunc('month',now() at time zone 'UTC')::date then raise exception 'Aguarde o fechamento do mês de armazenamento.' using errcode='22023';end if;
 insert into private.ops_storage_bills values(p_company,p_month,p_usd) on conflict(company_id,month) do update set usd=excluded.usd;
 perform private.ops_event(p_company,auth.uid(),'activity','storage_reconciled',null,'database');
 else
 update private.ops_attempts set ai_usd=p_usd where company_id=p_company and job_id=p_job and attempt=p_attempt and finished_at is not null
 and date_trunc('month',started_at at time zone 'UTC')::date=p_month;
 if not found then raise exception 'Tentativa indisponível nesta competência.' using errcode='22023';end if;
 perform private.ops_event(p_company,auth.uid(),'activity','attempt_reconciled',p_job,'database');end if;
end$$;

create function private.ops_dashboard(p_company uuid,p_month date,p_page integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_at timestamptz:=p_month::timestamp at time zone 'UTC'; end_at timestamptz:=(p_month+interval '1 month') at time zone 'UTC';
 p private.ops_policy; result jsonb; bill numeric; closed boolean:=end_at<=now();
begin perform private.ops_admin(p_company);
 if p_month is null or extract(day from p_month)<>1 or start_at>now() or p_page is null or p_page not between 0 and 100000 then raise exception 'Competência ou página inválida.' using errcode='22023';end if;
 select * into p from private.ops_policy where company_id=p_company;
 select usd into bill from private.ops_storage_bills where company_id=p_company and month=p_month;
 with docs as materialized (
 select d.id,d.bytes * greatest(0,extract(epoch from least(coalesce(d.removed_at,now()),end_at,now())-greatest(d.stored_at,start_at))) weight
 from private.ops_documents d where d.company_id=p_company and d.stored_at<end_at and (d.removed_at is null or d.removed_at>start_at)
 ), weights as (select sum(weight) total from docs), attempts as materialized (
 select * from private.ops_attempts where company_id=p_company and started_at>=start_at and started_at<end_at
 ), grouped as (select job_id,count(*) n,count(ai_usd) confirmed,sum(ai_usd) ai,
 jsonb_agg(jsonb_build_object('attempt',attempt,'usd',ai_usd,'finished',finished_at is not null,'tokens',total_tokens,'duration_ms',duration_ms) order by attempt) items from attempts group by job_id),
 eligible as (select a.*,d.weight,count(*) over(partition by a.document_id) shares from private.ops_analyses a left join docs d on d.id=a.document_id
 where a.company_id=p_company and a.job_id is not null and a.queued_at<end_at),
 costs as (select a.job_id,a.generation,a.state,a.queued_at,coalesce(g.n,0) attempts,coalesce(g.items,'[]') items,
 case when g.n is null then 0 when g.n=g.confirmed then g.ai end ai_usd,
 case when coalesce(a.weight,0)=0 then 0 when closed and bill is not null then bill*a.weight/nullif(w.total,0)/a.shares end storage_usd
 from eligible a cross join weights w left join grouped g on g.job_id=a.job_id
 where a.weight>0 or a.queued_at>=start_at or g.n is not null),
 page as (select *,case when closed then ai_usd+storage_usd end total_usd from costs order by queued_at desc,job_id limit 21 offset p_page*20)
 select jsonb_build_object('policy',jsonb_build_object('version',coalesce(p.version,0),'upload',p.upload_limit,'analysis',p.analysis_limit,'warn',coalesce(p.warn_percent,80),'activity_days',coalesce(p.activity_days,90),'error_days',coalesce(p.error_days,30)),
 'closed',closed,'storage_bill',bill,
 'storage_unallocated_usd',case when bill is not null then bill-coalesce((select sum(storage_usd) from costs),0) end,
 'admissions',(select count(*) from private.ops_documents where company_id=p_company and admitted_at>=start_at and admitted_at<end_at),
 'received',(select count(*) from private.ops_documents where company_id=p_company and stored_at>=start_at and stored_at<end_at),
 'rejected',(select count(*) from private.ops_rejections where company_id=p_company and at>=start_at and at<end_at),
 'analyses',(select count(*) from private.ops_analyses where company_id=p_company and admitted_at>=start_at and admitted_at<end_at),
 'completed',(select count(distinct a.document_id) from private.ops_analyses a join attempts t using(job_id) where a.company_id=p_company and t.outcome='succeeded'),
 'review',(select count(distinct a.document_id) from private.ops_analyses a join attempts t using(job_id) where a.company_id=p_company and t.outcome='review'),
 'attempts',(select count(*) from attempts),'failures',(select count(*) from attempts where finished_at is not null and outcome not in ('succeeded','review')),
 'duration_ms',(select avg(duration_ms) from attempts),'input_tokens',(select sum(input_tokens) from attempts),'output_tokens',(select sum(output_tokens) from attempts),
 'unknown_tokens',(select count(*) from attempts where total_tokens is null),'byte_hours',(select coalesce(total,0)/3600 from weights),
 'rows',(select coalesce(jsonb_agg(to_jsonb(page) order by queued_at desc,job_id),'[]') from page)) into result;
 return result;
end$$;
create function private.ops_quota_status(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m timestamptz:=date_trunc('month',now(),'UTC'); r jsonb;
begin
 if auth.uid() is null or not private.has_role(p_company,array['owner','admin','recruiter','viewer']) then raise exception 'Sem permissão.' using errcode='42501';end if;
 select jsonb_build_object('upload',p.upload_limit,'analysis',p.analysis_limit,'warn',p.warn_percent,
 'uploads_used',(select count(*) from private.ops_documents where company_id=p_company and admitted_at>=m),
 'analyses_used',(select count(*) from private.ops_analyses where company_id=p_company and admitted_at>=m))
 into r from private.ops_policy p where p.company_id=p_company;
 return r;
end$$;
-- Batch controls can create several generations. Persist a receipt in the same transaction.
create table private.ops_queue_requests(
 company_id uuid not null references public.companies on delete cascade,request_id uuid not null,
 job_id uuid references public.resume_jobs on delete cascade,batch_id uuid references public.resume_batches on delete cascade,
 action text not null,result jsonb not null,primary key(company_id,request_id),
 check(num_nonnulls(job_id,batch_id)=1));
create index ops_queue_requests_job on private.ops_queue_requests(job_id) where job_id is not null;
create index ops_queue_requests_batch on private.ops_queue_requests(batch_id) where batch_id is not null;
alter table private.ops_queue_requests enable row level security;
revoke all on private.ops_queue_requests from public,anon,authenticated,service_role;
create function private.ops_control_queue(p_company uuid,p_request uuid,p_job uuid,p_batch uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prev private.ops_queue_requests; result jsonb;
begin
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão.' using errcode='42501';end if;
 if num_nonnulls(p_job,p_batch)<>1 or p_request is null or p_action is null or p_action not in('cancel','retry') then raise exception 'Solicitação inválida.' using errcode='22023';end if;
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão.' using errcode='42501';end if;
 select * into prev from private.ops_queue_requests where company_id=p_company and request_id=p_request;
 if found then
   if prev.job_id is distinct from p_job or prev.batch_id is distinct from p_batch or prev.action<>p_action then raise exception 'Solicitação já utilizada.' using errcode='22023';end if;
   return prev.result;
 end if;
 if p_batch is null then result:=to_jsonb(private.control_resume_job(p_company,p_job,p_action));
 else result:=to_jsonb(private.control_resume_batch(p_company,p_batch,p_action));end if;
 insert into private.ops_queue_requests values(p_company,p_request,p_job,p_batch,p_action,result);
 perform private.ops_event(p_company,auth.uid(),'activity','queue_'||p_action,p_request,'database');
 return result;
end$$;
-- Expose only typed invoker stubs; privileged routines and the underlying ledger stay private.
do $$declare f record;begin
 for f in select p.proname,pg_get_function_arguments(p.oid) args,pg_get_function_identity_arguments(p.oid) identity_args,pg_get_function_result(p.oid) result,p.pronargs
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'ops\_%' escape '\' loop
 execute format('revoke all on function private.%I(%s) from public,anon,authenticated,service_role',f.proname,f.identity_args);
 if f.proname in ('ops_dashboard','ops_history','ops_configure','ops_reconcile','ops_report_error','ops_quota_status','ops_control_queue') then
 execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as %L',f.proname,f.args,f.result,
 format('select private.%I(%s)',f.proname,(select string_agg('$'||i,',' order by i) from generate_series(1,f.pronargs) i)));
 execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',f.proname,f.identity_args);
 execute format('grant execute on function public.%I(%s), private.%I(%s) to authenticated',f.proname,f.identity_args,f.proname,f.identity_args);
 end if;
 end loop;
end$$;


-- Remember request IDs even if the request joined an already-running generation.
create table private.ops_reprocess_requests(company_id uuid not null, request_id uuid not null,
 job_id uuid not null references public.resume_jobs(id) on delete cascade,primary key(company_id,request_id));
create index ops_reprocess_by_job on private.ops_reprocess_requests(job_id);
alter table private.ops_reprocess_requests enable row level security;
revoke all on private.ops_reprocess_requests from public,anon,authenticated,service_role;
create or replace function private.request_document_analysis(p_company uuid,p_document uuid,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;
begin
 perform 1 from public.companies where id=p_company for update;
 if p_request is null or not private.has_role(p_company,array['owner','admin','recruiter']) or not exists(select 1 from public.resume_documents d join public.candidates c on c.id=d.candidate_id and c.company_id=d.company_id where d.company_id=p_company and d.id=p_document and not c.excluido) then raise exception 'Sem permissão.' using errcode='42501';end if;
 if exists(select 1 from public.resume_jobs where company_id=p_company and request_id=p_request and document_id<>p_document) then raise exception 'Solicitação usada para outro documento.' using errcode='22023';end if;
 select job_id into existing from private.ops_reprocess_requests where company_id=p_company and request_id=p_request;
 if found then
 if not exists(select 1 from public.resume_jobs where id=existing and document_id=p_document and company_id=p_company) then raise exception 'Solicitação usada para outro documento.' using errcode='22023';end if;return existing;
 end if;
 existing:=private.enqueue_document(auth.uid(),p_company,p_document,'reprocess',p_request);
 insert into private.ops_reprocess_requests values(p_company,p_request,existing);return existing;
end$$;
create function private.ops_new_company() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into private.ops_policy(company_id) values(new.id) on conflict do nothing;return null;end$$;
revoke all on function private.ops_new_company() from public,anon,authenticated,service_role;
create trigger ops_new_company after insert on public.companies for each row execute function private.ops_new_company();

