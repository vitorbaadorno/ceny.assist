do $$declare u record; d record; cards jsonb;begin
 select * into strict u from upgrade_ids;select * into strict d from upgrade_manifest;
 if not exists(select 1 from public.jobs j join private.legacy_job_states l on l.job_id=j.id where j.id=u.vacancy and j.status='indefinida' and l.original_status='legacy_unknown') then raise exception 'Legacy state lost';end if;
 if not exists(select 1 from public.resume_documents v where (v.id,v.candidate_id,v.company_id,v.object_path,v.sha256,v.version,v.byte_size)=(d.id,d.candidate_id,d.company_id,d.object_path,d.sha256,d.version,d.byte_size)) then raise exception 'Original changed';end if;
 if not exists(select 1 from public.candidate_revisions where company_id=u.tenant and version=75 and source_document_id is null) then raise exception 'Historical revision lost or source invented';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',u.actor,'role','authenticated')::text,true);
 insert into public.candidate_revisions(company_id,candidate_id,version,action,changes) values(u.tenant,d.candidate_id,76,'save','{}');
 if not exists(select 1 from public.candidate_revisions where company_id=u.tenant and version=76 and actor_id=u.actor and source_document_id=d.id) then raise exception 'Missing actor or document';end if;
 cards:=public.browse_job_cards(u.tenant);
 if (cards->>'total')::int<>1 or cards#>>'{items,0,id}'<>u.vacancy::text or (cards#>'{items,0}')?'criteria' then raise exception 'Unexpected list projection';end if;
 if (select count(*) from public.batch_current_jobs(u.tenant,array[d.id,d.id]))<>1 then raise exception 'Latest generation not unique';end if;
 begin update public.jobs set status='invalid' where id=u.vacancy; raise exception 'Invalid status accepted';exception when check_violation then null;end;
end$$;