export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      privacy_events: {
        Row: {
          action: string;
          actor_id: string | null;
          company_id: string;
          created_at: string;
          id: string;
          subject_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          subject_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "privacy_events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      privacy_requests: {
        Row: {
          candidate_id: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          due_at: string;
          id: string;
          identity_reference: string | null;
          kind: string;
          reference: string;
          resolution: string | null;
          state: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          candidate_id: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          due_at: string;
          id?: string;
          identity_reference?: string | null;
          kind: string;
          reference: string;
          resolution?: string | null;
          state?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          due_at?: string;
          id?: string;
          identity_reference?: string | null;
          kind?: string;
          reference?: string;
          resolution?: string | null;
          state?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "privacy_requests_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      privacy_retention_holds: {
        Row: {
          candidate_id: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          reason: string;
          release_reason: string | null;
          released_at: string | null;
          released_by: string | null;
          review_at: string;
        };
        Insert: {
          candidate_id: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          reason: string;
          release_reason?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          review_at: string;
        };
        Update: {
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          reason?: string;
          release_reason?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          review_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "privacy_retention_holds_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      privacy_erasure_operations: {
        Row: {
          attempts: number;
          available_at: string;
          candidate_ids: string[];
          company_id: string;
          completed_at: string | null;
          created_at: string;
          database_purged_at: string | null;
          id: string;
          last_error: string | null;
          lease_token: string | null;
          lease_until: string | null;
          reason: string;
          request_id: string;
          requested_by: string | null;
          state: string;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          candidate_ids: string[];
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          database_purged_at?: string | null;
          id?: string;
          last_error?: string | null;
          lease_token?: string | null;
          lease_until?: string | null;
          reason: string;
          request_id: string;
          requested_by?: string | null;
          state?: string;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          candidate_ids?: string[];
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          database_purged_at?: string | null;
          id?: string;
          last_error?: string | null;
          lease_token?: string | null;
          lease_until?: string | null;
          reason?: string;
          request_id?: string;
          requested_by?: string | null;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "privacy_erasure_operations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      vacancy_reports: {
        Row: {
          actor_name: string | null;
          candidate_ids: string[];
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          include_names: boolean;
          include_notes: boolean;
          job_id: string;
          payload: Json;
          request_id: string;
          run_id: string;
        };
        Insert: {
          actor_name?: string | null;
          candidate_ids: string[];
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          include_names?: boolean;
          include_notes?: boolean;
          job_id: string;
          payload: Json;
          request_id: string;
          run_id: string;
        };
        Update: {
          actor_name?: string | null;
          candidate_ids?: string[];
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          include_names?: boolean;
          include_notes?: boolean;
          job_id?: string;
          payload?: Json;
          request_id?: string;
          run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacancy_reports_company_id_job_id_fkey";
            columns: ["company_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "vacancy_reports_company_id_run_id_fkey";
            columns: ["company_id", "run_id"];
            isOneToOne: false;
            referencedRelation: "ranking_runs";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      vacancy_report_events: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name: string | null;
          company_id: string;
          created_at: string;
          id: string;
          report_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_name?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          report_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          report_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacancy_report_events_company_id_report_id_fkey";
            columns: ["company_id", "report_id"];
            isOneToOne: false;
            referencedRelation: "vacancy_reports";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };

      apprentice_case_reviews: {
        Row: {
          actor_id: string | null;
          actor_name: string | null;
          candidate_id: string;
          candidate_version: number;
          company_id: string;
          created_at: string;
          id: string;
          job_version: number;
          justification: string;
          legal_reference: string | null;
          legal_responsible: string | null;
          reference_date: string;
          request_id: string;
          review_version: number;
          run_id: string;
          status: string;
          version: number;
        };
        Insert: {
          actor_id?: string | null;
          actor_name?: string | null;
          candidate_id: string;
          candidate_version: number;
          company_id: string;
          created_at?: string;
          id?: string;
          job_version: number;
          justification: string;
          legal_reference?: string | null;
          legal_responsible?: string | null;
          reference_date: string;
          request_id: string;
          review_version: number;
          run_id: string;
          status: string;
          version: number;
        };
        Update: {
          actor_id?: string | null;
          actor_name?: string | null;
          candidate_id?: string;
          candidate_version?: number;
          company_id?: string;
          created_at?: string;
          id?: string;
          job_version?: number;
          justification?: string;
          legal_reference?: string | null;
          legal_responsible?: string | null;
          reference_date?: string;
          request_id?: string;
          review_version?: number;
          run_id?: string;
          status?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "apprentice_case_reviews_company_id_run_id_fkey";
            columns: ["company_id", "run_id"];
            isOneToOne: false;
            referencedRelation: "ranking_runs";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "apprentice_case_reviews_run_id_candidate_id_fkey";
            columns: ["run_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "ranking_entries";
            referencedColumns: ["run_id", "candidate_id"];
          },
        ];
      };
      candidate_decision_events: {
        Row: {
          actor_id: string | null;
          actor_name: string | null;
          after_selected: boolean;
          after_status: string;
          before_selected: boolean;
          before_status: string;
          candidate_id: string;
          company_id: string;
          created_at: string;
          id: string;
          job_id: string;
          reason: string;
          request_id: string;
          version: number;
        };
        Insert: {
          actor_id?: string | null;
          actor_name?: string | null;
          after_selected: boolean;
          after_status: string;
          before_selected: boolean;
          before_status: string;
          candidate_id: string;
          company_id: string;
          created_at?: string;
          id?: string;
          job_id: string;
          reason: string;
          request_id: string;
          version: number;
        };
        Update: {
          actor_id?: string | null;
          actor_name?: string | null;
          after_selected?: boolean;
          after_status?: string;
          before_selected?: boolean;
          before_status?: string;
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          job_id?: string;
          reason?: string;
          request_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_decision_events_company_id_candidate_id_job_id_fkey";
            columns: ["company_id", "candidate_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "candidate_job_links";
            referencedColumns: ["company_id", "candidate_id", "job_id"];
          },
        ];
      };
      candidate_document_events: {
        Row: {
          action: string;
          actor_id: string | null;
          candidate_id: string;
          company_id: string;
          created_at: string;
          document_id: string;
          id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          candidate_id: string;
          company_id: string;
          created_at?: string;
          document_id: string;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          document_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_document_events_company_id_candidate_id_fkey";
            columns: ["company_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "candidate_document_events_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "resume_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_favorites: {
        Row: {
          candidate_id: string;
          company_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          candidate_id: string;
          company_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_favorites_company_id_candidate_id_fkey";
            columns: ["company_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      candidate_job_links: {
        Row: {
          active: boolean;
          candidate_id: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          decision_status: string;
          decision_version: number;
          job_id: string;
          shortlisted: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          active?: boolean;
          candidate_id: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          decision_status?: string;
          decision_version?: number;
          job_id: string;
          shortlisted?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          active?: boolean;
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          decision_status?: string;
          decision_version?: number;
          job_id?: string;
          shortlisted?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_job_links_company_id_candidate_id_fkey";
            columns: ["company_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "candidate_job_links_company_id_job_id_fkey";
            columns: ["company_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      candidate_link_events: {
        Row: {
          active: boolean;
          actor_id: string | null;
          candidate_id: string;
          company_id: string;
          created_at: string;
          id: string;
          job_id: string;
        };
        Insert: {
          active: boolean;
          actor_id?: string | null;
          candidate_id: string;
          company_id: string;
          created_at?: string;
          id?: string;
          job_id: string;
        };
        Update: {
          active?: boolean;
          actor_id?: string | null;
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          job_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_link_events_company_id_candidate_id_job_id_fkey";
            columns: ["company_id", "candidate_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "candidate_job_links";
            referencedColumns: ["company_id", "candidate_id", "job_id"];
          },
        ];
      };
      candidate_merges: {
        Row: {
          actor_id: string | null;
          company_id: string;
          created_at: string;
          id: string;
          reason: string;
          source_id: string;
          source_relationships: Json;
          source_revisions: Json;
          source_snapshot: Json;
          target_id: string;
          target_snapshot: Json;
        };
        Insert: {
          actor_id?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          reason: string;
          source_id: string;
          source_relationships?: Json;
          source_revisions: Json;
          source_snapshot: Json;
          target_id: string;
          target_snapshot: Json;
        };
        Update: {
          actor_id?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          reason?: string;
          source_id?: string;
          source_relationships?: Json;
          source_revisions?: Json;
          source_snapshot?: Json;
          target_id?: string;
          target_snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_merges_company_id_source_id_fkey";
            columns: ["company_id", "source_id"];
            isOneToOne: true;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "candidate_merges_company_id_target_id_fkey";
            columns: ["company_id", "target_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      candidate_notes: {
        Row: {
          actor_id: string | null;
          actor_name: string | null;
          body: string;
          candidate_id: string;
          company_id: string;
          created_at: string;
          id: string;
          job_id: string | null;
          request_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_name?: string | null;
          body: string;
          candidate_id: string;
          company_id: string;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          request_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_name?: string | null;
          body?: string;
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_notes_company_id_candidate_id_fkey";
            columns: ["company_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "candidate_notes_company_id_job_id_fkey";
            columns: ["company_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      candidate_revisions: {
        Row: {
          action: string;
          actor_id: string | null;
          source_document_id: string | null;
          actor_name: string | null;
          candidate_id: string;
          changes: Json;
          company_id: string;
          created_at: string;
          id: string;
          version: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          source_document_id?: string | null;
          actor_name?: string | null;
          candidate_id: string;
          changes: Json;
          company_id: string;
          created_at?: string;
          id?: string;
          version: number;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          source_document_id?: string | null;
          actor_name?: string | null;
          candidate_id?: string;
          changes?: Json;
          company_id?: string;
          created_at?: string;
          id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_revisions_company_id_candidate_id_fkey";
            columns: ["company_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      candidate_scores: {
        Row: {
          candidate_id: string;
          candidate_version: number | null;
          company_id: string;
          created_at: string;
          criteria_hash: string | null;
          detalhes_matching: Json;
          id: string;
          job_id: string;
          job_version: number | null;
          review_version: number | null;
          run_id: string | null;
          score: number;
          stale: boolean;
          updated_at: string;
        };
        Insert: {
          candidate_id: string;
          candidate_version?: number | null;
          company_id: string;
          created_at?: string;
          criteria_hash?: string | null;
          detalhes_matching?: Json;
          id?: string;
          job_id: string;
          job_version?: number | null;
          review_version?: number | null;
          run_id?: string | null;
          score: number;
          stale?: boolean;
          updated_at?: string;
        };
        Update: {
          candidate_id?: string;
          candidate_version?: number | null;
          company_id?: string;
          created_at?: string;
          criteria_hash?: string | null;
          detalhes_matching?: Json;
          id?: string;
          job_id?: string;
          job_version?: number | null;
          review_version?: number | null;
          run_id?: string | null;
          score?: number;
          stale?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_scores_company_id_candidate_id_fkey";
            columns: ["company_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "candidate_scores_company_id_job_id_fkey";
            columns: ["company_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "candidate_scores_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "ranking_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      candidates: {
        Row: {
          active_document_id: string | null;
          anos_experiencia: number | null;
          arquivo_nome: string | null;
          arquivo_original_path: string | null;
          company_id: string;
          correcoes_rh: Json;
          created_at: string;
          created_by: string | null;
          dados_efetivos: Json;
          dados_extraidos: Json;
          data_nascimento: string | null;
          data_version: number;
          deleted_at: string | null;
          email: string | null;
          excluido: boolean;
          id: string;
          localizacao: string | null;
          merged_into_id: string | null;
          nome: string | null;
          observacoes: string | null;
          processing_error: string | null;
          processing_status: string;
          review_status: string;
          review_version: number;
          reviewed_at: string | null;
          reviewed_by: string | null;
          skills: string[];
          status: string;
          telefone: string | null;
          updated_at: string;
        };
        Insert: {
          active_document_id?: string | null;
          anos_experiencia?: number | null;
          arquivo_nome?: string | null;
          arquivo_original_path?: string | null;
          company_id: string;
          correcoes_rh?: Json;
          created_at?: string;
          created_by?: string | null;
          dados_efetivos?: Json;
          dados_extraidos?: Json;
          data_nascimento?: string | null;
          data_version?: number;
          deleted_at?: string | null;
          email?: string | null;
          excluido?: boolean;
          id?: string;
          localizacao?: string | null;
          merged_into_id?: string | null;
          nome?: string | null;
          observacoes?: string | null;
          processing_error?: string | null;
          processing_status?: string;
          review_status?: string;
          review_version?: number;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          skills?: string[];
          status?: string;
          telefone?: string | null;
          updated_at?: string;
        };
        Update: {
          active_document_id?: string | null;
          anos_experiencia?: number | null;
          arquivo_nome?: string | null;
          arquivo_original_path?: string | null;
          company_id?: string;
          correcoes_rh?: Json;
          created_at?: string;
          created_by?: string | null;
          dados_efetivos?: Json;
          dados_extraidos?: Json;
          data_nascimento?: string | null;
          data_version?: number;
          deleted_at?: string | null;
          email?: string | null;
          excluido?: boolean;
          id?: string;
          localizacao?: string | null;
          merged_into_id?: string | null;
          nome?: string | null;
          observacoes?: string | null;
          processing_error?: string | null;
          processing_status?: string;
          review_status?: string;
          review_version?: number;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          skills?: string[];
          status?: string;
          telefone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_active_document";
            columns: ["company_id", "active_document_id", "id"];
            isOneToOne: false;
            referencedRelation: "resume_documents";
            referencedColumns: ["company_id", "id", "candidate_id"];
          },
          {
            foreignKeyName: "candidate_merge_company";
            columns: ["company_id", "merged_into_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "candidates_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      company_invitations: {
        Row: {
          accepted_at: string | null;
          company_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          revoked_at: string | null;
          role: string;
        };
        Insert: {
          accepted_at?: string | null;
          company_id: string;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          revoked_at?: string | null;
          role: string;
        };
        Update: {
          accepted_at?: string | null;
          company_id?: string;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          revoked_at?: string | null;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_invitations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      job_reports: {
        Row: {
          company_id: string;
          conteudo: Json;
          created_at: string;
          created_by: string | null;
          enviado_em: string | null;
          enviado_para: string | null;
          id: string;
          job_id: string;
          pdf_path: string | null;
          resumo: string | null;
          stale: boolean;
        };
        Insert: {
          company_id: string;
          conteudo?: Json;
          created_at?: string;
          created_by?: string | null;
          enviado_em?: string | null;
          enviado_para?: string | null;
          id?: string;
          job_id: string;
          pdf_path?: string | null;
          resumo?: string | null;
          stale?: boolean;
        };
        Update: {
          company_id?: string;
          conteudo?: Json;
          created_at?: string;
          created_by?: string | null;
          enviado_em?: string | null;
          enviado_para?: string | null;
          id?: string;
          job_id?: string;
          pdf_path?: string | null;
          resumo?: string | null;
          stale?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "job_reports_company_id_job_id_fkey";
            columns: ["company_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      job_revisions: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name: string | null;
          after_data: Json;
          before_data: Json | null;
          company_id: string;
          created_at: string;
          id: string;
          job_id: string;
          version: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_name?: string | null;
          after_data: Json;
          before_data?: Json | null;
          company_id: string;
          created_at?: string;
          id?: string;
          job_id: string;
          version: number;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          after_data?: Json;
          before_data?: Json | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          job_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "job_revisions_company_id_job_id_fkey";
            columns: ["company_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      job_templates: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          payload: Json;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          payload: Json;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "job_templates_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          approved_hash: string | null;
          categoria: string;
          company_id: string;
          created_at: string;
          created_by: string | null;
          criteria: Json;
          deleted_at: string | null;
          descricao: string | null;
          excluido: boolean;
          experiencia_minima: number;
          formacao_exigida: string | null;
          id: string;
          localizacao: string | null;
          requisitos_desejaveis: string[];
          requisitos_obrigatorios: string[];
          status: string;
          titulo: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          approved_hash?: string | null;
          categoria?: string;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          criteria?: Json;
          deleted_at?: string | null;
          descricao?: string | null;
          excluido?: boolean;
          experiencia_minima?: number;
          formacao_exigida?: string | null;
          id?: string;
          localizacao?: string | null;
          requisitos_desejaveis?: string[];
          requisitos_obrigatorios?: string[];
          status?: string;
          titulo: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          approved_hash?: string | null;
          categoria?: string;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          criteria?: Json;
          deleted_at?: string | null;
          descricao?: string | null;
          excluido?: boolean;
          experiencia_minima?: number;
          formacao_exigida?: string | null;
          id?: string;
          localizacao?: string | null;
          requisitos_desejaveis?: string[];
          requisitos_obrigatorios?: string[];
          status?: string;
          titulo?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      ranking_entries: {
        Row: {
          candidate_id: string;
          company_id: string;
          details: Json | null;
          documents: Json;
          reason: string | null;
          run_id: string;
          score: number | null;
          snapshot: Json;
        };
        Insert: {
          candidate_id: string;
          company_id: string;
          details?: Json | null;
          documents: Json;
          reason?: string | null;
          run_id: string;
          score?: number | null;
          snapshot: Json;
        };
        Update: {
          candidate_id?: string;
          company_id?: string;
          details?: Json | null;
          documents?: Json;
          reason?: string | null;
          run_id?: string;
          score?: number | null;
          snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "ranking_entries_company_id_candidate_id_fkey";
            columns: ["company_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "ranking_entries_company_id_run_id_fkey";
            columns: ["company_id", "run_id"];
            isOneToOne: false;
            referencedRelation: "ranking_runs";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      ranking_runs: {
        Row: {
          actor_id: string | null;
          company_id: string;
          completed_at: string | null;
          created_at: string;
          eligible: number;
          expires_at: string;
          formula: string;
          id: string;
          job_id: string;
          job_snapshot: Json;
          request_id: string;
          stale: boolean;
          status: string;
          total: number;
        };
        Insert: {
          actor_id?: string | null;
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          eligible?: number;
          expires_at?: string;
          formula?: string;
          id?: string;
          job_id: string;
          job_snapshot: Json;
          request_id: string;
          stale?: boolean;
          status?: string;
          total?: number;
        };
        Update: {
          actor_id?: string | null;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          eligible?: number;
          expires_at?: string;
          formula?: string;
          id?: string;
          job_id?: string;
          job_snapshot?: Json;
          request_id?: string;
          stale?: boolean;
          status?: string;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ranking_runs_company_id_job_id_fkey";
            columns: ["company_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      resume_batch_entries: {
        Row: {
          batch_id: string;
          filename: string;
          message: string | null;
          slot: number;
          state: string;
          updated_at: string;
        };
        Insert: {
          batch_id: string;
          filename: string;
          message?: string | null;
          slot: number;
          state?: string;
          updated_at?: string;
        };
        Update: {
          batch_id?: string;
          filename?: string;
          message?: string | null;
          slot?: number;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resume_batch_entries_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "resume_batches";
            referencedColumns: ["id"];
          },
        ];
      };
      resume_batch_items: {
        Row: {
          batch_id: string;
          document_id: string;
          slot: number;
        };
        Insert: {
          batch_id: string;
          document_id: string;
          slot: number;
        };
        Update: {
          batch_id?: string;
          document_id?: string;
          slot?: number;
        };
        Relationships: [
          {
            foreignKeyName: "resume_batch_items_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "resume_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resume_batch_items_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "resume_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      resume_batches: {
        Row: {
          company_id: string;
          created_at: string;
          file_count: number;
          id: string;
          source: string;
          uploaded_by: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          file_count: number;
          id?: string;
          source: string;
          uploaded_by?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          file_count?: number;
          id?: string;
          source?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "resume_batches_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      resume_documents: {
        Row: {
          ai_started_at: string | null;
          byte_size: number;
          candidate_id: string;
          company_id: string;
          created_at: string;
          error_message: string | null;
          filename: string;
          finished_at: string | null;
          id: string;
          latest_extraction: Json;
          mime_type: string;
          object_path: string;
          operation_token: string;
          page_count: number;
          sha256: string;
          source: string;
          state: string;
          stored_at: string | null;
          updated_at: string;
          uploaded_by: string | null;
          version: number;
        };
        Insert: {
          ai_started_at?: string | null;
          byte_size: number;
          candidate_id: string;
          company_id: string;
          created_at?: string;
          error_message?: string | null;
          filename: string;
          finished_at?: string | null;
          id?: string;
          latest_extraction?: Json;
          mime_type: string;
          object_path: string;
          operation_token?: string;
          page_count: number;
          sha256: string;
          source: string;
          state?: string;
          stored_at?: string | null;
          updated_at?: string;
          uploaded_by?: string | null;
          version: number;
        };
        Update: {
          ai_started_at?: string | null;
          byte_size?: number;
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          error_message?: string | null;
          filename?: string;
          finished_at?: string | null;
          id?: string;
          latest_extraction?: Json;
          mime_type?: string;
          object_path?: string;
          operation_token?: string;
          page_count?: number;
          sha256?: string;
          source?: string;
          state?: string;
          stored_at?: string | null;
          updated_at?: string;
          uploaded_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "resume_documents_company_id_candidate_id_fkey";
            columns: ["company_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      resume_job_attempts: {
        Row: {
          attempt: number;
          duration_ms: number | null;
          error_kind: string | null;
          extraction: Json | null;
          finished_at: string | null;
          input_tokens: number | null;
          job_id: string;
          message: string | null;
          model_reported: string | null;
          model_requested: string | null;
          outcome: string;
          output_tokens: number | null;
          prompt_hash: string | null;
          prompt_snapshot: string | null;
          prompt_version: string | null;
          response_id: string | null;
          started_at: string;
          total_tokens: number | null;
        };
        Insert: {
          attempt: number;
          duration_ms?: number | null;
          error_kind?: string | null;
          extraction?: Json | null;
          finished_at?: string | null;
          input_tokens?: number | null;
          job_id: string;
          message?: string | null;
          model_reported?: string | null;
          model_requested?: string | null;
          outcome?: string;
          output_tokens?: number | null;
          prompt_hash?: string | null;
          prompt_snapshot?: string | null;
          prompt_version?: string | null;
          response_id?: string | null;
          started_at?: string;
          total_tokens?: number | null;
        };
        Update: {
          attempt?: number;
          duration_ms?: number | null;
          error_kind?: string | null;
          extraction?: Json | null;
          finished_at?: string | null;
          input_tokens?: number | null;
          job_id?: string;
          message?: string | null;
          model_reported?: string | null;
          model_requested?: string | null;
          outcome?: string;
          output_tokens?: number | null;
          prompt_hash?: string | null;
          prompt_snapshot?: string | null;
          prompt_version?: string | null;
          response_id?: string | null;
          started_at?: string;
          total_tokens?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "resume_job_attempts_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "resume_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      resume_jobs: {
        Row: {
          attempts: number;
          available_at: string;
          candidate_id: string;
          company_id: string;
          created_at: string;
          document_id: string;
          error_kind: string | null;
          finished_at: string | null;
          generation: number;
          id: string;
          lease_token: string | null;
          lease_until: string | null;
          message: string | null;
          phase: string;
          request_id: string;
          requested_by: string | null;
          started_at: string | null;
          state: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          candidate_id: string;
          company_id: string;
          created_at?: string;
          document_id: string;
          error_kind?: string | null;
          finished_at?: string | null;
          generation: number;
          id?: string;
          lease_token?: string | null;
          lease_until?: string | null;
          message?: string | null;
          phase?: string;
          request_id: string;
          requested_by?: string | null;
          started_at?: string | null;
          state?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          candidate_id?: string;
          company_id?: string;
          created_at?: string;
          document_id?: string;
          error_kind?: string | null;
          finished_at?: string | null;
          generation?: number;
          id?: string;
          lease_token?: string | null;
          lease_until?: string | null;
          message?: string | null;
          phase?: string;
          request_id?: string;
          requested_by?: string | null;
          started_at?: string | null;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resume_jobs_company_id_candidate_id_fkey";
            columns: ["company_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "resume_jobs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resume_jobs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "resume_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resume_jobs_document_identity";
            columns: ["company_id", "document_id", "candidate_id"];
            isOneToOne: false;
            referencedRelation: "resume_documents";
            referencedColumns: ["company_id", "id", "candidate_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      request_vacancy_analysis: {
        Args: { p_company: string; p_candidate: string; p_job: string; p_request: string };
        Returns: string;
      };
      admit_ai_request: { Args: { p_company: string }; Returns: boolean };
      batch_current_jobs: {
        Args: { p_company: string; p_documents: string[] };
        Returns: {
          id: string;
          document_id: string;
          candidate_id: string;
          state: string;
          phase: string;
          generation: number;
          attempts: number;
          available_at: string;
          message: string | null;
          created_at: string;
        }[];
      };
      browse_job_cards: {
        Args: { p_company: string; p_filters?: Json; p_page?: number };
        Returns: Json;
      };
      ops_control_queue: {
        Args: {
          p_company: string;
          p_request: string;
          p_job: string | null;
          p_batch: string | null;
          p_action: string;
        };
        Returns: Json;
      };
      ops_dashboard: {
        Args: { p_company: string; p_month: string; p_page: number };
        Returns: Json;
      };
      ops_history: { Args: { p_company: string; p_kind: string; p_page: number }; Returns: Json };
      ops_quota_status: { Args: { p_company: string }; Returns: Json };
      ops_configure: {
        Args: {
          p_company: string;
          p_version: number;
          p_upload: number | null;
          p_analysis: number | null;
          p_warn: number;
          p_activity_days: number;
          p_error_days: number;
        };
        Returns: number;
      };
      ops_reconcile: {
        Args: {
          p_company: string;
          p_month: string;
          p_job: string | null;
          p_attempt: number | null;
          p_usd: number;
        };
        Returns: undefined;
      };
      ops_report_error: {
        Args: { p_company: string; p_operation: string; p_action: string; p_code: string };
        Returns: undefined;
      };
      reconcile_privacy_restore_objects: {
        Args: { p_company: string; p_erased: string[]; p_objects: string[] };
        Returns: string;
      };
      export_privacy_ledger: { Args: never; Returns: Json };
      reconcile_privacy_restore: {
        Args: { p_company: string; p_erased: string[] };
        Returns: string;
      };
      privacy_candidates: {
        Args: { p_company: string; p_offset?: number };
        Returns: {
          archived: boolean;
          created_at: string;
          id: string;
          label: string;
        }[];
      };
      export_privacy_subject: {
        Args: { p_company: string; p_request: string };
        Returns: Json;
      };
      save_privacy_request: {
        Args: {
          p_candidate: string;
          p_company: string;
          p_due_at: string;
          p_id?: string;
          p_identity?: string;
          p_kind: string;
          p_reference: string;
          p_resolution?: string;
          p_state?: string;
          p_version?: number;
        };
        Returns: string;
      };
      set_privacy_hold: {
        Args: {
          p_candidate: string;
          p_company: string;
          p_reason: string;
          p_release?: string;
          p_review_at: string;
        };
        Returns: string;
      };
      retry_privacy_erasure: {
        Args: { p_company: string; p_operation: string };
        Returns: undefined;
      };
      request_candidate_erasure: {
        Args: {
          p_candidate: string;
          p_company: string;
          p_confirmed_ids: string[];
          p_reason: string;
          p_request: string;
        };
        Returns: string;
      };
      preview_candidate_erasure: {
        Args: { p_candidate: string; p_company: string };
        Returns: Json;
      };
      finish_privacy_erasure: {
        Args: { p_operation: string; p_success: boolean; p_token: string };
        Returns: boolean;
      };
      claim_privacy_erasure: { Args: never; Returns: Json };
      generate_vacancy_report: {
        Args: {
          p_candidates: string[];
          p_company: string;
          p_job: string;
          p_names: boolean;
          p_notes: boolean;
          p_request: string;
          p_run: string;
        };
        Returns: string;
      };
      access_vacancy_report: {
        Args: { p_action: string; p_company: string; p_report: string };
        Returns: Json;
      };

      accept_company_invitation: { Args: { p_id: string }; Returns: string };
      add_candidate_note: {
        Args: {
          p_body: string;
          p_candidate: string;
          p_company: string;
          p_job: string | null;
          p_request: string;
        };
        Returns: string;
      };
      advance_resume_job: {
        Args: { p_job: string; p_phase: string; p_token: string };
        Returns: boolean;
      };
      archive_candidate: {
        Args: { p_company: string; p_id: string };
        Returns: undefined;
      };
      archive_job: {
        Args: { p_company: string; p_id: string };
        Returns: undefined;
      };
      begin_ranking: {
        Args: {
          p_actor: string;
          p_company: string;
          p_job: string;
          p_request: string;
        };
        Returns: Json;
      };
      begin_resume_batch: {
        Args: { p_company: string; p_count: number; p_source: string };
        Returns: string;
      };
      begin_resume_batch_files: {
        Args: { p_company: string; p_files: Json; p_source: string };
        Returns: string;
      };
      browse_candidates: {
        Args: { p_company: string; p_filters?: Json; p_page?: number };
        Returns: Json;
      };
      browse_jobs: {
        Args: { p_company: string; p_filters?: Json; p_page?: number };
        Returns: Json;
      };
      browse_ranking: {
        Args: {
          p_company: string;
          p_filters?: Json;
          p_page?: number;
          p_run: string;
        };
        Returns: Json;
      };
      claim_resume_cleanup: {
        Args: { p_actor: string; p_company: string };
        Returns: {
          document_id: string;
          object_path: string;
        }[];
      };
      claim_resume_extraction: {
        Args: { p_actor: string; p_candidate: string; p_company: string };
        Returns: Json;
      };
      claim_resume_jobs: {
        Args: never;
        Returns: {
          attempts: number;
          available_at: string;
          candidate_id: string;
          company_id: string;
          created_at: string;
          document_id: string;
          error_kind: string | null;
          finished_at: string | null;
          generation: number;
          id: string;
          lease_token: string | null;
          lease_until: string | null;
          message: string | null;
          phase: string;
          request_id: string;
          requested_by: string | null;
          started_at: string | null;
          state: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "resume_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      compare_job_candidates: {
        Args: { p_candidates: string[]; p_company: string; p_job: string };
        Returns: Json;
      };
      configure_company_recovery: {
        Args: { p_company: string; p_email: string };
        Returns: string;
      };
      confirm_candidate_merge: {
        Args: {
          p_company: string;
          p_confirmed: boolean;
          p_reason: string;
          p_source: string;
          p_source_version: number;
          p_target: string;
          p_target_version: number;
        };
        Returns: string;
      };
      control_resume_batch: {
        Args: { p_action: string; p_batch: string; p_company: string };
        Returns: number;
      };
      control_resume_job: {
        Args: { p_action: string; p_company: string; p_job: string };
        Returns: string;
      };
      create_company:
        | { Args: { p_name: string }; Returns: string }
        | { Args: { p_name: string; p_responsible: string }; Returns: string };
      create_job_template: {
        Args: { p_company: string; p_name: string; p_payload: Json };
        Returns: string;
      };
      fail_ranking: {
        Args: { p_actor: string; p_run: string };
        Returns: undefined;
      };
      finish_ranking: {
        Args: { p_actor: string; p_run: string };
        Returns: Json;
      };
      finish_resume_cleanup: {
        Args: { p_company: string; p_document: string };
        Returns: undefined;
      };
      finish_resume_extraction: {
        Args: {
          p_actor: string;
          p_candidate: string;
          p_company: string;
          p_error?: string;
          p_extraction: Json;
          p_status: string;
          p_token: string;
        };
        Returns: undefined;
      };
      finish_resume_upload: {
        Args: {
          p_actor: string;
          p_company: string;
          p_document: string;
          p_error?: string;
          p_token: string;
        };
        Returns: undefined;
      };
      invite_company_member: {
        Args: { p_company: string; p_email: string; p_role: string };
        Returns: string;
      };
      manage_company_member: {
        Args: { p_company: string; p_role: string | null; p_user: string };
        Returns: undefined;
      };
      my_company_invitations: {
        Args: never;
        Returns: {
          company_name: string;
          expires_at: string;
          id: string;
          role: string;
        }[];
      };
      record_apprentice_review: {
        Args: {
          p_candidate: string;
          p_company: string;
          p_confirmed?: boolean;
          p_expected_version: number;
          p_justification: string;
          p_legal_reference?: string;
          p_legal_responsible?: string;
          p_request: string;
          p_run: string;
          p_status: string;
        };
        Returns: Json;
      };
      record_resume_analysis: {
        Args: { p_job: string; p_metadata: Json; p_token: string };
        Returns: boolean;
      };
      record_resume_entry: {
        Args: {
          p_actor: string;
          p_batch: string;
          p_company: string;
          p_filename: string;
          p_message?: string;
          p_slot: number;
          p_state: string;
        };
        Returns: undefined;
      };
      recover_company_access: { Args: { p_code: string }; Returns: string };
      reject_resume_entry: {
        Args: {
          p_batch: string;
          p_company: string;
          p_message: string;
          p_slot: number;
        };
        Returns: undefined;
      };
      replace_job_scores: {
        Args: {
          p_actor: string;
          p_company: string;
          p_job: string;
          p_scores: Json;
        };
        Returns: undefined;
      };
      replace_job_scores_v2: {
        Args: {
          p_actor: string;
          p_company: string;
          p_criteria_hash: string;
          p_job: string;
          p_job_version: number;
          p_scores: Json;
        };
        Returns: undefined;
      };
      request_document_analysis: {
        Args: { p_company: string; p_document: string; p_request: string };
        Returns: string;
      };
      request_resume_job: {
        Args: {
          p_candidate: string;
          p_company: string;
          p_mode: string;
          p_request: string;
        };
        Returns: string;
      };
      reserve_resume: {
        Args: {
          p_actor: string;
          p_batch: string;
          p_company: string;
          p_filename: string;
          p_mime: string;
          p_pages: number;
          p_sha: string;
          p_size: number;
          p_slot: number;
        };
        Returns: Json;
      };
      reserve_resume_validated: {
        Args: {
          p_actor: string;
          p_batch: string;
          p_company: string;
          p_filename: string;
          p_mime: string;
          p_pages: number;
          p_sha: string;
          p_size: number;
          p_slot: number;
        };
        Returns: Json;
      };
      reserve_resume_version: {
        Args: {
          p_actor: string;
          p_batch: string;
          p_candidate?: string;
          p_company: string;
          p_filename: string;
          p_mime: string;
          p_pages: number;
          p_sha: string;
          p_size: number;
          p_slot: number;
        };
        Returns: Json;
      };
      revoke_company_invitation: { Args: { p_id: string }; Returns: undefined };
      save_candidate_decision: {
        Args: {
          p_candidate: string;
          p_company: string;
          p_job: string;
          p_reason: string;
          p_request: string;
          p_selected: boolean;
          p_status: string;
          p_version: number;
        };
        Returns: Json;
      };
      save_candidate_extraction: {
        Args: {
          p_actor: string;
          p_company: string;
          p_error?: string;
          p_extraction: Json;
          p_id: string;
          p_status: string;
        };
        Returns: undefined;
      };
      save_candidate_review: {
        Args: {
          p_candidate: string;
          p_company: string;
          p_complete?: boolean;
          p_confirmed?: boolean;
          p_expected_version: number;
          p_patch: Json;
        };
        Returns: Json;
      };
      save_job: {
        Args: {
          p_approve?: boolean;
          p_company: string;
          p_expected_version: number;
          p_job: string | null;
          p_payload: Json;
        };
        Returns: Json;
      };
      search_candidates: {
        Args: {
          p_company: string;
          p_offset?: number;
          p_query?: string;
          p_status?: string;
        };
        Returns: {
          active_document_id: string | null;
          anos_experiencia: number | null;
          arquivo_nome: string | null;
          arquivo_original_path: string | null;
          company_id: string;
          correcoes_rh: Json;
          created_at: string;
          created_by: string | null;
          dados_efetivos: Json;
          dados_extraidos: Json;
          data_nascimento: string | null;
          data_version: number;
          deleted_at: string | null;
          email: string | null;
          excluido: boolean;
          id: string;
          localizacao: string | null;
          merged_into_id: string | null;
          nome: string | null;
          observacoes: string | null;
          processing_error: string | null;
          processing_status: string;
          review_status: string;
          review_version: number;
          reviewed_at: string | null;
          reviewed_by: string | null;
          skills: string[];
          status: string;
          telefone: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "candidates";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      select_candidate_document: {
        Args: {
          p_candidate: string;
          p_company: string;
          p_document: string;
          p_expected_version: number;
        };
        Returns: undefined;
      };
      set_candidate_favorite: {
        Args: { p_candidate: string; p_company: string; p_favorite: boolean };
        Returns: undefined;
      };
      set_candidate_job_link: {
        Args: {
          p_active: boolean;
          p_candidate: string;
          p_company: string;
          p_job: string;
        };
        Returns: undefined;
      };
      set_job_status: {
        Args: {
          p_company: string;
          p_expected_version: number;
          p_job: string;
          p_status: string;
        };
        Returns: Json;
      };
      settle_resume_job: {
        Args: {
          p_extraction?: Json;
          p_job: string;
          p_kind?: string;
          p_message?: string;
          p_outcome: string;
          p_token: string;
        };
        Returns: boolean;
      };
      stage_ranking: {
        Args: { p_actor: string; p_rows: Json; p_run: string };
        Returns: undefined;
      };
      suggest_candidate_duplicates: {
        Args: { p_candidate: string; p_company: string };
        Returns: {
          candidate_id: string;
          email: string;
          nome: string;
          reasons: string[];
          review_version: number;
          telefone: string;
        }[];
      };
      verify_resume_dispatch: { Args: { p_token: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
