create or replace function public.finish_privacy_erasure(p_operation uuid,p_token uuid,p_success boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
declare op public.privacy_erasure_operations;
begin
 select * into op from public.privacy_erasure_operations where id=p_operation and lease_token=p_token and state='files_pending' for update;
 if not found then return false;end if;
 if p_success and not exists(select 1 from private.privacy_erasure_files f join storage.objects o on o.bucket_id=f.bucket and o.name=f.object_path where f.operation_id=op.id) then
  update public.privacy_erasure_operations set state='completed',completed_at=now(),lease_token=null,lease_until=null,last_error=null where id=op.id;
  -- Keep generated object identifiers as private restore tombstones; no file contents.
  insert into public.privacy_events(company_id,action,subject_id) values(op.company_id,'erasure_completed',op.id);
  return true;
 end if;
 update public.privacy_erasure_operations set lease_token=null,lease_until=null,available_at=now()+interval '5 minutes',last_error='Dados do banco eliminados; remoção dos arquivos pendente. O sistema tentará novamente.' where id=op.id;
 return false;
end $$;

create or replace function public.export_privacy_ledger() returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('version',1,'exported_at',clock_timestamp(),
  'erasures',coalesce((select jsonb_agg(jsonb_build_object('company_id',e.company_id,'candidate_ids',e.candidate_ids,'requested_at',e.created_at,
   'objects',coalesce((select jsonb_agg(object_path order by object_path) from private.privacy_erasure_files where operation_id=e.id),'[]')))
   from public.privacy_erasure_operations e),'[]'),
  'companies',coalesce((select jsonb_agg(id) from public.companies),'[]'))
$$;
create function public.reconcile_privacy_restore_objects(p_company uuid,p_erased uuid[],p_objects text[]) returns uuid
language plpgsql security invoker set search_path='' as $$
declare op uuid;
begin
 if p_objects is null or cardinality(p_objects)>50000 or exists(select 1 from unnest(p_objects) path where path is null or not starts_with(path,p_company::text||'/') or path !~ '^[a-f0-9-]{36}/([a-f0-9-]{36}|documents/[a-f0-9-]{36})/original$') then raise exception 'Manifesto de objetos inválido';end if;
 op:=private.reconcile_privacy_restore(p_company,p_erased);
 if op is null and cardinality(p_objects)>0 then raise exception 'Objetos sem identificadores eliminados';end if;
 if op is not null then insert into private.privacy_erasure_files select op,'resumes',path from unnest(p_objects) path on conflict do nothing;end if;
 return op;
end $$;
revoke all on function public.reconcile_privacy_restore_objects(uuid,uuid[],text[]) from public,anon,authenticated;
grant execute on function public.reconcile_privacy_restore_objects(uuid,uuid[],text[]) to service_role;
