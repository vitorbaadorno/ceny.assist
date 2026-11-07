begin;
-- Synthetic upgrade inventory, used only by the disposable CI database.
create temporary table upgrade_ids as select gen_random_uuid() tenant,gen_random_uuid() actor,gen_random_uuid() batch,gen_random_uuid() vacancy;
insert into auth.users(id,email,email_confirmed_at,role,aud) select actor,'upgrade@example.invalid',now(),'authenticated','authenticated' from upgrade_ids;
insert into public.companies(id,name) select tenant,'Synthetic upgrade' from upgrade_ids;
insert into public.company_members(company_id,user_id,role) select tenant,actor,'owner' from upgrade_ids;
insert into public.jobs(id,company_id,titulo,status) select vacancy,tenant,'Legacy fixture','legacy_unknown' from upgrade_ids;
insert into public.resume_batches(id,company_id,uploaded_by,file_count,source) select batch,tenant,actor,1,'email' from upgrade_ids;
create temp table upgrade_reservation as select public.reserve_resume_version(actor,tenant,batch,0,repeat('a',64),'fixture.pdf','application/pdf',100,1,null) r from upgrade_ids;
select public.finish_resume_upload(actor,tenant,(r->>'documentId')::uuid,(r->>'token')::uuid) from upgrade_ids,upgrade_reservation;
create temp table upgrade_manifest as select d.id,d.candidate_id,d.company_id,d.object_path,d.sha256,d.version,d.byte_size from public.resume_documents d join upgrade_ids u on u.tenant=d.company_id;
insert into public.candidate_revisions(company_id,candidate_id,version,action,changes) select company_id,candidate_id,75,'legacy_baseline','{}' from upgrade_manifest;

commit;
