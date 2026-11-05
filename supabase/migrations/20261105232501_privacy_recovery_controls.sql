-- Hide legacy reports while their unstructured snapshots await purge.
drop policy report_read on public.job_reports;
create policy report_read on public.job_reports for select to authenticated using(private.has_role(company_id)
 and exists(select 1 from public.jobs j where j.id=job_id and j.company_id=job_reports.company_id and not j.excluido)
 and not exists(select 1 from public.privacy_erasure_operations e where e.company_id=job_reports.company_id and e.state<>'completed'));
-- The subquery needs a definer helper because privacy tables are admin-only.
create function private.privacy_erasure_pending(p_company uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.privacy_erasure_operations where company_id=p_company and state<>'completed')
$$;
revoke all on function private.privacy_erasure_pending(uuid) from public,anon,authenticated;
grant execute on function private.privacy_erasure_pending(uuid) to authenticated;
alter policy report_read on public.job_reports using(private.has_role(company_id)
 and exists(select 1 from public.jobs j where j.id=job_id and j.company_id=job_reports.company_id and not j.excluido)
 and not private.privacy_erasure_pending(company_id));

-- Archive takes the same serialization lock as extraction, erasure and merge.
create or replace function private.archive_record(p_company uuid,p_id uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.companies where id=p_company for update;
 if not private.has_role(p_company,array['owner','admin']) then raise exception 'Sem permissão para arquivar.' using errcode='42501';end if;
 if p_kind='candidate' then
  update public.candidates set excluido=true,deleted_at=now() where company_id=p_company and id=p_id and not excluido;
  if not found then raise exception 'Registro indisponível' using errcode='42501';end if;
  delete from public.candidate_scores where company_id=p_company and candidate_id=p_id;
  delete from public.job_reports where company_id=p_company;
 elsif p_kind='job' then
  update public.jobs set excluido=true,deleted_at=now() where company_id=p_company and id=p_id and not excluido;
  if not found then raise exception 'Registro indisponível' using errcode='42501';end if;
  delete from public.candidate_scores where company_id=p_company and job_id=p_id;
  delete from public.job_reports where company_id=p_company and job_id=p_id;
 else raise exception 'Tipo inválido';end if;
 insert into public.privacy_events(company_id,actor_id,action,subject_id) values(p_company,auth.uid(),'archive_'||p_kind,p_id);
end $$;

-- Service-only recovery export. Store SIGNED output separately from DB/backups.
create function public.export_privacy_ledger() returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('version',1,'exported_at',clock_timestamp(),
  'erasures',coalesce((select jsonb_agg(jsonb_build_object('company_id',company_id,'candidate_ids',candidate_ids,'requested_at',created_at)) from public.privacy_erasure_operations),'[]'),
  'companies',coalesce((select jsonb_agg(id) from public.companies),'[]'))
$$;

-- Invoke ONLY on a restored, network-isolated project, before reopening access.
-- Revokes ALL restored memberships, invitations and recovery codes, rather than
-- trusting potentially outdated grants in the backup. Regrant requires new approval.
create function private.reconcile_privacy_restore(p_company uuid,p_erased uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare op uuid;ids uuid[];
begin
 perform 1 from public.companies where id=p_company for update;
 if not found then return null;end if;
 if p_erased is null or cardinality(p_erased)>10000 then raise exception 'Manifesto inválido';end if;
 delete from public.company_members where company_id=p_company;
 update public.company_invitations set revoked_at=now() where company_id=p_company;
 delete from private.company_recovery where company_id=p_company;
 update public.resume_jobs set state='cancelled',phase='done',lease_token=null,lease_until=null,finished_at=now(),message='Ambiente restaurado em quarentena.' where company_id=p_company and state in ('queued','running','retry_wait','blocked');
 insert into public.privacy_events(company_id,action,subject_id) values(p_company,'restore_quarantined',p_company);
 select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into ids from unnest(p_erased) id where id is not null;
 if cardinality(ids)=0 then return null;end if;
 -- Reset pre-backup completion markers: restored data must be removed again.
 insert into public.privacy_erasure_operations(company_id,candidate_ids,request_id,reason) values(p_company,ids,gen_random_uuid(),'Reconciliação de restauração com manifesto externo verificado.') returning id into op;
 insert into private.privacy_erasure_files select op,'resumes',object_path from public.resume_documents where company_id=p_company and candidate_id=any(ids)
 union select op,'resumes',p_company::text||'/'||id::text||'/original' from unnest(ids) id;
 update public.privacy_retention_holds set released_at=now(),release_reason='Eliminação já registrada no manifesto externo anterior à restauração.' where company_id=p_company and candidate_id=any(ids) and released_at is null;
 update public.candidates set excluido=true,active_document_id=null,merged_into_id=null where company_id=p_company and id=any(ids);
 return op;
end $$;
create function public.reconcile_privacy_restore(p_company uuid,p_erased uuid[]) returns uuid language sql security invoker set search_path='' as $$select private.reconcile_privacy_restore(p_company,p_erased)$$;
revoke all on function public.export_privacy_ledger(),private.reconcile_privacy_restore(uuid,uuid[]),public.reconcile_privacy_restore(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.export_privacy_ledger(),private.reconcile_privacy_restore(uuid,uuid[]),public.reconcile_privacy_restore(uuid,uuid[]) to service_role;
