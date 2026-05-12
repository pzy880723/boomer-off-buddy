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
      japan_parcels: {
        Row: {
          account_id: string | null
          category: string | null
          completeness: number
          created_at: string
          domestic_freight_jpy: number | null
          eta: string | null
          exchange_rate: number | null
          id: string
          intl_freight_jpy: number | null
          item_image_url: string | null
          item_title: string | null
          item_title_cn: string | null
          notes: string | null
          price_jpy: number | null
          purchased_at: string | null
          raw_payload: Json | null
          received_at: string | null
          seller: string | null
          service_fee_jpy: number | null
          source: string
          source_order_no: string | null
          status: string
          total_cny: number | null
          total_jpy: number | null
          tracking_no: string | null
          updated_at: string
          warehouse_location: string | null
          weight_g: number | null
        }
        Insert: {
          account_id?: string | null
          category?: string | null
          completeness?: number
          created_at?: string
          domestic_freight_jpy?: number | null
          eta?: string | null
          exchange_rate?: number | null
          id?: string
          intl_freight_jpy?: number | null
          item_image_url?: string | null
          item_title?: string | null
          item_title_cn?: string | null
          notes?: string | null
          price_jpy?: number | null
          purchased_at?: string | null
          raw_payload?: Json | null
          received_at?: string | null
          seller?: string | null
          service_fee_jpy?: number | null
          source?: string
          source_order_no?: string | null
          status?: string
          total_cny?: number | null
          total_jpy?: number | null
          tracking_no?: string | null
          updated_at?: string
          warehouse_location?: string | null
          weight_g?: number | null
        }
        Update: {
          account_id?: string | null
          category?: string | null
          completeness?: number
          created_at?: string
          domestic_freight_jpy?: number | null
          eta?: string | null
          exchange_rate?: number | null
          id?: string
          intl_freight_jpy?: number | null
          item_image_url?: string | null
          item_title?: string | null
          item_title_cn?: string | null
          notes?: string | null
          price_jpy?: number | null
          purchased_at?: string | null
          raw_payload?: Json | null
          received_at?: string | null
          seller?: string | null
          service_fee_jpy?: number | null
          source?: string
          source_order_no?: string | null
          status?: string
          total_cny?: number | null
          total_jpy?: number | null
          tracking_no?: string | null
          updated_at?: string
          warehouse_location?: string | null
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "japan_parcels_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "meruki_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meruki_accounts: {
        Row: {
          cookie_expires_at: string | null
          created_at: string
          display_name: string | null
          id: string
          last_error: string | null
          last_login_at: string | null
          last_login_status: string | null
          password_encrypted: string
          session_cookie: string | null
          updated_at: string
          username: string
        }
        Insert: {
          cookie_expires_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_error?: string | null
          last_login_at?: string | null
          last_login_status?: string | null
          password_encrypted: string
          session_cookie?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          cookie_expires_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_error?: string | null
          last_login_at?: string | null
          last_login_status?: string | null
          password_encrypted?: string
          session_cookie?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      meruki_sync_runs: {
        Row: {
          account_id: string | null
          fetched_count: number
          finished_at: string | null
          id: string
          inserted_count: number
          message: string | null
          started_at: string
          status: string
          updated_count: number
        }
        Insert: {
          account_id?: string | null
          fetched_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          message?: string | null
          started_at?: string
          status?: string
          updated_count?: number
        }
        Update: {
          account_id?: string | null
          fetched_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          message?: string | null
          started_at?: string
          status?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "meruki_sync_runs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "meruki_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
