-- Read-only snapshot for comparing the deployed environment with this audit.
select jsonb_build_object(
  'project', 'wikerxujjvmoksrmjywo',
  'tables', (select jsonb_agg(to_jsonb(t) order by t.schema,t.name) from (
    select n.nspname as schema,c.relname as name,c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('public','private')
  ) t),
  'policies', (select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)
    from pg_policies p where p.schemaname in ('public','private') or (p.schemaname='storage' and p.tablename='objects')),
  'table_grants', (select jsonb_agg(to_jsonb(g) order by g.table_schema,g.table_name,g.grantee,g.privilege_type)
    from information_schema.table_privileges g where g.table_schema in ('public','private') and g.grantee in ('anon','authenticated','service_role','PUBLIC')),
  'column_grants', (select jsonb_agg(to_jsonb(g) order by g.table_name,g.column_name,g.grantee,g.privilege_type)
    from information_schema.column_privileges g where g.table_schema='public' and g.grantee='authenticated' and g.privilege_type<>'SELECT'),
  'functions', (select jsonb_agg(to_jsonb(f) order by f.signature) from (
    select p.oid::regprocedure::text as signature,p.prosecdef as security_definer,p.proconfig as settings,p.proacl::text as acl,
      md5(pg_get_functiondef(p.oid)) as definition_md5
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'
  ) f),
  'buckets', (select jsonb_agg(jsonb_build_object('id',id,'public',public,'size_limit',file_size_limit,'mime_types',allowed_mime_types) order by id)
    from storage.buckets where id in ('resumes','legacy-quarantine')),
  'migrations', (select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations)
) as audit;
