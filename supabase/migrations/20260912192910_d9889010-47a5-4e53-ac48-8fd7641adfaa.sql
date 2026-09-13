DROP POLICY IF EXISTS candidates_update_active_authenticated ON public.candidates;
CREATE POLICY candidates_update_authenticated
ON public.candidates
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS jobs_update_active_authenticated ON public.jobs;
CREATE POLICY jobs_update_authenticated
ON public.jobs
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);