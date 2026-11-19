-- Disposable local/CI only. Every fixture and mutation rolls back.
begin;
create temp table launch_ids(name text primary key,id uuid default gen_random_uuid());
insert into launch_ids(name) values('owner'),('other'),('candidate');
grant select on launch_ids to authenticated,anon;
create function pg_temp.id(text) returns uuid language sql as $$ select id from launch_ids where name=$1 $$;
create function pg_temp.ok(label text,result boolean) returns void language plpgsql as $$
begin if result is distinct from true then raise exception 'FAILED: %',label; end if; raise notice 'PASS %',label; end $$;
create function pg_temp.denied(label text,statement text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then if sqlstate in ('42501','P0001','40001') then raise notice 'PASS %',label;return;end if;raise;end;
 raise exception 'FAILED unexpectedly allowed: %',label;
end $$;
insert into auth.users(id,email,email_confirmed_at,aud,role) select id,name||'@test.invalid',now(),'authenticated','authenticated' from launch_ids where name<>'candidate';
select pg_temp.ok('uninvited user denied',private.before_user_created('{"user":{"email":"uninvited@test.invalid","user_metadata":{"admin":true}}}') ? 'error');
insert into private.pilot_registrations(email,approval_reference,expires_at) values('invited@test.invalid','synthetic-only',now()+interval '1 hour');
select pg_temp.ok('approved synthetic invitation accepted',private.before_user_created('{"user":{"email":"invited@test.invalid"}}')='{}'::jsonb);
update private.pilot_registrations set revoked_at=now();
select pg_temp.ok('revoked invitation denied',private.before_user_created('{"user":{"email":"invited@test.invalid"}}') ? 'error');
update private.pilot_registrations set revoked_at=null,expires_at=now()-interval '1 minute';
select pg_temp.ok('expired invitation denied',private.before_user_created('{"user":{"email":"invited@test.invalid"}}') ? 'error');
select pg_temp.ok('anonymous cannot execute signup hook',not has_function_privilege('anon','private.before_user_created(jsonb)','EXECUTE'));
select pg_temp.ok('authenticated cannot execute signup hook',not has_function_privilege('authenticated','private.before_user_created(jsonb)','EXECUTE'));
select pg_temp.ok('auth service can execute hook',has_function_privilege('supabase_auth_admin','private.before_user_created(jsonb)','EXECUTE'));
do $$ declare r record; begin
 for r in select c.oid,n.nspname,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and n.nspname in ('public','private') loop
  if has_table_privilege('authenticated',r.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon',r.oid,'SELECT,INSERT,UPDATE,DELETE') then
   perform pg_temp.ok('RLS '||r.nspname||'.'||r.relname,r.relrowsecurity);
  end if;
  if r.nspname='private' then perform pg_temp.ok('private inaccessible '||r.relname,not has_table_privilege('authenticated',r.oid,'SELECT,INSERT,UPDATE,DELETE'));end if;
 end loop;
 for r in select p.oid,p.proname,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef loop
  perform pg_temp.ok('definer denies anon '||r.proname,not has_function_privilege('anon',r.oid,'EXECUTE'));
  perform pg_temp.ok('definer fixes search path '||r.proname,array_to_string(r.proconfig,',') like '%search_path=%');
 end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id('owner'),'role','authenticated')::text,true);
select set_config('test.company',public.create_company('Synthetic A','Synthetic owner')::text,true);
select pg_temp.denied('second company refused',$q$select public.create_company('Second','Synthetic owner')$q$);
reset role;
insert into public.candidates(id,company_id,created_by,nome_completo) values(pg_temp.id('candidate'),current_setting('test.company')::uuid,pg_temp.id('owner'),'Synthetic fixture');
insert into storage.objects(bucket_id,name) values('resumes','synthetic/original');
set local role authenticated;
select pg_temp.ok('authenticated cannot list Storage',(select count(*)=0 from storage.objects where bucket_id='resumes'));
select pg_temp.ok('access audit admitted',public.record_document_access(current_setting('test.company')::uuid,pg_temp.id('candidate')));
select set_config('test.request',public.save_privacy_request(current_setting('test.company')::uuid,pg_temp.id('candidate'),'objection','synthetic-request',now()+interval '1 day')::text,true);
select pg_temp.denied('forward requires verified identity',$q$select public.forward_privacy_request(current_setting('test.company')::uuid,current_setting('test.request')::uuid,0,'synthetic-controller')$q$);
select public.save_privacy_request(current_setting('test.company')::uuid,pg_temp.id('candidate'),'objection','synthetic-request',now(),current_setting('test.request')::uuid,0,'verified','synthetic-identity',null);
select public.forward_privacy_request(current_setting('test.company')::uuid,current_setting('test.request')::uuid,1,'synthetic-controller');
select pg_temp.ok('forward records evidence without completing',(select state='verified' and forwarded_at is not null and version=2 from public.privacy_requests where id=current_setting('test.request')::uuid));
select pg_temp.denied('stale forward rejected',$q$select public.forward_privacy_request(current_setting('test.company')::uuid,current_setting('test.request')::uuid,1,'synthetic-controller')$q$);
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id('other'),'role','authenticated')::text,true);
select pg_temp.ok('other tenant cannot list requests',(select count(*)=0 from public.privacy_requests));
select pg_temp.denied('other tenant cannot audit access',$q$select public.record_document_access(current_setting('test.company')::uuid,pg_temp.id('candidate'))$q$);
select pg_temp.denied('other tenant cannot forward',$q$select public.forward_privacy_request(current_setting('test.company')::uuid,current_setting('test.request')::uuid,2,'synthetic-controller')$q$);
select pg_temp.denied('other tenant cannot export',$q$select public.export_privacy_subject(current_setting('test.company')::uuid,current_setting('test.request')::uuid)$q$);
reset role;
-- Removal does not reset company creation quota.
delete from public.company_members where user_id=pg_temp.id('owner');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.id('owner'),'role','authenticated')::text,true);
select pg_temp.denied('revoked member cannot recreate company',$q$select public.create_company('Third','Synthetic owner')$q$);
select pg_temp.denied('revoked member cannot obtain original',$q$select public.record_document_access(current_setting('test.company')::uuid,pg_temp.id('candidate'))$q$);
rollback;
