-- CHECK expressions accept NULL; require each part of ownership evidence explicitly.
alter table private.legacy_records add constraint legacy_complete_review check (
  confirmed_company_id is null or (
    ownership_evidence is not null and length(trim(ownership_evidence)) > 0
    and reviewed_by is not null and reviewed_at is not null
  )
);
