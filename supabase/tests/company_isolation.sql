-- Run as postgres in the authorized target database. All fixtures are rolled back.
begin;
-- Mirror the Storage API transaction flag; fixtures only, always rolled back.
set local storage.allow_delete_query = true;
create temp table test_ids(name text primary key,id uuid default gen_random_uuid());
insert into test_ids(name) values ('owner_a'),('owner_b'),('recruiter'),('viewer'),('outsider'),('multi'),('a'),('b'),('ca'),('cb'),('ja'),('jb');
grant select on test_ids to authenticated,anon,service_role;
create function pg_temp.id(text) returns uuid language sql as $$ select id from test_ids where name=$1 $$;
create temp table test_results(name text, passed boolean);
grant insert,select on test_results to authenticated,anon,service_role;
create function pg_temp.ok(p_name text,p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAILED: %',p_name; end if;
  insert into test_results values(p_name,true);
end $$;
create function pg_temp.denied(p_name text,p_sql text,p_state text default '42501') returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate=p_state then insert into test_results values(p_name,true); return; end if;
    raise;
  end;
  raise exception 'FAILED, unexpectedly allowed: %',p_name;
end $$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,aud,role)
  select id,id::text || '@isolation-test.invalid',now(),'{"full_name":"Security fixture"}','authenticated','authenticated'
  from test_ids where name in ('owner_a','owner_b','recruiter','viewer','outsider','multi');
insert into public.companies(id,name) values(pg_temp.id('a'),'Test A'),(pg_temp.id('b'),'Test B');
insert into public.company_members(company_id,user_id,role) values
  (pg_temp.id('a'),pg_temp.id('owner_a'),'owner'),(pg_temp.id('b'),pg_temp.id('owner_b'),'owner'),
  (pg_temp.id('a'),pg_temp.id('recruiter'),'recruiter'),(pg_temp.id('a'),pg_temp.id('viewer'),'viewer'),
  (pg_temp.id('a'),pg_temp.id('multi'),'recruiter'),(pg_temp.id('b'),pg_temp.id('multi'),'recruiter');
insert into public.candidates(id,company_id,nome,processing_status,created_by) values
  (pg_temp.id('ca'),pg_temp.id('a'),'Candidate A','concluido',pg_temp.id('owner_a')),
  (pg_temp.id('cb'),pg_temp.id('b'),'Candidate B','concluido',pg_temp.id('owner_b'));
insert into public.jobs(id,company_id,titulo) values(pg_temp.id('ja'),pg_temp.id('a'),'Job A'),(pg_temp.id('jb'),pg_temp.id('b'),'Job B');
insert into public.candidate_scores(company_id,candidate_id,job_id,score) values
  (pg_temp.id('a'),pg_temp.id('ca'),pg_temp.id('ja'),70),(pg_temp.id('b'),pg_temp.id('cb'),pg_temp.id('jb'),80);
insert into public.job_reports(company_id,job_id,resumo) values(pg_temp.id('a'),pg_temp.id('ja'),'Report A'),(pg_temp.id('b'),pg_temp.id('jb'),'Report B');
insert into storage.objects(bucket_id,name) select 'resumes',arquivo_original_path from public.candidates where id in(pg_temp.id('ca'),pg_temp.id('cb'));
insert into private.legacy_records(source_system,source_table,source_id,payload) values('test','candidates',pg_temp.id('ca')::text,'{}');

set local role anon;
select pg_temp.denied('anonymous candidates','select * from public.candidates');
select pg_temp.denied('anonymous profiles','select * from public.profiles');
select pg_temp.denied('anonymous companies','select public.create_company(''Attack'',''Attacker'')');
select pg_temp.ok('anonymous storage hidden',(select count(*)=0 from storage.objects where bucket_id='resumes'));
reset role;
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('owner_a'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok('only company A candidates',(select count(*)=1 from public.candidates));
select pg_temp.ok('only company A jobs',(select count(*)=1 from public.jobs));
select pg_temp.ok('only company A scores',(select count(*)=1 from public.candidate_scores));
select pg_temp.ok('only company A reports',(select count(*)=1 from public.job_reports));
select pg_temp.ok('only company A storage',(select count(*)=1 from storage.objects where bucket_id='resumes'));
select pg_temp.ok('other profile hidden',(select count(*)=0 from public.profiles where id=pg_temp.id('owner_b')));
select pg_temp.ok('admin may read colleague profile',(select count(*)=1 from public.profiles where id=pg_temp.id('recruiter')));
select pg_temp.denied('cross company insert',$q$insert into public.candidates(company_id,nome) values(pg_temp.id('b'),'Attack')$q$);
select pg_temp.denied('company reassignment',$q$update public.candidates set company_id=pg_temp.id('b') where id=pg_temp.id('ca')$q$);
select pg_temp.denied('original path replacement',$q$update public.candidates set arquivo_original_path='fake' where id=pg_temp.id('ca')$q$,'428C9');
select pg_temp.denied('AI output tampering',$q$update public.candidates set dados_extraidos='{"skills":["fake"]}' where id=pg_temp.id('ca')$q$);
select pg_temp.denied('score tampering','update public.candidate_scores set score=100');
select pg_temp.denied('report tampering',$q$update public.job_reports set resumo='fake'$q$);
select pg_temp.denied('direct delete forbidden','delete from public.candidates');
select pg_temp.denied('legacy quarantine inaccessible','select * from private.legacy_records');
select pg_temp.denied('cross company archive',$q$select public.archive_candidate(pg_temp.id('a'),pg_temp.id('cb'))$q$);
select pg_temp.denied('cross company job archive',$q$select public.archive_job(pg_temp.id('b'),pg_temp.id('jb'))$q$);
select pg_temp.denied('cross company membership',$q$select public.manage_company_member(pg_temp.id('b'),pg_temp.id('outsider'),'admin')$q$);
select pg_temp.denied('owner cannot be demoted',$q$select public.manage_company_member(pg_temp.id('a'),pg_temp.id('owner_a'),'viewer')$q$);
select pg_temp.denied('client cannot save AI',$q$select public.save_candidate_extraction(pg_temp.id('owner_a'),pg_temp.id('a'),pg_temp.id('ca'),'{}','concluido')$q$);
select pg_temp.denied('client cannot save scores',$q$select public.replace_job_scores(pg_temp.id('owner_a'),pg_temp.id('a'),pg_temp.id('ja'),'[]')$q$);
select pg_temp.denied('other company review denied',$q$select public.save_candidate_review(pg_temp.id('b'),pg_temp.id('cb'),0,'{"observacoes":"Attack"}')$q$);
with changed as(update storage.objects set name='fake' where bucket_id='resumes' returning id)
select pg_temp.ok('original cannot be replaced',(select count(*)=0 from changed));
select pg_temp.denied('other company object upload',$q$insert into storage.objects(bucket_id,name) values('resumes',pg_temp.id('b')::text || '/' || gen_random_uuid()::text || '/original')$q$);
select pg_temp.denied('unlinked object upload',$q$insert into storage.objects(bucket_id,name) values('resumes',pg_temp.id('a')::text || '/' || gen_random_uuid()::text || '/original')$q$);
select pg_temp.denied('direct membership bypass denied',$q$select public.manage_company_member(pg_temp.id('a'),pg_temp.id('outsider'),'viewer')$q$);
select set_config('test.invitation',public.invite_company_member(pg_temp.id('a'),pg_temp.id('outsider')::text||'@isolation-test.invalid','viewer')::text,true);
reset role;
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('outsider'),'role','authenticated')::text,true);
set local role authenticated;
select public.accept_company_invitation(current_setting('test.invitation')::uuid);
reset role;
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('owner_a'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok('accepted invite adds member',(select count(*)=1 from public.company_members where user_id=pg_temp.id('outsider')));
select public.manage_company_member(pg_temp.id('a'),pg_temp.id('outsider'),null);
select pg_temp.ok('owner can revoke member',(select count(*)=0 from public.company_members where user_id=pg_temp.id('outsider')));
select set_config('test.created_company',public.create_company('Test new company','Responsible Person')::text,true);
select pg_temp.ok('company creation gives caller ownership',private.has_role(current_setting('test.created_company')::uuid,array['owner']));
reset role;

select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('recruiter'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok('recruiter profiles limited to self',(select count(*)=1 from public.profiles));
select public.save_candidate_review(pg_temp.id('a'),pg_temp.id('ca'),0,'{"observacoes":"Allowed note"}');
select pg_temp.ok('recruiter edits own company note',(select observacoes='Allowed note' from public.candidates where id=pg_temp.id('ca')));
select pg_temp.denied('recruiter cannot archive',$q$select public.archive_candidate(pg_temp.id('a'),pg_temp.id('ca'))$q$);
select pg_temp.denied('recruiter cannot escalate',$q$select public.manage_company_member(pg_temp.id('a'),pg_temp.id('recruiter'),'admin')$q$);
with changed as(delete from storage.objects where bucket_id='resumes' returning id)
select pg_temp.ok('recruiter cannot delete originals',(select count(*)=0 from changed));
reset role;

select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('viewer'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok('viewer can read own company',(select count(*)=1 from public.candidates));
select pg_temp.denied('viewer cannot edit',$q$select public.save_candidate_review(pg_temp.id('a'),pg_temp.id('ca'),1,'{"observacoes":"Attack"}')$q$);
select pg_temp.denied('viewer cannot create job',$q$insert into public.jobs(company_id,titulo) values(pg_temp.id('a'),'Attack')$q$);
reset role;

select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('outsider'),'role','authenticated','user_metadata',json_build_object('role','owner','company_id',pg_temp.id('a')))::text,true);
set local role authenticated;
select pg_temp.ok('unaffiliated user cannot read',(select count(*)=0 from public.candidates));
select pg_temp.ok('user_metadata cannot grant membership',(select count(*)=0 from public.companies));
select pg_temp.ok('unaffiliated storage hidden',(select count(*)=0 from storage.objects where bucket_id='resumes'));
reset role;

select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('multi'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok('authorized multi-company membership',(select count(*)=2 from public.candidates));
reset role;
set local role service_role;
select pg_temp.denied('legacy assignment requires evidence', $q$update private.legacy_records set confirmed_company_id=pg_temp.id('a'),reviewed_by=pg_temp.id('owner_a'),reviewed_at=now() where source_system='test'$q$,'23514');
select pg_temp.denied('legacy cannot be marked imported before attribution', $q$update private.legacy_records set imported_at=now() where source_system='test'$q$,'23514');
select pg_temp.denied('composite candidate/job FK prevents crossing',$q$insert into public.candidate_scores(company_id,candidate_id,job_id,score) values(pg_temp.id('a'),pg_temp.id('cb'),pg_temp.id('ja'),90)$q$,'23503');
select pg_temp.denied('report/job company FK',$q$insert into public.job_reports(company_id,job_id) values(pg_temp.id('a'),pg_temp.id('jb'))$q$,'23503');
select pg_temp.denied('backend rejects unauthorized actor',$q$select public.replace_job_scores(pg_temp.id('viewer'),pg_temp.id('a'),pg_temp.id('ja'),'[]')$q$);
select public.replace_job_scores(pg_temp.id('owner_a'),pg_temp.id('a'),pg_temp.id('ja'),jsonb_build_array(jsonb_build_object('candidate_id',pg_temp.id('ca'),'score',82,'detalhes_matching','{}'::jsonb)));
select pg_temp.ok('trusted backend persists score',(select score=82 from public.candidate_scores where candidate_id=pg_temp.id('ca')));
reset role;

-- Revoke membership without changing the JWT: access must disappear immediately.
delete from public.company_members where company_id=pg_temp.id('a') and user_id=pg_temp.id('multi');
set local role authenticated;
select pg_temp.ok('revocation effective with existing JWT',(select count(*)=0 from public.candidates where company_id=pg_temp.id('a')));
reset role;
select set_config('request.jwt.claims',json_build_object('sub',pg_temp.id('owner_a'),'role','authenticated')::text,true);
set local role authenticated;
select public.archive_candidate(pg_temp.id('a'),pg_temp.id('ca'));
select pg_temp.ok('archived candidate hidden',(select count(*)=0 from public.candidates where id=pg_temp.id('ca')));
select pg_temp.ok('archived original hidden',(select count(*)=0 from storage.objects where bucket_id='resumes'));
select pg_temp.ok('archived candidate scores removed',(select count(*)=0 from public.candidate_scores where candidate_id=pg_temp.id('ca')));
select public.archive_job(pg_temp.id('a'),pg_temp.id('ja'));
select pg_temp.ok('archived job hidden',(select count(*)=0 from public.jobs where id=pg_temp.id('ja')));
reset role;
select json_build_object('passed',count(*),'failed',0,'tests',json_agg(name)) as results from test_results;
rollback;
