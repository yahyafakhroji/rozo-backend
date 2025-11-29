export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          merchant_id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          merchant_id: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          merchant_id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["merchant_id"]
          },
        ]
      }
      chains: {
        Row: {
          chain_id: string
          chain_type: string
          created_at: string
          explorer_url: string | null
          icon_url: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          chain_id: string
          chain_type: string
          created_at?: string
          explorer_url?: string | null
          icon_url?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          chain_id?: string
          chain_type?: string
          created_at?: string
          explorer_url?: string | null
          icon_url?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          created_at: string
          currency_id: string
          display_name: string
          updated_at: string
          usd_price: number
        }
        Insert: {
          created_at?: string
          currency_id: string
          display_name: string
          updated_at?: string
          usd_price: number
        }
        Update: {
          created_at?: string
          currency_id?: string
          display_name?: string
          updated_at?: string
          usd_price?: number
        }
        Relationships: []
      }
      deposits: {
        Row: {
          callback_payload: Json | null
          created_at: string
          deposit_id: string
          display_amount: number
          display_currency: string
          merchant_address: string
          merchant_chain_id: string
          merchant_id: string
          number: string | null
          payment_id: string
          required_amount_usd: number
          required_token: string
          source_chain_name: string | null
          source_token_address: string | null
          source_token_amount: number | null
          source_txn_hash: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string | null
        }
        Insert: {
          callback_payload?: Json | null
          created_at?: string
          deposit_id?: string
          display_amount: number
          display_currency: string
          merchant_address: string
          merchant_chain_id: string
          merchant_id: string
          number?: string | null
          payment_id: string
          required_amount_usd: number
          required_token: string
          source_chain_name?: string | null
          source_token_address?: string | null
          source_token_amount?: number | null
          source_txn_hash?: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Update: {
          callback_payload?: Json | null
          created_at?: string
          deposit_id?: string
          display_amount?: number
          display_currency?: string
          merchant_address?: string
          merchant_chain_id?: string
          merchant_id?: string
          number?: string | null
          payment_id?: string
          required_amount_usd?: number
          required_token?: string
          source_chain_name?: string | null
          source_token_address?: string | null
          source_token_amount?: number | null
          source_txn_hash?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposits_display_currency_fkey"
            columns: ["display_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["currency_id"]
          },
          {
            foreignKeyName: "deposits_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["merchant_id"]
          },
        ]
      }
      languages: {
        Row: {
          display_name: string
          language_id: string
        }
        Insert: {
          display_name: string
          language_id: string
        }
        Update: {
          display_name?: string
          language_id?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string | null
          device_id: string
          fcm_token: string
          id: string
          merchant_id: string
          platform: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          fcm_token: string
          id?: string
          merchant_id: string
          platform: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          fcm_token?: string
          id?: string
          merchant_id?: string
          platform?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["merchant_id"]
          },
        ]
      }
      wallets: {
        Row: {
          address: string
          chain_id: string
          created_at: string
          is_primary: boolean
          is_verified: boolean
          label: string | null
          merchant_id: string
          external_wallet_id: string | null
          source: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          address: string
          chain_id: string
          created_at?: string
          is_primary?: boolean
          is_verified?: boolean
          label?: string | null
          merchant_id: string
          external_wallet_id?: string | null
          source?: string
          updated_at?: string
          wallet_id?: string
        }
        Update: {
          address?: string
          chain_id?: string
          created_at?: string
          is_primary?: boolean
          is_verified?: boolean
          label?: string | null
          merchant_id?: string
          external_wallet_id?: string | null
          source?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["chain_id"]
          },
          {
            foreignKeyName: "wallets_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["merchant_id"]
          },
        ]
      }
      merchants: {
        Row: {
          created_at: string
          default_currency: string
          default_language: string
          default_token_id: string
          description: string | null
          display_name: string | null
          email: string
          logo_url: string | null
          merchant_id: string
          pin_code_attempts: number | null
          pin_code_blocked_at: string | null
          pin_code_hash: string | null
          pin_code_last_attempt_at: string | null
          privy_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency: string
          default_language: string
          default_token_id: string
          description?: string | null
          display_name?: string | null
          email: string
          logo_url?: string | null
          merchant_id?: string
          pin_code_attempts?: number | null
          pin_code_blocked_at?: string | null
          pin_code_hash?: string | null
          pin_code_last_attempt_at?: string | null
          privy_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          default_language?: string
          default_token_id?: string
          description?: string | null
          display_name?: string | null
          email?: string
          logo_url?: string | null
          merchant_id?: string
          pin_code_attempts?: number | null
          pin_code_blocked_at?: string | null
          pin_code_hash?: string | null
          pin_code_last_attempt_at?: string | null
          privy_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchants_default_currency_fkey"
            columns: ["default_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["currency_id"]
          },
          {
            foreignKeyName: "merchants_default_language_fkey"
            columns: ["default_language"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["language_id"]
          },
          {
            foreignKeyName: "merchants_default_token_id_fkey"
            columns: ["default_token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["token_id"]
          },
        ]
      }
      orders: {
        Row: {
          callback_payload: Json | null
          created_at: string
          description: string | null
          display_amount: number
          display_currency: string
          expired_at: string | null
          merchant_address: string
          merchant_chain_id: string
          merchant_id: string
          number: string | null
          order_id: string
          payment_data: Json | null
          payment_id: string
          preferred_token_id: string | null
          required_amount_usd: number
          required_token: string
          source_chain_name: string | null
          source_token_address: string | null
          source_token_amount: number | null
          source_txn_hash: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string | null
        }
        Insert: {
          callback_payload?: Json | null
          created_at?: string
          description?: string | null
          display_amount: number
          display_currency: string
          expired_at?: string | null
          merchant_address: string
          merchant_chain_id: string
          merchant_id: string
          number?: string | null
          order_id?: string
          payment_data?: Json | null
          payment_id: string
          preferred_token_id?: string | null
          required_amount_usd: number
          required_token: string
          source_chain_name?: string | null
          source_token_address?: string | null
          source_token_amount?: number | null
          source_txn_hash?: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Update: {
          callback_payload?: Json | null
          created_at?: string
          description?: string | null
          display_amount?: number
          display_currency?: string
          expired_at?: string | null
          merchant_address?: string
          merchant_chain_id?: string
          merchant_id?: string
          number?: string | null
          order_id?: string
          payment_data?: Json | null
          payment_id?: string
          preferred_token_id?: string | null
          required_amount_usd?: number
          required_token?: string
          source_chain_name?: string | null
          source_token_address?: string | null
          source_token_amount?: number | null
          source_txn_hash?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_display_currency_fkey"
            columns: ["display_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["currency_id"]
          },
          {
            foreignKeyName: "orders_preferred_token_id_fkey"
            columns: ["preferred_token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["token_id"]
          },
        ]
      }
      tokens: {
        Row: {
          chain_id: string
          chain_name: string
          created_at: string | null
          decimals: number
          icon_url: string | null
          is_active: boolean
          token_address: string
          token_id: string
          token_name: string
          updated_at: string | null
        }
        Insert: {
          chain_id: string
          chain_name: string
          created_at?: string | null
          decimals?: number
          icon_url?: string | null
          is_active?: boolean
          token_address: string
          token_id: string
          token_name: string
          updated_at?: string | null
        }
        Update: {
          chain_id?: string
          chain_name?: string
          created_at?: string | null
          decimals?: number
          icon_url?: string | null
          is_active?: boolean
          token_address?: string
          token_id?: string
          token_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tokens_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["chain_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_merchant_wallet_address: {
        Args: { p_chain_id: string; p_merchant_id: string }
        Returns: string
      }
    }
    Enums: {
      payment_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "DISCREPANCY"
        | "EXPIRED"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      payment_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "DISCREPANCY",
        "EXPIRED",
      ],
    },
  },
} as const

