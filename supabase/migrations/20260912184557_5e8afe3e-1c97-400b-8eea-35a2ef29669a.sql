ALTER TABLE public.jobs
  ADD COLUMN categoria TEXT NOT NULL DEFAULT 'regular',
  ADD COLUMN excluido BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN excluido_em TIMESTAMPTZ,
  ADD CONSTRAINT jobs_categoria_valida CHECK (categoria IN ('regular', 'jovem_aprendiz'));

ALTER TABLE public.candidates
  ADD COLUMN data_nascimento DATE,
  ADD COLUMN excluido BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN excluido_em TIMESTAMPTZ;

REVOKE DELETE ON public.jobs FROM authenticated;
REVOKE DELETE ON public.candidates FROM authenticated;

DROP POLICY "jobs_all_authenticated" ON public.jobs;
CREATE POLICY "jobs_select_active_authenticated"
  ON public.jobs FOR SELECT TO authenticated
  USING (excluido = false);
CREATE POLICY "jobs_insert_authenticated"
  ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (excluido = false);
CREATE POLICY "jobs_update_active_authenticated"
  ON public.jobs FOR UPDATE TO authenticated
  USING (excluido = false)
  WITH CHECK (true);

DROP POLICY "candidates_all_authenticated" ON public.candidates;
CREATE POLICY "candidates_select_active_authenticated"
  ON public.candidates FOR SELECT TO authenticated
  USING (excluido = false);
CREATE POLICY "candidates_insert_authenticated"
  ON public.candidates FOR INSERT TO authenticated
  WITH CHECK (excluido = false);
CREATE POLICY "candidates_update_active_authenticated"
  ON public.candidates FOR UPDATE TO authenticated
  USING (excluido = false)
  WITH CHECK (true);

CREATE INDEX idx_jobs_active_category_created
  ON public.jobs (categoria, created_at DESC)
  WHERE excluido = false;
CREATE INDEX idx_candidates_active_created
  ON public.candidates (created_at DESC)
  WHERE excluido = false;
CREATE INDEX idx_candidates_active_birth_date
  ON public.candidates (data_nascimento)
  WHERE excluido = false AND data_nascimento IS NOT NULL;