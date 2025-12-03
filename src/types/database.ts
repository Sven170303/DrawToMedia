export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          credits: number;
          stripe_customer_id: string | null;
          preferred_language: 'de' | 'en' | 'fr';
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          credits?: number;
          stripe_customer_id?: string | null;
          preferred_language?: 'de' | 'en' | 'fr';
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          credits?: number;
          stripe_customer_id?: string | null;
          preferred_language?: 'de' | 'en' | 'fr';
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          price_id: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
          cancelled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          price_id: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
          cancelled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_subscription_id?: string;
          stripe_customer_id?: string;
          price_id?: string;
          status?: string;
          current_period_start?: string;
          current_period_end?: string;
          cancelled_at?: string | null;
          created_at?: string;
        };
      };
      credit_purchases: {
        Row: {
          id: string;
          user_id: string;
          credits: number;
          amount_paid: number;
          currency: string;
          stripe_session_id: string;
          stripe_payment_intent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          credits: number;
          amount_paid: number;
          currency?: string;
          stripe_session_id: string;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          credits?: number;
          amount_paid?: number;
          currency?: string;
          stripe_session_id?: string;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
      };
      generations: {
        Row: {
          id: string;
          user_id: string;
          original_image_url: string;
          generated_image_url: string;
          user_prompt: string | null;
          system_prompt: string;
          format: 'jpeg' | 'png';
          resolution: string;
          generation_time_seconds: number;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          original_image_url: string;
          generated_image_url: string;
          user_prompt?: string | null;
          system_prompt: string;
          format: 'jpeg' | 'png';
          resolution: string;
          generation_time_seconds: number;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          original_image_url?: string;
          generated_image_url?: string;
          user_prompt?: string | null;
          system_prompt?: string;
          format?: 'jpeg' | 'png';
          resolution?: string;
          generation_time_seconds?: number;
          is_public?: boolean;
          created_at?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          generation_id: string;
          comment: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          generation_id: string;
          comment: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          generation_id?: string;
          comment?: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      add_credits: {
        Args: { user_id: string; amount: number };
        Returns: undefined;
      };
      deduct_credit: {
        Args: { user_id: string };
        Returns: undefined;
      };
    };
  };
}

export type User = Database['public']['Tables']['users']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type CreditPurchase = Database['public']['Tables']['credit_purchases']['Row'];
export type Generation = Database['public']['Tables']['generations']['Row'];
export type Feedback = Database['public']['Tables']['feedback']['Row'];
