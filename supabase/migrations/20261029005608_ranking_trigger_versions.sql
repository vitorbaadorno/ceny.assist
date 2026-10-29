-- Version columns can change in BEFORE triggers without appearing in SET.
drop trigger invalidate_job_rankings on public.jobs;
create trigger invalidate_job_rankings after update on public.jobs for each row when (new.version is distinct from old.version or new.status is distinct from old.status or new.excluido is distinct from old.excluido) execute function private.invalidate_job_rankings();
drop trigger invalidate_ranking_history on public.candidates;
create trigger invalidate_ranking_history_insert_delete after insert or delete on public.candidates for each row execute function private.invalidate_ranking_history();
create trigger invalidate_ranking_history_update after update on public.candidates for each row when (row(new.data_version,new.review_version,new.processing_status,new.review_status,new.excluido) is distinct from row(old.data_version,old.review_version,old.processing_status,old.review_status,old.excluido)) execute function private.invalidate_ranking_history();
