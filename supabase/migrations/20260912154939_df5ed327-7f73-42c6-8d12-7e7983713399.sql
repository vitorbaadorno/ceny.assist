
CREATE POLICY "resumes_select_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes');
CREATE POLICY "resumes_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "resumes_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'resumes') WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "resumes_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'resumes');
