
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  email TEXT,
  telefone TEXT,
  localizacao TEXT,
  dados_extraidos JSONB NOT NULL DEFAULT '{}'::jsonb,
  skills TEXT[] NOT NULL DEFAULT '{}',
  anos_experiencia NUMERIC,
  status TEXT NOT NULL DEFAULT 'novo',
  processing_status TEXT NOT NULL DEFAULT 'processando',
  processing_error TEXT,
  arquivo_original_path TEXT,
  arquivo_nome TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_all_authenticated" ON public.candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  requisitos_obrigatorios TEXT[] NOT NULL DEFAULT '{}',
  requisitos_desejaveis TEXT[] NOT NULL DEFAULT '{}',
  experiencia_minima NUMERIC NOT NULL DEFAULT 0,
  formacao_exigida TEXT,
  localizacao TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_all_authenticated" ON public.jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.candidate_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  detalhes_matching JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, job_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_scores TO authenticated;
GRANT ALL ON public.candidate_scores TO service_role;
ALTER TABLE public.candidate_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_all_authenticated" ON public.candidate_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER scores_updated_at BEFORE UPDATE ON public.candidate_scores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.job_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs ON DELETE CASCADE,
  conteudo JSONB NOT NULL DEFAULT '{}'::jsonb,
  resumo TEXT,
  pdf_path TEXT,
  enviado_para TEXT,
  enviado_em TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_reports TO authenticated;
GRANT ALL ON public.job_reports TO service_role;
ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_all_authenticated" ON public.job_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_scores_job ON public.candidate_scores (job_id, score DESC);
CREATE INDEX idx_candidates_status ON public.candidates (status);
