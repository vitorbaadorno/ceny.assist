create table private.gemini_request_windows(
 company_id uuid not null references public.companies on delete cascade,
 actor_id uuid not null references auth.users on delete cascade,
 window_at timestamptz not null,n integer not null check(n between 1 and 10),
 primary key(company_id,actor_id)
);
create index gemini_window_actor on private.gemini_request_windows(actor_id);
alter table private.gemini_request_windows enable row level security;
revoke all on private.gemini_request_windows from public,anon,authenticated,service_role;
create function private.admit_ai_request(p_company uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão.' using errcode='42501';end if;
 insert into private.gemini_request_windows as w values(p_company,auth.uid(),date_trunc('minute',clock_timestamp()),1)
 on conflict(company_id,actor_id) do update set
 window_at=excluded.window_at,n=case when w.window_at=excluded.window_at then w.n+1 else 1 end
 where w.window_at<>excluded.window_at or w.n<10
 returning true into allowed;
 return coalesce(allowed,false);
end$$;
create function public.admit_ai_request(p_company uuid) returns boolean language sql security invoker set search_path='' as $$select private.admit_ai_request(p_company)$$;
revoke all on function private.admit_ai_request(uuid),public.admit_ai_request(uuid) from public,anon,authenticated,service_role;
grant execute on function private.admit_ai_request(uuid),public.admit_ai_request(uuid) to authenticated;
