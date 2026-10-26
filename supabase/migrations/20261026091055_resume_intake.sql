-- Only the validated intake service may create candidates or write originals.
revoke insert(id, company_id, nome, arquivo_nome) on public.candidates from authenticated;
drop policy resume_insert on storage.objects;
drop policy resume_delete on storage.objects;
update storage.buckets set file_size_limit=10485760,
 allowed_mime_types=array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
 where id='resumes';

create table public.resume_batches (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 uploaded_by uuid references auth.users(id) on delete set null,
 source text not null check(source in ('selecao_local','email','indicacao','outro')),
 file_count integer not null check(file_count between 1 and 5), created_at timestamptz not null default now()
);
create index resume_batches_company on public.resume_batches(company_id,created_at);
create index resume_batches_actor on public.resume_batches(uploaded_by);
create table public.resume_documents (
 id uuid primary key default gen_random_uuid(), company_id uuid not null,
 candidate_id uuid not null unique, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 filename text not null check(length(filename) between 1 and 180),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 byte_size integer not null check(byte_size between 1 and 10485760),
 page_count integer not null check(page_count between 1 and 20),
 source text not null check(source in ('selecao_local','email','indicacao','outro')),
 uploaded_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 state text not null default 'receiving' check(state in ('receiving','uploaded','reading','completed','review','error','cleaning')),
 error_message text, stored_at timestamptz, ai_started_at timestamptz, finished_at timestamptz,
 operation_token uuid not null default gen_random_uuid(), updated_at timestamptz not null default now(),
 foreign key(company_id,candidate_id) references public.candidates(company_id,id),
 unique(company_id,sha256)
);
create index resume_documents_actor on public.resume_documents(uploaded_by);
create index resume_documents_stale on public.resume_documents(company_id,updated_at) where state in ('receiving','reading','cleaning');
create table public.resume_batch_items (
 batch_id uuid not null references public.resume_batches(id), slot integer not null check(slot between 0 and 4),
 document_id uuid not null references public.resume_documents(id), primary key(batch_id,slot)
);
create index resume_batch_items_document on public.resume_batch_items(document_id);
alter table public.resume_batches enable row level security;
alter table public.resume_documents enable row level security;
alter table public.resume_batch_items enable row level security;
revoke all on public.resume_batches,public.resume_documents,public.resume_batch_items from anon,authenticated;
grant select on public.resume_batches,public.resume_documents,public.resume_batch_items to authenticated;
grant all on public.resume_batches,public.resume_documents,public.resume_batch_items to service_role;
create policy batches_read on public.resume_batches for select to authenticated using(private.has_role(company_id));
create policy documents_read on public.resume_documents for select to authenticated using(private.has_role(company_id)
 and exists(select 1 from public.candidates c where c.id=candidate_id and c.company_id=resume_documents.company_id and not c.excluido));
create policy batch_items_read on public.resume_batch_items for select to authenticated using(exists(select 1 from public.resume_batches b where b.id=batch_id));

create function private.begin_resume_batch(p_company uuid,p_count integer,p_source text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.has_role(p_company,array['owner','admin','recruiter']) then raise exception 'Sem permissão para enviar currículos.' using errcode='42501'; end if;
 insert into public.resume_batches(company_id,uploaded_by,source,file_count) values(p_company,auth.uid(),p_source,p_count) returning id into result;
 return result;
end $$;
create function public.begin_resume_batch(p_company uuid,p_count integer,p_source text) returns uuid
language sql security invoker set search_path='' as $$ select private.begin_resume_batch(p_company,p_count,p_source) $$;
revoke all on function private.begin_resume_batch(uuid,integer,text),public.begin_resume_batch(uuid,integer,text) from public,anon,authenticated;
grant execute on function private.begin_resume_batch(uuid,integer,text),public.begin_resume_batch(uuid,integer,text) to authenticated;

-- SHA is computed from validated bytes by the service, never supplied by the client.
create function public.reserve_resume(p_actor uuid,p_company uuid,p_batch uuid,p_slot integer,p_sha text,p_filename text,p_mime text,p_size integer,p_pages integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.resume_batches; d public.resume_documents; v_candidate uuid; v_existing uuid; v_owned boolean:=false;
begin
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
 select * into b from public.resume_batches where id=p_batch and company_id=p_company and uploaded_by=p_actor for update;
 if not found or b.created_at < now()-interval '1 hour' or p_slot<0 or p_slot>=b.file_count then raise exception 'Lote inválido ou expirado'; end if;
 -- Serialize content reservations even across batches, tabs and concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(p_company::text||p_sha,0));
 select * into d from public.resume_documents where company_id=p_company and sha256=p_sha for update;
 select document_id into v_existing from public.resume_batch_items where batch_id=p_batch and slot=p_slot;
 if v_existing is not null and (d.id is null or v_existing<>d.id) then raise exception 'Posição do lote já utilizada'; end if;
 if d.id is null then
  insert into public.candidates(company_id,nome,arquivo_nome,created_by) values(p_company,p_filename,p_filename,p_actor) returning id into v_candidate;
  insert into public.resume_documents(company_id,candidate_id,sha256,filename,mime_type,byte_size,page_count,source,uploaded_by)
   values(p_company,v_candidate,p_sha,p_filename,p_mime,p_size,p_pages,b.source,p_actor) returning * into d;
  v_owned:=true;
 elsif exists(select 1 from public.candidates where id=d.candidate_id and excluido) then
  raise exception 'Este currículo já está arquivado. Consulte o administrador.';
 elsif d.state='error' and d.ai_started_at is null and not exists(
  select 1 from storage.objects o join public.candidates c on c.arquivo_original_path=o.name where o.bucket_id='resumes' and c.id=d.candidate_id) then
  update public.resume_documents set state='receiving',error_message=null,operation_token=gen_random_uuid(),updated_at=now() where id=d.id returning * into d;
  v_owned:=true;
 end if;
 insert into public.resume_batch_items values(p_batch,p_slot,d.id) on conflict do nothing;
 return jsonb_build_object('documentId',d.id,'candidateId',d.candidate_id,'state',d.state,'owned',v_owned,'token',case when v_owned then d.operation_token end,
  'path',p_company::text||'/'||d.candidate_id::text||'/original','message',d.error_message);
end $$;

create function public.finish_resume_upload(p_actor uuid,p_company uuid,p_document uuid,p_token uuid,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
 update public.resume_documents set state=case when p_error is null then 'uploaded' else 'error' end,
  stored_at=case when p_error is null then now() else null end,error_message=p_error,updated_at=now()
 where id=p_document and company_id=p_company and state='receiving' and operation_token=p_token;
 if not found then raise exception 'Envio não está mais ativo'; end if;
end $$;

-- At most one AI invocation per document, including after ambiguous timeouts.
create function public.claim_resume_extraction(p_actor uuid,p_company uuid,p_candidate uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.resume_documents;
begin
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
 select * into d from public.resume_documents where company_id=p_company and candidate_id=p_candidate for update;
 if not found or not exists(select 1 from public.candidates where id=p_candidate and not excluido) then raise exception 'Documento indisponível'; end if;
 if d.state<>'uploaded' or d.ai_started_at is not null then
  return jsonb_build_object('owned',false,'state',d.state,'message',d.error_message);
 end if;
 update public.resume_documents set state='reading',ai_started_at=now(),operation_token=gen_random_uuid(),updated_at=now() where id=d.id returning * into d;
 return jsonb_build_object('owned',true,'token',d.operation_token,'state',d.state);
end $$;

create function public.finish_resume_extraction(p_actor uuid,p_company uuid,p_candidate uuid,p_token uuid,p_extraction jsonb,p_status text,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.resume_documents where candidate_id=p_candidate and company_id=p_company and state='reading' and operation_token=p_token for update;
 if not found then raise exception 'Leitura não está mais ativa'; end if;
 perform public.save_candidate_extraction(p_actor,p_company,p_candidate,p_extraction,p_status,p_error);
 update public.resume_documents set state=case p_status when 'concluido' then 'completed' when 'revisao_manual' then 'review' else 'error' end,
 error_message=p_error,finished_at=now(),updated_at=now() where candidate_id=p_candidate;
end $$;

-- Claim cleanup before touching Storage. The one-hour grace exceeds function lifetime.
-- Existing legacy candidate/quarantine references are preserved.
create function public.claim_resume_cleanup(p_actor uuid,p_company uuid)
returns table(document_id uuid,object_path text) language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.company_members where company_id=p_company and user_id=p_actor and role in ('owner','admin','recruiter') for share;
 if not found then raise exception 'Acesso revogado' using errcode='42501'; end if;
 update public.resume_documents set state='review',error_message='A leitura foi interrompida. Revise os dados; não haverá nova cobrança automática.',updated_at=now()
 where company_id=p_company and state='reading' and updated_at<now()-interval '1 hour';
 update public.candidates c set processing_status='revisao_manual',processing_error=d.error_message
 from public.resume_documents d where c.id=d.candidate_id and d.company_id=p_company and d.state='review' and d.finished_at is null;
 return query with stale as (
  select d.id from public.resume_documents d where d.company_id=p_company and d.state in ('receiving','cleaning')
   and d.updated_at<now()-interval '1 hour' order by d.updated_at limit 50 for update skip locked
 ), claimed as (
  update public.resume_documents d set state='cleaning',updated_at=now() from stale s where d.id=s.id returning d.id,d.candidate_id
 ) select x.id,c.arquivo_original_path from claimed x join public.candidates c on c.id=x.candidate_id;
 return query select null::uuid,o.name from storage.objects o where o.bucket_id='resumes' and starts_with(o.name,p_company::text||'/')
 and o.created_at<now()-interval '1 hour'
 and not exists(select 1 from public.candidates c where c.arquivo_original_path=o.name)
 and not exists(select 1 from private.legacy_records l where l.original_object_path=o.name) limit 50;
end $$;
create function public.finish_resume_cleanup(p_company uuid,p_document uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.resume_documents set state='error',error_message='Envio interrompido; arquivo temporário removido. Selecione o arquivo novamente.',updated_at=now()
 where id=p_document and company_id=p_company and state='cleaning';
 update public.candidates c set processing_status='erro',processing_error=d.error_message from public.resume_documents d
 where d.id=p_document and d.company_id=p_company and c.id=d.candidate_id and d.state='error';
end $$;

revoke all on function public.reserve_resume(uuid,uuid,uuid,integer,text,text,text,integer,integer),
 public.finish_resume_upload(uuid,uuid,uuid,uuid,text),public.claim_resume_extraction(uuid,uuid,uuid),
 public.finish_resume_extraction(uuid,uuid,uuid,uuid,jsonb,text,text),public.claim_resume_cleanup(uuid,uuid),public.finish_resume_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_resume(uuid,uuid,uuid,integer,text,text,text,integer,integer),
 public.finish_resume_upload(uuid,uuid,uuid,uuid,text),public.claim_resume_extraction(uuid,uuid,uuid),
 public.finish_resume_extraction(uuid,uuid,uuid,uuid,jsonb,text,text),public.claim_resume_cleanup(uuid,uuid),public.finish_resume_cleanup(uuid,uuid) to service_role;
