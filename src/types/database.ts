// Supabase Database 类型定义（与 PostgreSQL Schema 对齐）
// 用于 supabase-js 的类型安全查询

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          name: string;
          type: string;
          balance: number;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          balance?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          balance?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          type: string;
          parent_id: string | null;
          icon: string | null;
          color: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          parent_id?: string | null;
          icon?: string | null;
          color?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          parent_id?: string | null;
          icon?: string | null;
          color?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          account_id: string;
          category_id: string;
          amount: number;
          type: string;
          date: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          category_id: string;
          amount: number;
          type: string;
          date: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          category_id?: string;
          amount?: number;
          type?: string;
          date?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transaction_tags: {
        Row: {
          transaction_id: string;
          tag_id: string;
        };
        Insert: {
          transaction_id: string;
          tag_id: string;
        };
        Update: {
          transaction_id?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          category_id: string | null;
          amount: number;
          period: string;
          start_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          amount: number;
          period?: string;
          start_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          amount?: number;
          period?: string;
          start_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
