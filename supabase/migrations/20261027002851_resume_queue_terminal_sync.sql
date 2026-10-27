-- Cancellation by revocation/recovery must also stop the candidate's processing badge.
create function private.sync_resume_cancellation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.state='cancelled' and old.state is distinct from new.state then
  update public.resume_documents set state='error',error_message=coalesce(new.message,'Leitura cancelada.'),finished_at=now(),updated_at=now() where id=new.document_id;
  update public.candidates set processing_status='erro',processing_error=coalesce(new.message,'Leitura cancelada.') where id=new.candidate_id and company_id=new.company_id;
 end if;
 return new;
end $$;
revoke all on function private.sync_resume_cancellation() from public,anon,authenticated,service_role;
create trigger sync_resume_cancellation after update of state on public.resume_jobs for each row execute function private.sync_resume_cancellation();
