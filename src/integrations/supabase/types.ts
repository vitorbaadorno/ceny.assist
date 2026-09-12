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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      candidate_scores: {
        Row: {
          candidate_id: string
          created_at: string
          detalhes_matching: Json
          id: string
          job_id: string
          score: number
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          detalhes_matching?: Json
          id?: string
          job_id: string
          score?: number
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          detalhes_matching?: Json
          id?: string
          job_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_scores_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_scores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          anos_experiencia: number | null
          arquivo_nome: string | null
          arquivo_original_path: string | null
          created_at: string
          created_by: string | null
          dados_extraidos: Json
          data_nascimento: string | null
          email: string | null
          excluido: boolean
          excluido_em: string | null
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
          created_at?: string
          created_by?: string | null
          dados_extraidos?: Json
          data_nascimento?: string | null
          email?: string | null
          excluido?: boolean
          excluido_em?: string | null
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
          created_at?: string
          created_by?: string | null
          dados_extraidos?: Json
          data_nascimento?: string | null
          email?: string | null
          excluido?: boolean
          excluido_em?: string | null
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
        Relationships: []
      }
      job_reports: {
        Row: {
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
            foreignKeyName: "job_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          descricao: string | null
          excluido: boolean
          excluido_em: string | null
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
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          excluido?: boolean
          excluido_em?: string | null
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
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          excluido?: boolean
          excluido_em?: string | null
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
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
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
      archive_candidate: { Args: { p_id: string }; Returns: boolean }
      archive_job: { Args: { p_id: string }; Returns: boolean }
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
