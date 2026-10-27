export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      agent_configs: {
        Row: {
          auto_quote: boolean | null;
          business_id: string | null;
          id: string;
          max_round_concession: number | null;
          min_margin: number | null;
          require_approval_above: number | null;
          updated_at: string | null;
        };
        Insert: {
          auto_quote?: boolean | null;
          business_id?: string | null;
          id?: string;
          max_round_concession?: number | null;
          min_margin?: number | null;
          require_approval_above?: number | null;
          updated_at?: string | null;
        };
        Update: {
          auto_quote?: boolean | null;
          business_id?: string | null;
          id?: string;
          max_round_concession?: number | null;
          min_margin?: number | null;
          require_approval_above?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_configs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          category: string | null;
          created_at: string | null;
          email: string | null;
          gstin: string | null;
          id: string;
          is_verified: boolean | null;
          name: string;
          reg_no: string | null;
          updated_at: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          is_verified?: boolean | null;
          name: string;
          reg_no?: string | null;
          updated_at?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          is_verified?: boolean | null;
          name?: string;
          reg_no?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      contact_approvals: {
        Row: {
          approved_at: string | null;
          approved_by_buyer: boolean | null;
          business_id: string | null;
          id: string;
          request_id: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by_buyer?: boolean | null;
          business_id?: string | null;
          id?: string;
          request_id?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by_buyer?: boolean | null;
          business_id?: string | null;
          id?: string;
          request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_approvals_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_approvals_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "procurement_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      negotiation_messages: {
        Row: {
          created_at: string | null;
          id: string;
          message: string;
          price: number | null;
          quotation_id: string | null;
          round: number;
          sender: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          message: string;
          price?: number | null;
          quotation_id?: string | null;
          round: number;
          sender: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          message?: string;
          price?: number | null;
          quotation_id?: string | null;
          round?: number;
          sender?: string;
        };
        Relationships: [
          {
            foreignKeyName: "negotiation_messages_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          business_id: string | null;
          counterparty: string;
          created_at: string | null;
          docs_summary: string | null;
          due_date: string;
          health: string | null;
          id: string;
          location: string | null;
          order_code: string;
          quotation_id: string | null;
          stage: string | null;
          title: string;
          type: string | null;
          updated_at: string | null;
          value: number;
        };
        Insert: {
          business_id?: string | null;
          counterparty: string;
          created_at?: string | null;
          docs_summary?: string | null;
          due_date: string;
          health?: string | null;
          id?: string;
          location?: string | null;
          order_code: string;
          quotation_id?: string | null;
          stage?: string | null;
          title: string;
          type?: string | null;
          updated_at?: string | null;
          value: number;
        };
        Update: {
          business_id?: string | null;
          counterparty?: string;
          created_at?: string | null;
          docs_summary?: string | null;
          due_date?: string;
          health?: string | null;
          id?: string;
          location?: string | null;
          order_code?: string;
          quotation_id?: string | null;
          stage?: string | null;
          title?: string;
          type?: string | null;
          updated_at?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string | null;
          currency: string | null;
          id: string;
          order_id: string | null;
          paypal_capture_id: string | null;
          paypal_order_id: string | null;
          raw_response: Json | null;
          status: string | null;
          verified_at: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          order_id?: string | null;
          paypal_capture_id?: string | null;
          paypal_order_id?: string | null;
          raw_response?: Json | null;
          status?: string | null;
          verified_at?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          order_id?: string | null;
          paypal_capture_id?: string | null;
          paypal_order_id?: string | null;
          raw_response?: Json | null;
          status?: string | null;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      procurement_requests: {
        Row: {
          buyer_name: string;
          category: string;
          created_at: string | null;
          deadline_days: number;
          delivery_location: string | null;
          id: string;
          item_name: string;
          max_budget: number;
          quantity: number;
          specifications: Json | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          buyer_name: string;
          category: string;
          created_at?: string | null;
          deadline_days: number;
          delivery_location?: string | null;
          id?: string;
          item_name: string;
          max_budget: number;
          quantity: number;
          specifications?: Json | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          buyer_name?: string;
          category?: string;
          created_at?: string | null;
          deadline_days?: number;
          delivery_location?: string | null;
          id?: string;
          item_name?: string;
          max_budget?: number;
          quantity?: number;
          specifications?: Json | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      quotations: {
        Row: {
          business_id: string | null;
          buyer_name: string;
          created_at: string | null;
          id: string;
          item_name: string;
          lead_days: number | null;
          margin_achieved: number | null;
          quantity: number;
          request_id: string | null;
          round_count: number | null;
          status: string | null;
          total_value: number;
          unit_price: number;
          updated_at: string | null;
        };
        Insert: {
          business_id?: string | null;
          buyer_name: string;
          created_at?: string | null;
          id?: string;
          item_name: string;
          lead_days?: number | null;
          margin_achieved?: number | null;
          quantity: number;
          request_id?: string | null;
          round_count?: number | null;
          status?: string | null;
          total_value: number;
          unit_price: number;
          updated_at?: string | null;
        };
        Update: {
          business_id?: string | null;
          buyer_name?: string;
          created_at?: string | null;
          id?: string;
          item_name?: string;
          lead_days?: number | null;
          margin_achieved?: number | null;
          quantity?: number;
          request_id?: string | null;
          round_count?: number | null;
          status?: string | null;
          total_value?: number;
          unit_price?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quotations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "procurement_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_products: {
        Row: {
          base_price: number;
          business_id: string | null;
          category: string;
          created_at: string | null;
          floor_price: number;
          id: string;
          in_stock: number;
          is_active: boolean | null;
          lead_days: number;
          material: string | null;
          name: string;
          on_time_rate: number | null;
          sku: string;
          specs: Json | null;
          updated_at: string | null;
        };
        Insert: {
          base_price: number;
          business_id?: string | null;
          category: string;
          created_at?: string | null;
          floor_price: number;
          id?: string;
          in_stock?: number;
          is_active?: boolean | null;
          lead_days?: number;
          material?: string | null;
          name: string;
          on_time_rate?: number | null;
          sku: string;
          specs?: Json | null;
          updated_at?: string | null;
        };
        Update: {
          base_price?: number;
          business_id?: string | null;
          category?: string;
          created_at?: string | null;
          floor_price?: number;
          id?: string;
          in_stock?: number;
          is_active?: boolean | null;
          lead_days?: number;
          material?: string | null;
          name?: string;
          on_time_rate?: number | null;
          sku?: string;
          specs?: Json | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_products_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
