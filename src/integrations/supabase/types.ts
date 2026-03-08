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
      admin_actions: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          id: string
          new_data: Json | null
          notes: string | null
          old_data: Json | null
          target_id: string | null
          target_table: string
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          id?: string
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          target_id?: string | null
          target_table: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: number
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: number
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: number
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_links: {
        Row: {
          affiliate_id: string
          clicks: number
          code: string
          commission_earned: number
          conversions: number
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          affiliate_id: string
          clicks?: number
          code: string
          commission_earned?: number
          conversions?: number
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          affiliate_id?: string
          clicks?: number
          code?: string
          commission_earned?: number
          conversions?: number
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          business_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          reason: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          reason?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_city_fees: {
        Row: {
          created_at: string
          fee: number
          from_city: string
          id: string
          is_active: boolean
          to_city: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee?: number
          from_city: string
          id?: string
          is_active?: boolean
          to_city: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee?: number
          from_city?: string
          id?: string
          is_active?: boolean
          to_city?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          base_fee: number
          city: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          zone_name: string
        }
        Insert: {
          base_fee?: number
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          zone_name: string
        }
        Update: {
          base_fee?: number
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          zone_name?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          created_at: string
          entry_type: string
          id: string
          metadata: Json | null
          order_id: string | null
          payment_id: string | null
          reason: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          entry_type: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_id?: string | null
          reason: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          entry_type?: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_id?: string | null
          reason?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          commission_amount: number
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity?: number
        }
        Update: {
          commission_amount?: number
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          affiliate_link_id: string | null
          buyer_notes: string | null
          checkout_session_id: string | null
          confirmation_token: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_fee: number | null
          delivery_type: string | null
          id: string
          payment_reference: string | null
          payment_status: string | null
          purchase_mode: string
          status: string
          total_amount: number
          updated_at: string
          vendor_notified_at: string | null
        }
        Insert: {
          affiliate_link_id?: string | null
          buyer_notes?: string | null
          checkout_session_id?: string | null
          confirmation_token?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_fee?: number | null
          delivery_type?: string | null
          id?: string
          payment_reference?: string | null
          payment_status?: string | null
          purchase_mode?: string
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_notified_at?: string | null
        }
        Update: {
          affiliate_link_id?: string | null
          buyer_notes?: string | null
          checkout_session_id?: string | null
          confirmation_token?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_fee?: number | null
          delivery_type?: string | null
          id?: string
          payment_reference?: string | null
          payment_status?: string | null
          purchase_mode?: string
          status?: string
          total_amount?: number
          updated_at?: string
          vendor_notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_gross: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          mode: string
          order_id: string
          provider: string
          provider_payment_id: string | null
          raw_payload: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_gross: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          mode?: string
          order_id: string
          provider?: string
          provider_payment_id?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_gross?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          mode?: string
          order_id?: string
          provider?: string
          provider_payment_id?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          destination_details: Json
          destination_type: string
          id: string
          processed_by: string | null
          status: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          destination_details: Json
          destination_type: string
          id?: string
          processed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          destination_details?: Json
          destination_type?: string
          id?: string
          processed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          commission: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          is_available: boolean
          price: number
          sales: number
          slug: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          category: string
          commission?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_available?: boolean
          price?: number
          sales?: number
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          category?: string
          commission?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          is_available?: boolean
          price?: number
          sales?: number
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean | null
          full_name: string | null
          id: string
          phone: string | null
          phone_verified: boolean | null
          photo_verified: boolean | null
          updated_at: string
          verification_photo_url: string | null
          verification_status: string | null
          wallet_balance: number | null
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean | null
          full_name?: string | null
          id: string
          phone?: string | null
          phone_verified?: boolean | null
          photo_verified?: boolean | null
          updated_at?: string
          verification_photo_url?: string | null
          verification_status?: string | null
          wallet_balance?: number | null
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean | null
          full_name?: string | null
          id?: string
          phone?: string | null
          phone_verified?: boolean | null
          photo_verified?: boolean | null
          updated_at?: string
          verification_photo_url?: string | null
          verification_status?: string | null
          wallet_balance?: number | null
        }
        Relationships: []
      }
      push_config: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_notifications_log: {
        Row: {
          created_at: string
          id: string
          message_content: string | null
          notification_type: string
          order_id: string
          provider: string | null
          provider_response: Json | null
          recipient_phone: string
          sent_at: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_content?: string | null
          notification_type?: string
          order_id: string
          provider?: string | null
          provider_response?: Json | null
          recipient_phone: string
          sent_at?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_content?: string | null
          notification_type?: string
          order_id?: string
          provider?: string | null
          provider_response?: Json | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_notifications_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_notifications_log_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_profiles: {
        Row: {
          about: string | null
          business_name: string | null
          city: string | null
          country: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          pickup_location: string | null
          updated_at: string | null
          user_id: string
          vendor_address: string | null
          vendor_lat: number | null
          vendor_lng: number | null
          vendor_type: string | null
          verification_status: string | null
        }
        Insert: {
          about?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          pickup_location?: string | null
          updated_at?: string | null
          user_id: string
          vendor_address?: string | null
          vendor_lat?: number | null
          vendor_lng?: number | null
          vendor_type?: string | null
          verification_status?: string | null
        }
        Update: {
          about?: string | null
          business_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          pickup_location?: string | null
          updated_at?: string | null
          user_id?: string
          vendor_address?: string | null
          vendor_lat?: number | null
          vendor_lng?: number | null
          vendor_type?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          id: string
          owner_id: string | null
          owner_type: string
          pending_balance: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          owner_id?: string | null
          owner_type: string
          pending_balance?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          owner_id?: string | null
          owner_type?: string
          pending_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_details: string
          payment_method: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_details: string
          payment_method: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_details?: string
          payment_method?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      affiliate_link_lookup: {
        Row: {
          code: string | null
          product_id: string | null
        }
        Insert: {
          code?: string | null
          product_id?: string | null
        }
        Update: {
          code?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      credit_wallet: {
        Args: {
          p_amount: number
          p_entry_type?: string
          p_metadata?: Json
          p_order_id: string
          p_payment_id: string
          p_reason?: string
          p_wallet_id: string
        }
        Returns: string
      }
      debit_wallet_for_payout: {
        Args: {
          p_amount: number
          p_payout_request_id: string
          p_wallet_id: string
        }
        Returns: string
      }
      generate_slug: { Args: { p_title: string }; Returns: string }
      get_or_create_wallet: {
        Args: { p_currency?: string; p_owner_id: string; p_owner_type: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "vendor" | "affiliate" | "admin"
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
      app_role: ["vendor", "affiliate", "admin"],
    },
  },
} as const
