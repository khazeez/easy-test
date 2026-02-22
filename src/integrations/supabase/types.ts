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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      k6_environments: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          updated_at: string
          values: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          updated_at?: string
          values?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "k6_environments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      k6_shared_reports: {
        Row: {
          created_at: string
          created_by: string
          id: string
          run_id: string
          share_token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          run_id: string
          share_token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          run_id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "k6_shared_reports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "k6_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      k6_swagger_files: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          name: string
          project_id: string
          swagger_data: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          name: string
          project_id: string
          swagger_data?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          name?: string
          project_id?: string
          swagger_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "k6_swagger_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      k6_test_configs: {
        Row: {
          created_at: string
          duration: string
          id: string
          name: string
          project_id: string
          script: string | null
          swagger_file_id: string | null
          thresholds: Json | null
          updated_at: string
          vus: number
        }
        Insert: {
          created_at?: string
          duration?: string
          id?: string
          name: string
          project_id: string
          script?: string | null
          swagger_file_id?: string | null
          thresholds?: Json | null
          updated_at?: string
          vus?: number
        }
        Update: {
          created_at?: string
          duration?: string
          id?: string
          name?: string
          project_id?: string
          script?: string | null
          swagger_file_id?: string | null
          thresholds?: Json | null
          updated_at?: string
          vus?: number
        }
        Relationships: [
          {
            foreignKeyName: "k6_test_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "k6_test_configs_swagger_file_id_fkey"
            columns: ["swagger_file_id"]
            isOneToOne: false
            referencedRelation: "k6_swagger_files"
            referencedColumns: ["id"]
          },
        ]
      }
      k6_test_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          environment_id: string | null
          id: string
          k6_cloud_test_id: string | null
          project_id: string
          result_data: Json | null
          started_at: string | null
          status: string
          test_config_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          environment_id?: string | null
          id?: string
          k6_cloud_test_id?: string | null
          project_id: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
          test_config_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          environment_id?: string | null
          id?: string
          k6_cloud_test_id?: string | null
          project_id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
          test_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "k6_test_runs_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "k6_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "k6_test_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "k6_test_runs_test_config_id_fkey"
            columns: ["test_config_id"]
            isOneToOne: false
            referencedRelation: "k6_test_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      newman_collection_files: {
        Row: {
          collection_id: string
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          project_id: string
          storage_path: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          project_id: string
          storage_path: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          project_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "newman_collection_files_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "newman_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newman_collection_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      newman_collections: {
        Row: {
          collection_data: Json | null
          created_at: string
          file_url: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          collection_data?: Json | null
          created_at?: string
          file_url?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          collection_data?: Json | null
          created_at?: string
          file_url?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newman_collections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      newman_environments: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          updated_at: string
          values: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          updated_at?: string
          values?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "newman_environments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      newman_shared_reports: {
        Row: {
          created_at: string
          created_by: string
          id: string
          run_id: string
          share_token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          run_id: string
          share_token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          run_id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "newman_shared_reports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "newman_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      newman_test_runs: {
        Row: {
          collection_id: string | null
          completed_at: string | null
          created_at: string
          environment_id: string | null
          folder_name: string | null
          id: string
          project_id: string
          result_data: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          collection_id?: string | null
          completed_at?: string | null
          created_at?: string
          environment_id?: string | null
          folder_name?: string | null
          id?: string
          project_id: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          collection_id?: string | null
          completed_at?: string | null
          created_at?: string
          environment_id?: string | null
          folder_name?: string | null
          id?: string
          project_id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "newman_test_runs_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "newman_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newman_test_runs_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "newman_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newman_test_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_report_bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          run_id: string
          runner_type: string
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          run_id: string
          runner_type: string
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          run_id?: string
          runner_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_report_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "shared_report_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_report_bundles: {
        Row: {
          created_at: string
          created_by: string
          id: string
          share_token: string
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          share_token?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          share_token?: string
          title?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_project_owner: { Args: { project_id_param: string }; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
