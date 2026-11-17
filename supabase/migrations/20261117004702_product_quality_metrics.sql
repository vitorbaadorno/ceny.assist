-- Read-only aggregate projection; does not collect new personal data.
create function private.product_quality_metrics(p_company uuid, p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.ops_admin(p_company);
 if p_since is null or p_since > now() or p_since < now()-interval '90 days' then
  raise exception 'Intervalo de métricas inválido.' using errcode='22023';
 end if;
 with entries as materialized (
  select e.state,
   case when lower(e.filename) ~ '\.pdf$' then 'pdf'
        when lower(e.filename) ~ '\.docx$' then 'docx'
        when lower(e.filename) ~ '\.png$' then 'png'
        when lower(e.filename) ~ '\.jpe?g$' then 'jpeg' else 'other' end as format
  from public.resume_batch_entries e join public.resume_batches b on b.id=e.batch_id
  where b.company_id=p_company and b.created_at>=p_since
 ), formats as (
  select format,count(*) total,count(*) filter(where state='rejected') rejected from entries group by format
 ), jobs as materialized (
  select state,extract(epoch from (finished_at-created_at))*1000 as latency
  from public.resume_jobs where company_id=p_company and created_at>=p_since
 )
 select jsonb_build_object(
  'selected_files',(select count(*) from entries),
  'received_files',(select count(*) from entries where state='received'),
  'rejected_files',(select count(*) from entries where state='rejected'),
  'abandoned_files',(select count(*) from entries where state in ('missing','cancelled')),
  'pending_files',(select count(*) from entries where state='waiting'),
  'upload_failure_rate',(select count(*) filter(where state='rejected')::numeric/nullif(count(*) filter(where state in ('received','rejected')),0) from entries),
  'analysis_p50_ms',(select percentile_cont(0.5) within group(order by latency) from jobs where state in ('succeeded','review') and latency>=0),
  'analysis_p95_ms',(select percentile_cont(0.95) within group(order by latency) from jobs where state in ('succeeded','review') and latency>=0),
  'analysis_failed',(select count(*) from jobs where state='failed'),
  'analysis_blocked',(select count(*) from jobs where state='blocked'),
  'human_reviews_recorded',(select count(*) from private.ops_events where company_id=p_company and at>=p_since and action='review_completed'),
  'formats',(select coalesce(jsonb_agg(to_jsonb(formats) order by format),'[]'::jsonb) from formats)
 ) into result;
 return result;
end $$;
revoke all on function private.product_quality_metrics(uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.product_quality_metrics(uuid,timestamptz) to authenticated;
create function public.product_quality_metrics(p_company uuid,p_since timestamptz)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.product_quality_metrics(p_company,p_since)
$$;
revoke all on function public.product_quality_metrics(uuid,timestamptz) from public,anon;
grant execute on function public.product_quality_metrics(uuid,timestamptz) to authenticated;
