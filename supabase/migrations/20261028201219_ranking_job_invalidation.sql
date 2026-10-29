create function private.invalidate_job_rankings() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.version is distinct from old.version or new.status is distinct from old.status or new.excluido is distinct from old.excluido then
  update public.ranking_runs set stale=true where company_id=new.company_id and job_id=new.id and status='completed';
 end if;
 return new;
end$$;
revoke all on function private.invalidate_job_rankings() from public,anon,authenticated;
create trigger invalidate_job_rankings after update of version,status,excluido on public.jobs for each row execute function private.invalidate_job_rankings();
