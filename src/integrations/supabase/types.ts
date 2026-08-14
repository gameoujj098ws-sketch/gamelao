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
      ads: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          link: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url: string
          link?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          link?: string | null
        }
        Relationships: []
      }
      card_topups: {
        Row: {
          card_code: string
          created_at: string
          gross_amount: number
          id: string
          net_amount: number
          note: string | null
          status: string
          user_id: string
        }
        Insert: {
          card_code: string
          created_at?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          note?: string | null
          status?: string
          user_id: string
        }
        Update: {
          card_code?: string
          created_at?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          note?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          sort: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          sort?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          from_admin: boolean
          id: string
          read: boolean
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          from_admin?: boolean
          id?: string
          read?: boolean
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          from_admin?: boolean
          id?: string
          read?: boolean
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          game_data: string
          id: string
          price: number
          product_id: string | null
          product_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_data: string
          id?: string
          price: number
          product_id?: string | null
          product_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_data?: string
          id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      product_stock: {
        Row: {
          created_at: string
          game_data: string
          id: string
          product_id: string
          sold: boolean
          sold_at: string | null
          sold_to: string | null
        }
        Insert: {
          created_at?: string
          game_data: string
          id?: string
          product_id: string
          sold?: boolean
          sold_at?: string | null
          sold_to?: string | null
        }
        Update: {
          created_at?: string
          game_data?: string
          id?: string
          product_id?: string
          sold?: boolean
          sold_at?: string | null
          sold_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          hidden_from_home: boolean
          id: string
          image_url: string | null
          is_service: boolean
          name: string
          original_price: number | null
          price: number
          service_field_label: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          hidden_from_home?: boolean
          id?: string
          image_url?: string | null
          is_service?: boolean
          name: string
          original_price?: number | null
          price: number
          service_field_label?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          hidden_from_home?: boolean
          id?: string
          image_url?: string | null
          is_service?: boolean
          name?: string
          original_price?: number | null
          price?: number
          service_field_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          username: string
          wallet_balance: number
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          username: string
          wallet_balance?: number
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          username?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      redeem_codes: {
        Row: {
          amount: number
          code: string
          created_at: string
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      service_fields: {
        Row: {
          created_at: string
          id: string
          label: string
          product_id: string
          sort: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          product_id: string
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          product_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_fields_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          answers: Json
          created_at: string
          customer_note: string | null
          id: string
          package_id: string | null
          package_name: string | null
          price: number
          product_id: string | null
          product_name: string
          status: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          customer_note?: string | null
          id?: string
          package_id?: string | null
          package_name?: string | null
          price: number
          product_id?: string | null
          product_name: string
          status?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          customer_note?: string | null
          id?: string
          package_id?: string | null
          package_name?: string | null
          price?: number
          product_id?: string | null
          product_name?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          price: number
          product_id: string
          sort: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          price: number
          product_id: string
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          product_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          announcement: string | null
          card_enabled: boolean
          discord_webhook: string | null
          help_link: string | null
          id: number
          logo_url: string | null
          primary_color: string | null
          qr_enabled: boolean
          qr_url: string | null
          site_name: string
          slide_url: string | null
        }
        Insert: {
          announcement?: string | null
          card_enabled?: boolean
          discord_webhook?: string | null
          help_link?: string | null
          id?: number
          logo_url?: string | null
          primary_color?: string | null
          qr_enabled?: boolean
          qr_url?: string | null
          site_name?: string
          slide_url?: string | null
        }
        Update: {
          announcement?: string | null
          card_enabled?: boolean
          discord_webhook?: string | null
          help_link?: string | null
          id?: number
          logo_url?: string | null
          primary_color?: string | null
          qr_enabled?: boolean
          qr_url?: string | null
          site_name?: string
          slide_url?: string | null
        }
        Relationships: []
      }
      topups: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          slip_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          slip_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          slip_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_stats: {
        Row: {
          available: number | null
          members: number | null
          sold: number | null
          visits: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_set_wallet: {
        Args: { _new_balance: number; _user_id: string }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      approve_card_topup: { Args: { _id: string }; Returns: undefined }
      approve_topup: { Args: { _topup_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purchase_product: { Args: { _product_id: string }; Returns: Json }
      purchase_service: {
        Args: { _note: string; _product_id: string }
        Returns: Json
      }
      purchase_service_package: {
        Args: { _answers: Json; _package_id: string; _product_id: string }
        Returns: Json
      }
      redeem_code: { Args: { _code: string }; Returns: Json }
      reject_card_topup: { Args: { _id: string }; Returns: undefined }
      reject_topup: { Args: { _topup_id: string }; Returns: undefined }
      resolve_service_order: {
        Args: { _order_id: string; _success: boolean }
        Returns: undefined
      }
      submit_card_topup: { Args: { _card: string }; Returns: Json }
      top_spenders: {
        Args: never
        Returns: {
          times: number
          total: number
          username: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
