create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create table private.resume_dispatch (
 id boolean primary key default true check(id), endpoint text, secret_id uuid not null,
 last_request_id bigint, last_requested_at timestamptz
);
alter table private.resume_dispatch enable row level security;
revoke all on private.resume_dispatch from public,anon,authenticated,service_role;
insert into private.resume_dispatch(id,secret_id) values(true,vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'ceny_resume_dispatch'));

create function private.verify_resume_dispatch(p_token text) returns boolean language sql security definer set search_path='' as $$
 select length(p_token)=64 and exists(select 1 from private.resume_dispatch d join vault.decrypted_secrets s on s.id=d.secret_id
 where extensions.digest(s.decrypted_secret,'sha256')=extensions.digest(p_token,'sha256'))
$$;
create function public.verify_resume_dispatch(p_token text) returns boolean language sql security invoker set search_path='' as $$select private.verify_resume_dispatch(p_token)$$;
create function private.configure_resume_dispatch(p_endpoint text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_endpoint !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/ceny-queue$' and p_endpoint<>'http://kong:8000/functions/v1/ceny-queue' then raise exception 'Destino inválido';end if;
 update private.resume_dispatch set endpoint=p_endpoint where id;
end $$;
create function private.dispatch_resume_queue() returns bigint language plpgsql security definer set search_path='' as $$
declare config private.resume_dispatch; token text; request_id bigint;
begin
 select * into config from private.resume_dispatch where id;
 if config.endpoint is null or not exists(select 1 from public.resume_jobs where
  (state in ('queued','retry_wait') and available_at<=now()) or (state='running' and lease_until<now())) then return null;end if;
 select decrypted_secret into token from vault.decrypted_secrets where id=config.secret_id;
 select net.http_post(url:=config.endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-ceny-queue-token',token),body:='{}'::jsonb,timeout_milliseconds:=130000) into request_id;
 update private.resume_dispatch set last_request_id=request_id,last_requested_at=now() where id;
 return request_id;
end $$;
-- Also expire manifests for files which never reached the server.
create function private.expire_resume_manifests() returns void language sql security definer set search_path='' as $$
 update public.resume_batch_entries e set state='missing',message='Arquivo não recebido. Selecione-o novamente.',updated_at=now()
 from public.resume_batches b where b.id=e.batch_id and e.state='waiting' and b.created_at<now()-interval '1 hour'
$$;
revoke all on function private.verify_resume_dispatch(text),public.verify_resume_dispatch(text),private.configure_resume_dispatch(text),private.dispatch_resume_queue(),private.expire_resume_manifests() from public,anon,authenticated,service_role;
grant execute on function private.verify_resume_dispatch(text),public.verify_resume_dispatch(text) to service_role;
select cron.schedule('ceny-resume-queue','* * * * *','select private.expire_resume_manifests(); select private.dispatch_resume_queue();');
