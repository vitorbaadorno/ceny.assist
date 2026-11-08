begin;
set local storage.allow_delete_query=true;
create temp table ids(name text primary key,id uuid default gen_random_uuid());
insert into ids(name) values('owner'),('viewer'),('other'),('company'),('elsewhere'),('batch'),('batch2');
grant select on ids to authenticated,service_role;
create function pg_temp.id(text) returns uuid language sql as $$select id from ids where name=$1$$;
create temp table results(name text,passed boolean);
grant insert,select on results to authenticated,service_role;
create function pg_temp.ok(name text,passed boolean) returns void language plpgsql as $$begin
 if passed is distinct from true then raise exception 'FAILED: %',name;end if;insert into results values(name,true);end$$;
create function pg_temp.denied(name text,statement text) returns void language plpgsql as $$begin
 begin execute statement;exception when others then insert into results values(name,true);return;end;
 raise exception 'FAILED unexpectedly allowed: %',name;end$$;
insert into auth.users(id,email,email_confirmed_at,role,aud) select id,id::text||'@resume-test.invalid',now(),'authenticated','authenticated' from ids where name in ('owner','viewer','other');
insert into public.companies(id,name) values(pg_temp.id('company'),'Resume Test'),(pg_temp.id('elsewhere'),'Other company');
insert into public.company_members values(pg_temp.id('company'),pg_temp.id('owner'),'owner',now()),(pg_temp.id('company'),pg_temp.id('viewer'),'viewer',now()),(pg_temp.id('elsewhere'),pg_temp.id('other'),'owner',now());
insert into public.resume_batches(id,company_id,uploaded_by,source,file_count) values
 (pg_temp.id('batch'),pg_temp.id('company'),pg_temp.id('owner'),'email',5),
 (pg_temp.id('batch2'),pg_temp.id('company'),pg_temp.id('owner'),'email',5);
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('owner'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok('owner configures limits',public.ops_configure(pg_temp.id('company'),0,1,1,80,90,30)=1);
select pg_temp.denied('stale settings cannot overwrite newer version',$s$select public.ops_configure(pg_temp.id('company'),0,10,10,80,90,30)$s$);
select pg_temp.denied('foreign history denied',$s$select public.ops_history(pg_temp.id('elsewhere'),'activity',0)$s$);
select public.ops_report_error(pg_temp.id('company'),pg_temp.id('batch'),'upload','connection');
select public.ops_report_error(pg_temp.id('company'),pg_temp.id('batch'),'upload','connection');
select pg_temp.ok('same operation error recorded once',jsonb_array_length(public.ops_history(pg_temp.id('company'),'error',0))=1);
select pg_temp.denied('free text excluded from diagnostics',$s$select public.ops_report_error(pg_temp.id('company'),gen_random_uuid(),'upload','secret body')$s$);
reset role;
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('viewer'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok('viewer can receive warnings',(public.ops_quota_status(pg_temp.id('company'))->>'upload')::integer=1);
select pg_temp.denied('viewer cannot consult audit',$s$select public.ops_history(pg_temp.id('company'),'activity',0)$s$);
select pg_temp.denied('viewer cannot consult financial data',$s$select public.ops_dashboard(pg_temp.id('company'),date_trunc('month',now())::date,0)$s$);
reset role;
-- Two attempts for one historical analysis. The company invoice includes two equal-size
-- documents for this month, and only one of those documents has an associated analysis.
insert into private.ops_documents(id,company_id,admitted_at,bytes,stored_at) select pg_temp.id(n),pg_temp.id('company'),'2020-01-01',1024,'2020-01-01' from unnest(array['batch','batch2']) n;
insert into private.ops_analyses values(pg_temp.id('company'),pg_temp.id('batch'),1,'2020-01-01',pg_temp.id('batch'),'2020-01-01','succeeded');
insert into private.ops_attempts(job_id,attempt,company_id,started_at,finished_at,outcome,duration_ms,total_tokens) select pg_temp.id('batch'),i,pg_temp.id('company'),'2020-01-02','2020-01-02',case when i=1 then 'error' else 'succeeded' end,500,10 from generate_series(1,2) i;
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('owner'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok('unreconciled cost remains unknown',public.ops_dashboard(pg_temp.id('company'),'2020-01-01',0)#>'{rows,0,total_usd}'='null'::jsonb);
select public.ops_reconcile(pg_temp.id('company'),'2020-01-01',null,null,8);
select public.ops_reconcile(pg_temp.id('company'),'2020-01-01',pg_temp.id('batch'),1,1.25);
select public.ops_reconcile(pg_temp.id('company'),'2020-01-01',pg_temp.id('batch'),2,2.75);
select pg_temp.ok('cost includes both attempts and attributable storage',(public.ops_dashboard(pg_temp.id('company'),'2020-01-01',0)#>>'{rows,0,total_usd}')::numeric=8);
select pg_temp.ok('unallocated storage remains visible',(public.ops_dashboard(pg_temp.id('company'),'2020-01-01',0)->>'storage_unallocated_usd')::numeric=4);
reset role;
update private.ops_events set at=now()-interval '40 days' where company_id=pg_temp.id('company');
select private.ops_prune();
select pg_temp.ok('expired errors purged',not exists(select 1 from private.ops_events where company_id=pg_temp.id('company') and kind='error'));
select pg_temp.ok('activities still retained',exists(select 1 from private.ops_events where company_id=pg_temp.id('company') and kind='activity'));
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('owner'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok('ten tenant requests admitted',bool_and(public.admit_ai_request(pg_temp.id('company')))) from generate_series(1,10);
select pg_temp.ok('eleventh request limited',not public.admit_ai_request(pg_temp.id('company')));
select pg_temp.denied('foreign tenant rate window denied',$s$select public.admit_ai_request(pg_temp.id('elsewhere'))$s$);
reset role;
table results;
rollback;
