export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      candidate_scores: {
        Row: {
          candidate_id: string
          company_id: string
          created_at: string
          detalhes_matching: Json
          id: string
          job_id: string
          score: number
          updated_at: string
        }
        Insert: {
          candidate_id: string
          company_id: string
          created_at?: string
          detalhes_matching?: Json
          id?: string
          job_id: string
          score: number
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          company_id?: string
          created_at?: string
          detalhes_matching?: Json
          id?: string
          job_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_scores_company_id_candidate_id_fkey"
            columns: ["company_id", "candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "candidate_scores_company_id_job_id_fkey"
            columns: ["company_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      candidates: {
        Row: {
          anos_experiencia: number | null
          arquivo_nome: string | null
          arquivo_original_path: string | null
          company_id: string
          created_at: string
          created_by: string | null
          dados_extraidos: Json
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          excluido: boolean
          id: string
          localizacao: string | null
          nome: string | null
          observacoes: string | null
          processing_error: string | null
          processing_status: string
          skills: string[]
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          anos_experiencia?: number | null
          arquivo_nome?: string | null
          arquivo_original_path?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          dados_extraidos?: Json
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          excluido?: boolean
          id?: string
          localizacao?: string | null
          nome?: string | null
          observacoes?: string | null
          processing_error?: string | null
          processing_status?: string
          skills?: string[]
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          anos_experiencia?: number | null
          arquivo_nome?: string | null
          arquivo_original_path?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          dados_extraidos?: Json
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          excluido?: boolean
          id?: string
          localizacao?: string | null
          nome?: string | null
          observacoes?: string | null
          processing_error?: string | null
          processing_status?: string
          skills?: string[]
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      company_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          revoked_at: string | null
          role: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          role: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_reports: {
        Row: {
          company_id: string
          conteudo: Json
          created_at: string
          created_by: string | null
          enviado_em: string | null
          enviado_para: string | null
          id: string
          job_id: string
          pdf_path: string | null
          resumo: string | null
        }
        Insert: {
          company_id: string
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          enviado_para?: string | null
          id?: string
          job_id: string
          pdf_path?: string | null
          resumo?: string | null
        }
        Update: {
          company_id?: string
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          enviado_para?: string | null
          id?: string
          job_id?: string
          pdf_path?: string | null
          resumo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_reports_company_id_job_id_fkey"
            columns: ["company_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      jobs: {
        Row: {
          categoria: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          excluido: boolean
          experiencia_minima: number
          formacao_exigida: string | null
          id: string
          localizacao: string | null
          requisitos_desejaveis: string[]
          requisitos_obrigatorios: string[]
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          excluido?: boolean
          experiencia_minima?: number
          formacao_exigida?: string | null
          id?: string
          localizacao?: string | null
          requisitos_desejaveis?: string[]
          requisitos_obrigatorios?: string[]
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          excluido?: boolean
          experiencia_minima?: number
          formacao_exigida?: string | null
          id?: string
          localizacao?: string | null
          requisitos_desejaveis?: string[]
          requisitos_obrigatorios?: string[]
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_company_invitation: { Args: { p_id: string }; Returns: string }
      archive_candidate: {
        Args: { p_company: string; p_id: string }
        Returns: undefined
      }
      archive_job: {
        Args: { p_company: string; p_id: string }
        Returns: undefined
      }
      configure_company_recovery: {
        Args: { p_company: string; p_email: string }
        Returns: string
      }
      create_company:
        | { Args: { p_name: string }; Returns: string }
        | { Args: { p_name: string; p_responsible: string }; Returns: string }
      invite_company_member: {
        Args: { p_company: string; p_email: string; p_role: string }
        Returns: string
      }
      manage_company_member: {
        Args: { p_company: string; p_role: string | null; p_user: string }
        Returns: undefined
      }
      my_company_invitations: {
        Args: never
        Returns: {
          company_name: string
          expires_at: string
          id: string
          role: string
        }[]
      }
      recover_company_access: { Args: { p_code: string }; Returns: string }
      replace_job_scores: {
        Args: {
          p_actor: string
          p_company: string
          p_job: string
          p_scores: Json
        }
        Returns: undefined
      }
      revoke_company_invitation: { Args: { p_id: string }; Returns: undefined }
      save_candidate_extraction: {
        Args: {
          p_actor: string
          p_company: string
          p_error?: string
          p_extraction: Json
          p_id: string
          p_status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
