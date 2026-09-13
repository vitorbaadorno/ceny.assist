CREATE OR REPLACE FUNCTION public.archive_candidate(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.candidates
  SET excluido = true, excluido_em = now(), arquivo_original_path = NULL
  WHERE id = p_id AND excluido = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'candidate not found';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_job(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.jobs
  SET excluido = true, excluido_em = now()
  WHERE id = p_id AND excluido = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_candidate(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_candidate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_job(uuid) TO authenticated;