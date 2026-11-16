begin;
create temp table metric_ids(name text primary key,id uuid default gen_random_uuid());
insert into metric_ids(name) values('owner'),('viewer'),('company'),('other'),('batch'),('other_batch');
grant select on metric_ids to authenticated;
create function pg_temp.mid(text) returns uuid language sql as $$select id from metric_ids where name=$1$$;
create function pg_temp.metric_ok(label text,passed boolean) returns void language plpgsql as $$begin
 if passed is distinct from true then raise exception 'FAILED: %',label;end if;end$$;
create function pg_temp.metric_denied(statement text) returns void language plpgsql as $$begin
 begin execute statement;exception when insufficient_privilege then return;end;
 raise exception 'Unexpected metric access';end$$;
insert into auth.users(id,email,email_confirmed_at,role,aud) select id,id::text||'@synthetic.invalid',now(),'authenticated','authenticated' from metric_ids where name in ('owner','viewer');
insert into public.companies(id,name) values(pg_temp.mid('company'),'Synthetic metrics'),(pg_temp.mid('other'),'Other synthetic metrics');
insert into public.company_members values(pg_temp.mid('company'),pg_temp.mid('owner'),'owner',now()),(pg_temp.mid('company'),pg_temp.mid('viewer'),'viewer',now());
insert into public.resume_batches(id,company_id,uploaded_by,source,file_count) values
 (pg_temp.mid('batch'),pg_temp.mid('company'),pg_temp.mid('owner'),'email',3),
 (pg_temp.mid('other_batch'),pg_temp.mid('other'),pg_temp.mid('owner'),'email',1);
insert into public.resume_batch_entries(batch_id,slot,filename,state) values
 (pg_temp.mid('batch'),0,'private-name.pdf','rejected'),
 (pg_temp.mid('batch'),1,'private-name.docx','received'),
 (pg_temp.mid('batch'),2,'private-name.png','cancelled'),
 (pg_temp.mid('other_batch'),0,'other-private.pdf','rejected');
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.mid('owner'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.metric_ok('only own files',(public.product_quality_metrics(pg_temp.mid('company'),now()-interval '1 day')->>'selected_files')::int=3);
select pg_temp.metric_ok('failure denominator excludes cancelled',(public.product_quality_metrics(pg_temp.mid('company'),now()-interval '1 day')->>'upload_failure_rate')::numeric=0.5);
select pg_temp.metric_ok('unknown latency stays null',public.product_quality_metrics(pg_temp.mid('company'),now()-interval '1 day')->'analysis_p95_ms'='null'::jsonb);
select pg_temp.metric_ok('no filenames or user identifiers',public.product_quality_metrics(pg_temp.mid('company'),now()-interval '1 day')::text not like '%private-name%');
select pg_temp.metric_denied($s$select public.product_quality_metrics(pg_temp.mid('other'),now()-interval '1 day')$s$);
reset role;
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.mid('viewer'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.metric_denied($s$select public.product_quality_metrics(pg_temp.mid('company'),now()-interval '1 day')$s$);
reset role;
select pg_temp.metric_ok('anonymous cannot execute',not has_function_privilege('anon','public.product_quality_metrics(uuid,timestamptz)','execute'));
rollback;
