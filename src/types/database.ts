/**
 * Database types.
 *
 * GENERATED FILE - do not edit by hand.
 *
 * Regenerate after changing supabase/migrations with either:
 *   supabase gen types typescript --local > src/types/database.ts
 * or, with no Supabase project available:
 *   python3 scripts/generate-db-types.py
 *
 * Note on money: `numeric` columns are typed as `string`, because that is
 * what PostgREST returns and because parsing them into a JavaScript number
 * would reintroduce exactly the floating-point error that lib/domain/money.ts
 * exists to prevent. Convert with fromMajor() at the boundary.
 */

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
      admin_settings: {
        Row: {
          key: string;
          value: Json;
          category: string;
          label: string;
          description: string | null;
          is_public: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          category?: string;
          label: string;
          description?: string | null;
          is_public?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          category?: string;
          label?: string;
          description?: string | null;
          is_public?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_documents: {
        Row: {
          id: string;
          agent_id: string;
          verification_id: string | null;
          document_type: Enums['document_type'];
          storage_bucket: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size: number;
          checksum: string | null;
          status: Enums['verification_status'];
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          extracted_data: Json | null;
          risk_score: string | null;
          uploaded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          verification_id?: string | null;
          document_type: Enums['document_type'];
          storage_bucket?: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size: number;
          checksum?: string | null;
          status?: Enums['verification_status'];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          extracted_data?: Json | null;
          risk_score?: string | null;
          uploaded_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          verification_id?: string | null;
          document_type?: Enums['document_type'];
          storage_bucket?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          file_size?: number;
          checksum?: string | null;
          status?: Enums['verification_status'];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          extracted_data?: Json | null;
          risk_score?: string | null;
          uploaded_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_documents_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_documents_verification_id_fkey";
            columns: ["verification_id"];
            isOneToOne: false;
            referencedRelation: "agent_verifications";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_rera_records: {
        Row: {
          id: string;
          agent_id: string;
          rera_number: string;
          state: string;
          authority: string | null;
          registered_name: string | null;
          valid_from: string | null;
          valid_until: string | null;
          status: Enums['verification_status'];
          verified_by: string | null;
          verified_at: string | null;
          verification_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          rera_number: string;
          state: string;
          authority?: string | null;
          registered_name?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          status?: Enums['verification_status'];
          verified_by?: string | null;
          verified_at?: string | null;
          verification_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          rera_number?: string;
          state?: string;
          authority?: string | null;
          registered_name?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          status?: Enums['verification_status'];
          verified_by?: string | null;
          verified_at?: string | null;
          verification_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_rera_records_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_rera_records_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_verifications: {
        Row: {
          id: string;
          agent_id: string;
          level: Enums['verification_level'];
          status: Enums['verification_status'];
          legal_name: string | null;
          business_name: string | null;
          business_address: string | null;
          gst_number: string | null;
          pan_number: string | null;
          bank_account_name: string | null;
          bank_account_last4: string | null;
          bank_ifsc: string | null;
          submitted_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          rejection_reason: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          level: Enums['verification_level'];
          status?: Enums['verification_status'];
          legal_name?: string | null;
          business_name?: string | null;
          business_address?: string | null;
          gst_number?: string | null;
          pan_number?: string | null;
          bank_account_name?: string | null;
          bank_account_last4?: string | null;
          bank_ifsc?: string | null;
          submitted_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          rejection_reason?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          level?: Enums['verification_level'];
          status?: Enums['verification_status'];
          legal_name?: string | null;
          business_name?: string | null;
          business_address?: string | null;
          gst_number?: string | null;
          pan_number?: string | null;
          bank_account_name?: string | null;
          bank_account_last4?: string | null;
          bank_ifsc?: string | null;
          submitted_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          rejection_reason?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_verifications_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_verifications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agents: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          agency_name: string | null;
          bio: string | null;
          headline: string | null;
          experience_years: number;
          languages: string[];
          specializations: Enums['property_type'][];
          service_cities: string[];
          service_localities: string[];
          max_visit_distance_km: string;
          accepts_visit_requests: boolean;
          working_hours: Json;
          base_latitude: string | null;
          base_longitude: string | null;
          verification_level: Enums['verification_level'];
          badges: Enums['agent_badge'][];
          trust_score: string;
          rating_average: string;
          rating_count: number;
          response_rate: string;
          response_time_minutes: number | null;
          visit_completion_rate: string;
          cancellation_rate: string;
          conversion_rate: string;
          active_lead_count: number;
          closed_deal_count: number;
          complaint_count: number;
          risk_score: string;
          status: Enums['account_status'];
          is_demo: boolean;
          joined_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          agency_name?: string | null;
          bio?: string | null;
          headline?: string | null;
          experience_years?: number;
          languages?: string[];
          specializations?: Enums['property_type'][];
          service_cities?: string[];
          service_localities?: string[];
          max_visit_distance_km?: string;
          accepts_visit_requests?: boolean;
          working_hours?: Json;
          base_latitude?: string | null;
          base_longitude?: string | null;
          verification_level?: Enums['verification_level'];
          badges?: Enums['agent_badge'][];
          trust_score?: string;
          rating_average?: string;
          rating_count?: number;
          response_rate?: string;
          response_time_minutes?: number | null;
          visit_completion_rate?: string;
          cancellation_rate?: string;
          conversion_rate?: string;
          active_lead_count?: number;
          closed_deal_count?: number;
          complaint_count?: number;
          risk_score?: string;
          status?: Enums['account_status'];
          is_demo?: boolean;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          slug?: string;
          agency_name?: string | null;
          bio?: string | null;
          headline?: string | null;
          experience_years?: number;
          languages?: string[];
          specializations?: Enums['property_type'][];
          service_cities?: string[];
          service_localities?: string[];
          max_visit_distance_km?: string;
          accepts_visit_requests?: boolean;
          working_hours?: Json;
          base_latitude?: string | null;
          base_longitude?: string | null;
          verification_level?: Enums['verification_level'];
          badges?: Enums['agent_badge'][];
          trust_score?: string;
          rating_average?: string;
          rating_count?: number;
          response_rate?: string;
          response_time_minutes?: number | null;
          visit_completion_rate?: string;
          cancellation_rate?: string;
          conversion_rate?: string;
          active_lead_count?: number;
          closed_deal_count?: number;
          complaint_count?: number;
          risk_score?: string;
          status?: Enums['account_status'];
          is_demo?: boolean;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agreements: {
        Row: {
          id: string;
          reference_code: string;
          agreement_type: Enums['agreement_type'];
          status: Enums['agreement_status'];
          opportunity_id: string | null;
          property_id: string | null;
          investor_id: string | null;
          deal_id: string | null;
          template_key: string | null;
          terms: Json;
          capital_amount: string | null;
          exit_price: string | null;
          expected_margin: string | null;
          platform_fee_percent: string | null;
          investor_share_percent: string | null;
          currency: string;
          starts_on: string | null;
          ends_on: string | null;
          signed_at: string | null;
          terminated_at: string | null;
          termination_reason: string | null;
          legal_reviewed_by: string | null;
          legal_reviewed_at: string | null;
          legal_review_notes: string | null;
          storage_bucket: string | null;
          storage_path: string | null;
          created_by: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          agreement_type: Enums['agreement_type'];
          status?: Enums['agreement_status'];
          opportunity_id?: string | null;
          property_id?: string | null;
          investor_id?: string | null;
          deal_id?: string | null;
          template_key?: string | null;
          terms?: Json;
          capital_amount?: string | null;
          exit_price?: string | null;
          expected_margin?: string | null;
          platform_fee_percent?: string | null;
          investor_share_percent?: string | null;
          currency?: string;
          starts_on?: string | null;
          ends_on?: string | null;
          signed_at?: string | null;
          terminated_at?: string | null;
          termination_reason?: string | null;
          legal_reviewed_by?: string | null;
          legal_reviewed_at?: string | null;
          legal_review_notes?: string | null;
          storage_bucket?: string | null;
          storage_path?: string | null;
          created_by?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          agreement_type?: Enums['agreement_type'];
          status?: Enums['agreement_status'];
          opportunity_id?: string | null;
          property_id?: string | null;
          investor_id?: string | null;
          deal_id?: string | null;
          template_key?: string | null;
          terms?: Json;
          capital_amount?: string | null;
          exit_price?: string | null;
          expected_margin?: string | null;
          platform_fee_percent?: string | null;
          investor_share_percent?: string | null;
          currency?: string;
          starts_on?: string | null;
          ends_on?: string | null;
          signed_at?: string | null;
          terminated_at?: string | null;
          termination_reason?: string | null;
          legal_reviewed_by?: string | null;
          legal_reviewed_at?: string | null;
          legal_review_notes?: string | null;
          storage_bucket?: string | null;
          storage_path?: string | null;
          created_by?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agreements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agreements_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agreements_investor_id_fkey";
            columns: ["investor_id"];
            isOneToOne: false;
            referencedRelation: "investors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agreements_legal_reviewed_by_fkey";
            columns: ["legal_reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agreements_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "investor_opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agreements_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      amenities: {
        Row: {
          key: string;
          label: string;
          category: string;
          icon: string | null;
          sort_order: number;
        };
        Insert: {
          key: string;
          label: string;
          category: string;
          icon?: string | null;
          sort_order?: number;
        };
        Update: {
          key?: string;
          label?: string;
          category?: string;
          icon?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: number;
          event_name: string;
          user_id: string | null;
          session_id: string | null;
          entity_type: string | null;
          entity_id: string | null;
          properties: Json;
          city: string | null;
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          event_name: string;
          user_id?: string | null;
          session_id?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          properties?: Json;
          city?: string | null;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          event_name?: string;
          user_id?: string | null;
          session_id?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          properties?: Json;
          city?: string | null;
          source?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      api_keys: {
        Row: {
          id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          owner_user_id: string | null;
          scopes: string[];
          rate_limit_per_minute: number;
          last_used_at: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          owner_user_id?: string | null;
          scopes?: string[];
          rate_limit_per_minute?: number;
          last_used_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          owner_user_id?: string | null;
          scopes?: string[];
          rate_limit_per_minute?: number;
          last_used_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          actor_role: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          entity_code: string | null;
          before_state: Json | null;
          after_state: Json | null;
          diff: Json | null;
          reason: string | null;
          ip_address: string | null;
          user_agent: string | null;
          request_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          actor_role?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          entity_code?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          diff?: Json | null;
          reason?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          request_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          actor_role?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          entity_code?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          diff?: Json | null;
          reason?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          request_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_calculations: {
        Row: {
          id: string;
          deal_id: string;
          rule_id: string | null;
          version: number;
          transaction_value: string;
          commission_pool: string;
          currency: string;
          policy_snapshot: Json;
          explanation: Json;
          engine_version: string;
          status: Enums['commission_status'];
          is_current: boolean;
          superseded_by: string | null;
          calculated_by: string | null;
          calculated_at: string;
          approved_by: string | null;
          approved_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          deal_id: string;
          rule_id?: string | null;
          version?: number;
          transaction_value: string;
          commission_pool: string;
          currency?: string;
          policy_snapshot: Json;
          explanation?: Json;
          engine_version?: string;
          status?: Enums['commission_status'];
          is_current?: boolean;
          superseded_by?: string | null;
          calculated_by?: string | null;
          calculated_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          deal_id?: string;
          rule_id?: string | null;
          version?: number;
          transaction_value?: string;
          commission_pool?: string;
          currency?: string;
          policy_snapshot?: Json;
          explanation?: Json;
          engine_version?: string;
          status?: Enums['commission_status'];
          is_current?: boolean;
          superseded_by?: string | null;
          calculated_by?: string | null;
          calculated_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_calculations_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_calculations_calculated_by_fkey";
            columns: ["calculated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_calculations_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: true;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_calculations_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "commission_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_calculations_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "commission_calculations";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_distributions: {
        Row: {
          id: string;
          calculation_id: string;
          deal_id: string;
          participant_id: string | null;
          role: Enums['deal_participant_role'];
          agent_id: string | null;
          investor_id: string | null;
          user_id: string | null;
          visit_id: string | null;
          share_percent: string | null;
          amount: string;
          currency: string;
          amount_minor: number;
          tier: string | null;
          contribution_score: string | null;
          calculation_basis: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          calculation_id: string;
          deal_id: string;
          participant_id?: string | null;
          role: Enums['deal_participant_role'];
          agent_id?: string | null;
          investor_id?: string | null;
          user_id?: string | null;
          visit_id?: string | null;
          share_percent?: string | null;
          amount: string;
          currency?: string;
          amount_minor: number;
          tier?: string | null;
          contribution_score?: string | null;
          calculation_basis?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          calculation_id?: string;
          deal_id?: string;
          participant_id?: string | null;
          role?: Enums['deal_participant_role'];
          agent_id?: string | null;
          investor_id?: string | null;
          user_id?: string | null;
          visit_id?: string | null;
          share_percent?: string | null;
          amount?: string;
          currency?: string;
          amount_minor?: number;
          tier?: string | null;
          contribution_score?: string | null;
          calculation_basis?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_distributions_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_distributions_calculation_id_fkey";
            columns: ["calculation_id"];
            isOneToOne: false;
            referencedRelation: "commission_calculations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_distributions_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_distributions_investor_id_fkey";
            columns: ["investor_id"];
            isOneToOne: false;
            referencedRelation: "investors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_distributions_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "deal_participants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_distributions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_distributions_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_ledger: {
        Row: {
          id: string;
          reference_code: string;
          deal_id: string;
          calculation_id: string | null;
          distribution_id: string | null;
          user_id: string | null;
          agent_id: string | null;
          investor_id: string | null;
          role: Enums['deal_participant_role'];
          entry_type: Enums['ledger_entry_type'];
          amount: string;
          amount_minor: number;
          currency: string;
          status: Enums['commission_status'];
          calculation_rule: string | null;
          reverses_entry_id: string | null;
          adjustment_reason: string | null;
          approved_by: string | null;
          approved_at: string | null;
          paid_at: string | null;
          payment_id: string | null;
          payment_reference: string | null;
          dispute_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          deal_id: string;
          calculation_id?: string | null;
          distribution_id?: string | null;
          user_id?: string | null;
          agent_id?: string | null;
          investor_id?: string | null;
          role: Enums['deal_participant_role'];
          entry_type?: Enums['ledger_entry_type'];
          amount: string;
          amount_minor: number;
          currency?: string;
          status?: Enums['commission_status'];
          calculation_rule?: string | null;
          reverses_entry_id?: string | null;
          adjustment_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          paid_at?: string | null;
          payment_id?: string | null;
          payment_reference?: string | null;
          dispute_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          deal_id?: string;
          calculation_id?: string | null;
          distribution_id?: string | null;
          user_id?: string | null;
          agent_id?: string | null;
          investor_id?: string | null;
          role?: Enums['deal_participant_role'];
          entry_type?: Enums['ledger_entry_type'];
          amount?: string;
          amount_minor?: number;
          currency?: string;
          status?: Enums['commission_status'];
          calculation_rule?: string | null;
          reverses_entry_id?: string | null;
          adjustment_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          paid_at?: string | null;
          payment_id?: string | null;
          payment_reference?: string | null;
          dispute_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_ledger_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_ledger_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_ledger_calculation_id_fkey";
            columns: ["calculation_id"];
            isOneToOne: false;
            referencedRelation: "commission_calculations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_ledger_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_ledger_distribution_id_fkey";
            columns: ["distribution_id"];
            isOneToOne: false;
            referencedRelation: "commission_distributions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_ledger_investor_id_fkey";
            columns: ["investor_id"];
            isOneToOne: false;
            referencedRelation: "investors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_ledger_reverses_entry_id_fkey";
            columns: ["reverses_entry_id"];
            isOneToOne: false;
            referencedRelation: "commission_ledger";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_dispute_fk";
            columns: ["dispute_id"];
            isOneToOne: false;
            referencedRelation: "disputes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_payment_fk";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_rules: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          version: number;
          listing_type: Enums['listing_type'] | null;
          property_category: Enums['property_category'] | null;
          city: string | null;
          region_code: string | null;
          min_transaction_value: string | null;
          max_transaction_value: string | null;
          pool_mode: Enums['commission_pool_mode'];
          pool_percent: string | null;
          pool_fixed_amount: string | null;
          min_pool_amount: string | null;
          max_pool_amount: string | null;
          visit_model: Enums['visit_distribution_model'];
          policy: Json;
          currency: string;
          priority: number;
          is_active: boolean;
          effective_from: string;
          effective_until: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          version?: number;
          listing_type?: Enums['listing_type'] | null;
          property_category?: Enums['property_category'] | null;
          city?: string | null;
          region_code?: string | null;
          min_transaction_value?: string | null;
          max_transaction_value?: string | null;
          pool_mode?: Enums['commission_pool_mode'];
          pool_percent?: string | null;
          pool_fixed_amount?: string | null;
          min_pool_amount?: string | null;
          max_pool_amount?: string | null;
          visit_model?: Enums['visit_distribution_model'];
          policy: Json;
          currency?: string;
          priority?: number;
          is_active?: boolean;
          effective_from?: string;
          effective_until?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          version?: number;
          listing_type?: Enums['listing_type'] | null;
          property_category?: Enums['property_category'] | null;
          city?: string | null;
          region_code?: string | null;
          min_transaction_value?: string | null;
          max_transaction_value?: string | null;
          pool_mode?: Enums['commission_pool_mode'];
          pool_percent?: string | null;
          pool_fixed_amount?: string | null;
          min_pool_amount?: string | null;
          max_pool_amount?: string | null;
          visit_model?: Enums['visit_distribution_model'];
          policy?: Json;
          currency?: string;
          priority?: number;
          is_active?: boolean;
          effective_from?: string;
          effective_until?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_rules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_rules_region_code_fkey";
            columns: ["region_code"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["code"];
          },
        ];
      };
      contact_access_logs: {
        Row: {
          id: string;
          customer_id: string;
          lead_id: string | null;
          accessed_by: string;
          agent_id: string | null;
          field: string;
          reason: string | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          lead_id?: string | null;
          accessed_by: string;
          agent_id?: string | null;
          field: string;
          reason?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          lead_id?: string | null;
          accessed_by?: string;
          agent_id?: string | null;
          field?: string;
          reason?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_access_logs_accessed_by_fkey";
            columns: ["accessed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_access_logs_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_access_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_access_logs_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_contacts: {
        Row: {
          id: string;
          agent_id: string;
          customer_id: string | null;
          full_name: string;
          phone: string | null;
          email: string | null;
          city: string | null;
          locality: string | null;
          tags: string[];
          requirement_summary: string | null;
          budget_min: string | null;
          budget_max: string | null;
          preferred_property_types: Enums['property_type'][];
          notes: string | null;
          last_contacted_at: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          customer_id?: string | null;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          locality?: string | null;
          tags?: string[];
          requirement_summary?: string | null;
          budget_min?: string | null;
          budget_max?: string | null;
          preferred_property_types?: Enums['property_type'][];
          notes?: string | null;
          last_contacted_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          customer_id?: string | null;
          full_name?: string;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          locality?: string | null;
          tags?: string[];
          requirement_summary?: string | null;
          budget_min?: string | null;
          budget_max?: string | null;
          preferred_property_types?: Enums['property_type'][];
          notes?: string | null;
          last_contacted_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_contacts_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_contacts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_notes: {
        Row: {
          id: string;
          agent_id: string;
          lead_id: string | null;
          contact_id: string | null;
          visit_id: string | null;
          body: string;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          lead_id?: string | null;
          contact_id?: string | null;
          visit_id?: string | null;
          body: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          lead_id?: string | null;
          contact_id?: string | null;
          visit_id?: string | null;
          body?: string;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_notes_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_notes_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "crm_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_notes_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_notes_visit_fk";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_tasks: {
        Row: {
          id: string;
          agent_id: string;
          lead_id: string | null;
          contact_id: string | null;
          visit_id: string | null;
          task_type: Enums['crm_task_type'];
          title: string;
          description: string | null;
          due_at: string;
          remind_at: string | null;
          status: Enums['crm_task_status'];
          completed_at: string | null;
          outcome: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          lead_id?: string | null;
          contact_id?: string | null;
          visit_id?: string | null;
          task_type?: Enums['crm_task_type'];
          title: string;
          description?: string | null;
          due_at: string;
          remind_at?: string | null;
          status?: Enums['crm_task_status'];
          completed_at?: string | null;
          outcome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          lead_id?: string | null;
          contact_id?: string | null;
          visit_id?: string | null;
          task_type?: Enums['crm_task_type'];
          title?: string;
          description?: string | null;
          due_at?: string;
          remind_at?: string | null;
          status?: Enums['crm_task_status'];
          completed_at?: string | null;
          outcome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_tasks_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_tasks_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "crm_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_tasks_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_tasks_visit_fk";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_requirements: {
        Row: {
          id: string;
          reference_code: string;
          customer_id: string;
          title: string | null;
          property_type: Enums['property_type'][];
          category: Enums['property_category'];
          listing_type: Enums['listing_type'];
          city: string;
          localities: string[];
          state: string | null;
          budget_min: string | null;
          budget_max: string;
          currency: string;
          min_area: string | null;
          max_area: string | null;
          bedrooms_min: number | null;
          bedrooms_max: number | null;
          bathrooms_min: number | null;
          facing: Enums['facing_direction'][];
          furnishing: Enums['furnishing_status'][];
          possession: Enums['possession_status'][];
          required_by: string | null;
          amenities: string[];
          preferences: string | null;
          is_discoverable: boolean;
          status: Enums['requirement_status'];
          match_count: number;
          expires_at: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          customer_id: string;
          title?: string | null;
          property_type?: Enums['property_type'][];
          category?: Enums['property_category'];
          listing_type: Enums['listing_type'];
          city: string;
          localities?: string[];
          state?: string | null;
          budget_min?: string | null;
          budget_max: string;
          currency?: string;
          min_area?: string | null;
          max_area?: string | null;
          bedrooms_min?: number | null;
          bedrooms_max?: number | null;
          bathrooms_min?: number | null;
          facing?: Enums['facing_direction'][];
          furnishing?: Enums['furnishing_status'][];
          possession?: Enums['possession_status'][];
          required_by?: string | null;
          amenities?: string[];
          preferences?: string | null;
          is_discoverable?: boolean;
          status?: Enums['requirement_status'];
          match_count?: number;
          expires_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          customer_id?: string;
          title?: string | null;
          property_type?: Enums['property_type'][];
          category?: Enums['property_category'];
          listing_type?: Enums['listing_type'];
          city?: string;
          localities?: string[];
          state?: string | null;
          budget_min?: string | null;
          budget_max?: string;
          currency?: string;
          min_area?: string | null;
          max_area?: string | null;
          bedrooms_min?: number | null;
          bedrooms_max?: number | null;
          bathrooms_min?: number | null;
          facing?: Enums['facing_direction'][];
          furnishing?: Enums['furnishing_status'][];
          possession?: Enums['possession_status'][];
          required_by?: string | null;
          amenities?: string[];
          preferences?: string | null;
          is_discoverable?: boolean;
          status?: Enums['requirement_status'];
          match_count?: number;
          expires_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_requirements_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          user_id: string;
          preferred_cities: string[];
          preferred_localities: string[];
          budget_min: string | null;
          budget_max: string | null;
          currency: string;
          purchase_intent: string | null;
          preferred_contact_time: string | null;
          allow_agent_contact: boolean;
          allow_requirement_discovery: boolean;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preferred_cities?: string[];
          preferred_localities?: string[];
          budget_min?: string | null;
          budget_max?: string | null;
          currency?: string;
          purchase_intent?: string | null;
          preferred_contact_time?: string | null;
          allow_agent_contact?: boolean;
          allow_requirement_discovery?: boolean;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          preferred_cities?: string[];
          preferred_localities?: string[];
          budget_min?: string | null;
          budget_max?: string | null;
          currency?: string;
          purchase_intent?: string | null;
          preferred_contact_time?: string | null;
          allow_agent_contact?: boolean;
          allow_requirement_discovery?: boolean;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deal_documents: {
        Row: {
          id: string;
          deal_id: string;
          document_type: Enums['document_type'];
          storage_bucket: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size: number;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          deal_id: string;
          document_type: Enums['document_type'];
          storage_bucket?: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size: number;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          deal_id?: string;
          document_type?: Enums['document_type'];
          storage_bucket?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          file_size?: number;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deal_documents_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deal_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deal_events: {
        Row: {
          id: string;
          deal_id: string;
          event_type: string;
          from_status: Enums['deal_status'] | null;
          to_status: Enums['deal_status'] | null;
          actor_id: string | null;
          amount: string | null;
          currency: string | null;
          notes: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          deal_id: string;
          event_type: string;
          from_status?: Enums['deal_status'] | null;
          to_status?: Enums['deal_status'] | null;
          actor_id?: string | null;
          amount?: string | null;
          currency?: string | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          deal_id?: string;
          event_type?: string;
          from_status?: Enums['deal_status'] | null;
          to_status?: Enums['deal_status'] | null;
          actor_id?: string | null;
          amount?: string | null;
          currency?: string | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deal_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deal_events_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      deal_participants: {
        Row: {
          id: string;
          deal_id: string;
          role: Enums['deal_participant_role'];
          agent_id: string | null;
          investor_id: string | null;
          user_id: string | null;
          override_percent: string | null;
          override_amount: string | null;
          contribution_notes: string | null;
          added_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          deal_id: string;
          role: Enums['deal_participant_role'];
          agent_id?: string | null;
          investor_id?: string | null;
          user_id?: string | null;
          override_percent?: string | null;
          override_amount?: string | null;
          contribution_notes?: string | null;
          added_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          deal_id?: string;
          role?: Enums['deal_participant_role'];
          agent_id?: string | null;
          investor_id?: string | null;
          user_id?: string | null;
          override_percent?: string | null;
          override_amount?: string | null;
          contribution_notes?: string | null;
          added_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deal_participants_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deal_participants_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deal_participants_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deal_participants_investor_id_fkey";
            columns: ["investor_id"];
            isOneToOne: false;
            referencedRelation: "investors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deal_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deals: {
        Row: {
          id: string;
          reference_code: string;
          customer_id: string;
          property_id: string;
          listing_id: string | null;
          lead_id: string | null;
          listing_type: Enums['listing_type'];
          status: Enums['deal_status'];
          asking_price: string | null;
          negotiated_price: string | null;
          final_price: string | null;
          booking_amount: string | null;
          currency: string;
          commission_pool: string | null;
          commission_pool_source: string;
          seller_name: string | null;
          seller_contact_masked: string | null;
          expected_closure_date: string | null;
          booked_at: string | null;
          closed_at: string | null;
          lost_reason: string | null;
          notes: string | null;
          created_by: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          customer_id: string;
          property_id: string;
          listing_id?: string | null;
          lead_id?: string | null;
          listing_type: Enums['listing_type'];
          status?: Enums['deal_status'];
          asking_price?: string | null;
          negotiated_price?: string | null;
          final_price?: string | null;
          booking_amount?: string | null;
          currency?: string;
          commission_pool?: string | null;
          commission_pool_source?: string;
          seller_name?: string | null;
          seller_contact_masked?: string | null;
          expected_closure_date?: string | null;
          booked_at?: string | null;
          closed_at?: string | null;
          lost_reason?: string | null;
          notes?: string | null;
          created_by?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          customer_id?: string;
          property_id?: string;
          listing_id?: string | null;
          lead_id?: string | null;
          listing_type?: Enums['listing_type'];
          status?: Enums['deal_status'];
          asking_price?: string | null;
          negotiated_price?: string | null;
          final_price?: string | null;
          booking_amount?: string | null;
          currency?: string;
          commission_pool?: string | null;
          commission_pool_source?: string;
          seller_name?: string | null;
          seller_contact_masked?: string | null;
          expected_closure_date?: string | null;
          booked_at?: string | null;
          closed_at?: string | null;
          lost_reason?: string | null;
          notes?: string | null;
          created_by?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deals_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      dispute_events: {
        Row: {
          id: string;
          dispute_id: string;
          event_type: string;
          from_status: Enums['dispute_status'] | null;
          to_status: Enums['dispute_status'] | null;
          actor_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dispute_id: string;
          event_type: string;
          from_status?: Enums['dispute_status'] | null;
          to_status?: Enums['dispute_status'] | null;
          actor_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          dispute_id?: string;
          event_type?: string;
          from_status?: Enums['dispute_status'] | null;
          to_status?: Enums['dispute_status'] | null;
          actor_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dispute_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispute_events_dispute_id_fkey";
            columns: ["dispute_id"];
            isOneToOne: false;
            referencedRelation: "disputes";
            referencedColumns: ["id"];
          },
        ];
      };
      dispute_evidence: {
        Row: {
          id: string;
          dispute_id: string;
          submitted_by: string;
          description: string | null;
          storage_bucket: string | null;
          storage_path: string | null;
          file_name: string | null;
          mime_type: string | null;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dispute_id: string;
          submitted_by: string;
          description?: string | null;
          storage_bucket?: string | null;
          storage_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          dispute_id?: string;
          submitted_by?: string;
          description?: string | null;
          storage_bucket?: string | null;
          storage_path?: string | null;
          file_name?: string | null;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey";
            columns: ["dispute_id"];
            isOneToOne: false;
            referencedRelation: "disputes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispute_evidence_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      disputes: {
        Row: {
          id: string;
          reference_code: string;
          category: Enums['dispute_category'];
          status: Enums['dispute_status'];
          priority: string;
          raised_by: string;
          raised_by_agent_id: string | null;
          against_user_id: string | null;
          against_agent_id: string | null;
          entity_type: string;
          entity_id: string;
          title: string;
          description: string;
          claimed_amount: string | null;
          currency: string;
          assigned_to: string | null;
          admin_decision: string | null;
          resolution: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          escalated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          category: Enums['dispute_category'];
          status?: Enums['dispute_status'];
          priority?: string;
          raised_by: string;
          raised_by_agent_id?: string | null;
          against_user_id?: string | null;
          against_agent_id?: string | null;
          entity_type: string;
          entity_id: string;
          title: string;
          description: string;
          claimed_amount?: string | null;
          currency?: string;
          assigned_to?: string | null;
          admin_decision?: string | null;
          resolution?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          escalated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          category?: Enums['dispute_category'];
          status?: Enums['dispute_status'];
          priority?: string;
          raised_by?: string;
          raised_by_agent_id?: string | null;
          against_user_id?: string | null;
          against_agent_id?: string | null;
          entity_type?: string;
          entity_id?: string;
          title?: string;
          description?: string;
          claimed_amount?: string | null;
          currency?: string;
          assigned_to?: string | null;
          admin_decision?: string | null;
          resolution?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          escalated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disputes_against_agent_id_fkey";
            columns: ["against_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_against_user_id_fkey";
            columns: ["against_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_raised_by_agent_id_fkey";
            columns: ["raised_by_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_raised_by_fkey";
            columns: ["raised_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exclusive_inventory: {
        Row: {
          id: string;
          property_id: string;
          listing_id: string | null;
          agreement_id: string;
          investor_id: string | null;
          status: Enums['exclusive_status'];
          starts_on: string;
          ends_on: string;
          access_policy: string;
          agent_commission_percent: string | null;
          released_at: string | null;
          release_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          listing_id?: string | null;
          agreement_id: string;
          investor_id?: string | null;
          status?: Enums['exclusive_status'];
          starts_on: string;
          ends_on: string;
          access_policy?: string;
          agent_commission_percent?: string | null;
          released_at?: string | null;
          release_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          listing_id?: string | null;
          agreement_id?: string;
          investor_id?: string | null;
          status?: Enums['exclusive_status'];
          starts_on?: string;
          ends_on?: string;
          access_policy?: string;
          agent_commission_percent?: string | null;
          released_at?: string | null;
          release_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exclusive_inventory_agreement_id_fkey";
            columns: ["agreement_id"];
            isOneToOne: false;
            referencedRelation: "agreements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exclusive_inventory_investor_id_fkey";
            columns: ["investor_id"];
            isOneToOne: false;
            referencedRelation: "investors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exclusive_inventory_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exclusive_inventory_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          id: string;
          customer_id: string;
          listing_id: string;
          property_id: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          listing_id: string;
          property_id: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          listing_id?: string;
          property_id?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          key: string;
          enabled: boolean;
          label: string;
          description: string | null;
          rollout_percent: number;
          target_roles: Enums['app_role'][];
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          enabled?: boolean;
          label: string;
          description?: string | null;
          rollout_percent?: number;
          target_roles?: Enums['app_role'][];
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          enabled?: boolean;
          label?: string;
          description?: string | null;
          rollout_percent?: number;
          target_roles?: Enums['app_role'][];
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      idempotency_keys: {
        Row: {
          key: string;
          user_id: string | null;
          endpoint: string;
          request_hash: string;
          response_status: number | null;
          response_body: Json | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          key: string;
          user_id?: string | null;
          endpoint: string;
          request_hash: string;
          response_status?: number | null;
          response_body?: Json | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          key?: string;
          user_id?: string | null;
          endpoint?: string;
          request_hash?: string;
          response_status?: number | null;
          response_body?: Json | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      investor_interests: {
        Row: {
          id: string;
          opportunity_id: string;
          investor_id: string;
          status: string;
          proposed_capital: string | null;
          message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          opportunity_id: string;
          investor_id: string;
          status?: string;
          proposed_capital?: string | null;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          opportunity_id?: string;
          investor_id?: string;
          status?: string;
          proposed_capital?: string | null;
          message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investor_interests_investor_id_fkey";
            columns: ["investor_id"];
            isOneToOne: false;
            referencedRelation: "investors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investor_interests_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "investor_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      investor_opportunities: {
        Row: {
          id: string;
          reference_code: string;
          property_id: string;
          listing_id: string | null;
          created_by: string | null;
          title: string;
          summary: string | null;
          agreement_type: Enums['agreement_type'];
          seller_price: string;
          capital_amount: string;
          target_exit_price: string;
          expected_margin: string | null;
          platform_fee_percent: string;
          currency: string;
          holding_period_months: number | null;
          status: Enums['exclusive_status'];
          eligibility: Json;
          risk_notes: string | null;
          legal_disclaimer: string;
          opens_at: string | null;
          closes_at: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          property_id: string;
          listing_id?: string | null;
          created_by?: string | null;
          title: string;
          summary?: string | null;
          agreement_type?: Enums['agreement_type'];
          seller_price: string;
          capital_amount: string;
          target_exit_price: string;
          expected_margin?: string | null;
          platform_fee_percent?: string;
          currency?: string;
          holding_period_months?: number | null;
          status?: Enums['exclusive_status'];
          eligibility?: Json;
          risk_notes?: string | null;
          legal_disclaimer?: string;
          opens_at?: string | null;
          closes_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          property_id?: string;
          listing_id?: string | null;
          created_by?: string | null;
          title?: string;
          summary?: string | null;
          agreement_type?: Enums['agreement_type'];
          seller_price?: string;
          capital_amount?: string;
          target_exit_price?: string;
          expected_margin?: string | null;
          platform_fee_percent?: string;
          currency?: string;
          holding_period_months?: number | null;
          status?: Enums['exclusive_status'];
          eligibility?: Json;
          risk_notes?: string | null;
          legal_disclaimer?: string;
          opens_at?: string | null;
          closes_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investor_opportunities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investor_opportunities_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investor_opportunities_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      investor_positions: {
        Row: {
          id: string;
          investor_id: string;
          agreement_id: string;
          property_id: string | null;
          deal_id: string | null;
          capital_deployed: string;
          expected_return: string | null;
          realised_return: string | null;
          currency: string;
          status: string;
          entered_on: string;
          exited_on: string | null;
          settlement_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          investor_id: string;
          agreement_id: string;
          property_id?: string | null;
          deal_id?: string | null;
          capital_deployed?: string;
          expected_return?: string | null;
          realised_return?: string | null;
          currency?: string;
          status?: string;
          entered_on?: string;
          exited_on?: string | null;
          settlement_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          investor_id?: string;
          agreement_id?: string;
          property_id?: string | null;
          deal_id?: string | null;
          capital_deployed?: string;
          expected_return?: string | null;
          realised_return?: string | null;
          currency?: string;
          status?: string;
          entered_on?: string;
          exited_on?: string | null;
          settlement_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investor_positions_agreement_id_fkey";
            columns: ["agreement_id"];
            isOneToOne: false;
            referencedRelation: "agreements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investor_positions_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investor_positions_investor_id_fkey";
            columns: ["investor_id"];
            isOneToOne: false;
            referencedRelation: "investors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investor_positions_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      investor_verifications: {
        Row: {
          id: string;
          investor_id: string;
          level: Enums['verification_level'];
          status: Enums['verification_status'];
          pan_number: string | null;
          entity_registration_number: string | null;
          submitted_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          rejection_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          investor_id: string;
          level: Enums['verification_level'];
          status?: Enums['verification_status'];
          pan_number?: string | null;
          entity_registration_number?: string | null;
          submitted_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          investor_id?: string;
          level?: Enums['verification_level'];
          status?: Enums['verification_status'];
          pan_number?: string | null;
          entity_registration_number?: string | null;
          submitted_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investor_verifications_investor_id_fkey";
            columns: ["investor_id"];
            isOneToOne: false;
            referencedRelation: "investors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investor_verifications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      investors: {
        Row: {
          id: string;
          user_id: string;
          entity_name: string | null;
          entity_type: string | null;
          investment_cities: string[];
          preferred_property_types: Enums['property_type'][];
          ticket_size_min: string | null;
          ticket_size_max: string | null;
          currency: string;
          target_holding_months: number | null;
          target_return_percent: string | null;
          risk_appetite: string | null;
          verification_status: Enums['verification_status'];
          verification_level: Enums['verification_level'];
          is_accredited: boolean;
          status: Enums['account_status'];
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_name?: string | null;
          entity_type?: string | null;
          investment_cities?: string[];
          preferred_property_types?: Enums['property_type'][];
          ticket_size_min?: string | null;
          ticket_size_max?: string | null;
          currency?: string;
          target_holding_months?: number | null;
          target_return_percent?: string | null;
          risk_appetite?: string | null;
          verification_status?: Enums['verification_status'];
          verification_level?: Enums['verification_level'];
          is_accredited?: boolean;
          status?: Enums['account_status'];
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entity_name?: string | null;
          entity_type?: string | null;
          investment_cities?: string[];
          preferred_property_types?: Enums['property_type'][];
          ticket_size_min?: string | null;
          ticket_size_max?: string | null;
          currency?: string;
          target_holding_months?: number | null;
          target_return_percent?: string | null;
          risk_appetite?: string | null;
          verification_status?: Enums['verification_status'];
          verification_level?: Enums['verification_level'];
          is_accredited?: boolean;
          status?: Enums['account_status'];
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_events: {
        Row: {
          id: string;
          lead_id: string;
          event_type: string;
          from_stage: Enums['lead_stage'] | null;
          to_stage: Enums['lead_stage'] | null;
          actor_id: string | null;
          actor_role: string | null;
          agent_id: string | null;
          source: Enums['lead_source'] | null;
          notes: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          event_type: string;
          from_stage?: Enums['lead_stage'] | null;
          to_stage?: Enums['lead_stage'] | null;
          actor_id?: string | null;
          actor_role?: string | null;
          agent_id?: string | null;
          source?: Enums['lead_source'] | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          event_type?: string;
          from_stage?: Enums['lead_stage'] | null;
          to_stage?: Enums['lead_stage'] | null;
          actor_id?: string | null;
          actor_role?: string | null;
          agent_id?: string | null;
          source?: Enums['lead_source'] | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_events_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          id: string;
          reference_code: string;
          customer_id: string;
          property_id: string | null;
          listing_id: string | null;
          requirement_id: string | null;
          listing_agent_id: string | null;
          sales_agent_id: string | null;
          referral_agent_id: string | null;
          source: Enums['lead_source'];
          source_detail: string | null;
          stage: Enums['lead_stage'];
          priority: string;
          message: string | null;
          budget: string | null;
          currency: string;
          is_contact_unlocked: boolean;
          contact_unlocked_at: string | null;
          contact_unlocked_by: string | null;
          accepted_at: string | null;
          first_response_at: string | null;
          last_activity_at: string;
          next_follow_up_at: string | null;
          closed_at: string | null;
          lost_reason: string | null;
          score: string;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          customer_id: string;
          property_id?: string | null;
          listing_id?: string | null;
          requirement_id?: string | null;
          listing_agent_id?: string | null;
          sales_agent_id?: string | null;
          referral_agent_id?: string | null;
          source?: Enums['lead_source'];
          source_detail?: string | null;
          stage?: Enums['lead_stage'];
          priority?: string;
          message?: string | null;
          budget?: string | null;
          currency?: string;
          is_contact_unlocked?: boolean;
          contact_unlocked_at?: string | null;
          contact_unlocked_by?: string | null;
          accepted_at?: string | null;
          first_response_at?: string | null;
          last_activity_at?: string;
          next_follow_up_at?: string | null;
          closed_at?: string | null;
          lost_reason?: string | null;
          score?: string;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          customer_id?: string;
          property_id?: string | null;
          listing_id?: string | null;
          requirement_id?: string | null;
          listing_agent_id?: string | null;
          sales_agent_id?: string | null;
          referral_agent_id?: string | null;
          source?: Enums['lead_source'];
          source_detail?: string | null;
          stage?: Enums['lead_stage'];
          priority?: string;
          message?: string | null;
          budget?: string | null;
          currency?: string;
          is_contact_unlocked?: boolean;
          contact_unlocked_at?: string | null;
          contact_unlocked_by?: string | null;
          accepted_at?: string | null;
          first_response_at?: string | null;
          last_activity_at?: string;
          next_follow_up_at?: string | null;
          closed_at?: string | null;
          lost_reason?: string | null;
          score?: string;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_contact_unlocked_by_fkey";
            columns: ["contact_unlocked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_listing_agent_id_fkey";
            columns: ["listing_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_referral_agent_id_fkey";
            columns: ["referral_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_requirement_id_fkey";
            columns: ["requirement_id"];
            isOneToOne: false;
            referencedRelation: "customer_requirements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_sales_agent_id_fkey";
            columns: ["sales_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_media: {
        Row: {
          id: string;
          listing_id: string;
          property_media_id: string | null;
          media_type: Enums['media_type'];
          storage_bucket: string | null;
          storage_path: string | null;
          external_url: string | null;
          caption: string | null;
          alt_text: string | null;
          sort_order: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          property_media_id?: string | null;
          media_type: Enums['media_type'];
          storage_bucket?: string | null;
          storage_path?: string | null;
          external_url?: string | null;
          caption?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          property_media_id?: string | null;
          media_type?: Enums['media_type'];
          storage_bucket?: string | null;
          storage_path?: string | null;
          external_url?: string | null;
          caption?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_media_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_media_property_media_id_fkey";
            columns: ["property_media_id"];
            isOneToOne: false;
            referencedRelation: "property_media";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_referrals: {
        Row: {
          id: string;
          listing_id: string;
          share_id: string | null;
          referring_agent_id: string;
          receiving_agent_id: string | null;
          customer_id: string | null;
          lead_id: string | null;
          source: Enums['lead_source'];
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          share_id?: string | null;
          referring_agent_id: string;
          receiving_agent_id?: string | null;
          customer_id?: string | null;
          lead_id?: string | null;
          source?: Enums['lead_source'];
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          share_id?: string | null;
          referring_agent_id?: string;
          receiving_agent_id?: string | null;
          customer_id?: string | null;
          lead_id?: string | null;
          source?: Enums['lead_source'];
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_referrals_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_referrals_lead_fk";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_referrals_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_referrals_receiving_agent_id_fkey";
            columns: ["receiving_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_referrals_referring_agent_id_fkey";
            columns: ["referring_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_referrals_share_id_fkey";
            columns: ["share_id"];
            isOneToOne: false;
            referencedRelation: "listing_shares";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_shares: {
        Row: {
          id: string;
          listing_id: string;
          owner_agent_id: string;
          requester_agent_id: string;
          status: Enums['share_status'];
          request_message: string | null;
          response_message: string | null;
          agreed_share_percent: string | null;
          requested_at: string;
          responded_at: string | null;
          revoked_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          owner_agent_id: string;
          requester_agent_id: string;
          status?: Enums['share_status'];
          request_message?: string | null;
          response_message?: string | null;
          agreed_share_percent?: string | null;
          requested_at?: string;
          responded_at?: string | null;
          revoked_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          owner_agent_id?: string;
          requester_agent_id?: string;
          status?: Enums['share_status'];
          request_message?: string | null;
          response_message?: string | null;
          agreed_share_percent?: string | null;
          requested_at?: string;
          responded_at?: string | null;
          revoked_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_shares_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_shares_owner_agent_id_fkey";
            columns: ["owner_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_shares_requester_agent_id_fkey";
            columns: ["requester_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_status_history: {
        Row: {
          id: string;
          listing_id: string;
          from_status: Enums['listing_status'] | null;
          to_status: Enums['listing_status'];
          changed_by: string | null;
          reason: string | null;
          notes: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          from_status?: Enums['listing_status'] | null;
          to_status: Enums['listing_status'];
          changed_by?: string | null;
          reason?: string | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          from_status?: Enums['listing_status'] | null;
          to_status?: Enums['listing_status'];
          changed_by?: string | null;
          reason?: string | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_status_history_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listings: {
        Row: {
          id: string;
          reference_code: string;
          property_id: string;
          agent_id: string;
          title: string;
          slug: string;
          description: string | null;
          highlights: string[];
          seo_description: string | null;
          listing_type: Enums['listing_type'];
          status: Enums['listing_status'];
          price: string;
          currency: string;
          is_negotiable: boolean;
          price_per_sqft: string | null;
          maintenance_charge: string | null;
          maintenance_period: string | null;
          security_deposit: string | null;
          booking_amount: string | null;
          brokerage_type: string;
          brokerage_value: string;
          brokerage_notes: string | null;
          property_type: Enums['property_type'];
          category: Enums['property_category'];
          bedrooms: number | null;
          bathrooms: number | null;
          balconies: number | null;
          built_up_area: string | null;
          carpet_area: string | null;
          plot_area: string | null;
          floor: number | null;
          total_floors: number | null;
          facing: Enums['facing_direction'] | null;
          furnishing: Enums['furnishing_status'];
          age_years: number | null;
          possession_status: Enums['possession_status'];
          available_from: string | null;
          covered_parking: number;
          open_parking: number;
          power_backup: string | null;
          water_supply: string | null;
          city: string;
          locality: string;
          state: string;
          pincode: string | null;
          latitude: string | null;
          longitude: string | null;
          cover_image_url: string | null;
          video_url: string | null;
          youtube_url: string | null;
          instagram_reel_url: string | null;
          virtual_tour_url: string | null;
          tour_360_url: string | null;
          floor_plan_url: string | null;
          brochure_url: string | null;
          is_shareable: boolean;
          is_exclusive: boolean;
          exclusive_until: string | null;
          submitted_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          verification_notes: string | null;
          rejection_reason: string | null;
          verification_score: string;
          next_verification_at: string | null;
          published_at: string | null;
          expires_at: string | null;
          view_count: number;
          enquiry_count: number;
          favourite_count: number;
          share_count: number;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          property_id: string;
          agent_id: string;
          title: string;
          slug: string;
          description?: string | null;
          highlights?: string[];
          seo_description?: string | null;
          listing_type: Enums['listing_type'];
          status?: Enums['listing_status'];
          price: string;
          currency?: string;
          is_negotiable?: boolean;
          price_per_sqft?: string | null;
          maintenance_charge?: string | null;
          maintenance_period?: string | null;
          security_deposit?: string | null;
          booking_amount?: string | null;
          brokerage_type?: string;
          brokerage_value?: string;
          brokerage_notes?: string | null;
          property_type: Enums['property_type'];
          category: Enums['property_category'];
          bedrooms?: number | null;
          bathrooms?: number | null;
          balconies?: number | null;
          built_up_area?: string | null;
          carpet_area?: string | null;
          plot_area?: string | null;
          floor?: number | null;
          total_floors?: number | null;
          facing?: Enums['facing_direction'] | null;
          furnishing?: Enums['furnishing_status'];
          age_years?: number | null;
          possession_status?: Enums['possession_status'];
          available_from?: string | null;
          covered_parking?: number;
          open_parking?: number;
          power_backup?: string | null;
          water_supply?: string | null;
          city: string;
          locality: string;
          state: string;
          pincode?: string | null;
          latitude?: string | null;
          longitude?: string | null;
          cover_image_url?: string | null;
          video_url?: string | null;
          youtube_url?: string | null;
          instagram_reel_url?: string | null;
          virtual_tour_url?: string | null;
          tour_360_url?: string | null;
          floor_plan_url?: string | null;
          brochure_url?: string | null;
          is_shareable?: boolean;
          is_exclusive?: boolean;
          exclusive_until?: string | null;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          verification_notes?: string | null;
          rejection_reason?: string | null;
          verification_score?: string;
          next_verification_at?: string | null;
          published_at?: string | null;
          expires_at?: string | null;
          view_count?: number;
          enquiry_count?: number;
          favourite_count?: number;
          share_count?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          property_id?: string;
          agent_id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          highlights?: string[];
          seo_description?: string | null;
          listing_type?: Enums['listing_type'];
          status?: Enums['listing_status'];
          price?: string;
          currency?: string;
          is_negotiable?: boolean;
          price_per_sqft?: string | null;
          maintenance_charge?: string | null;
          maintenance_period?: string | null;
          security_deposit?: string | null;
          booking_amount?: string | null;
          brokerage_type?: string;
          brokerage_value?: string;
          brokerage_notes?: string | null;
          property_type?: Enums['property_type'];
          category?: Enums['property_category'];
          bedrooms?: number | null;
          bathrooms?: number | null;
          balconies?: number | null;
          built_up_area?: string | null;
          carpet_area?: string | null;
          plot_area?: string | null;
          floor?: number | null;
          total_floors?: number | null;
          facing?: Enums['facing_direction'] | null;
          furnishing?: Enums['furnishing_status'];
          age_years?: number | null;
          possession_status?: Enums['possession_status'];
          available_from?: string | null;
          covered_parking?: number;
          open_parking?: number;
          power_backup?: string | null;
          water_supply?: string | null;
          city?: string;
          locality?: string;
          state?: string;
          pincode?: string | null;
          latitude?: string | null;
          longitude?: string | null;
          cover_image_url?: string | null;
          video_url?: string | null;
          youtube_url?: string | null;
          instagram_reel_url?: string | null;
          virtual_tour_url?: string | null;
          tour_360_url?: string | null;
          floor_plan_url?: string | null;
          brochure_url?: string | null;
          is_shareable?: boolean;
          is_exclusive?: boolean;
          exclusive_until?: string | null;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          verification_notes?: string | null;
          rejection_reason?: string | null;
          verification_score?: string;
          next_verification_at?: string | null;
          published_at?: string | null;
          expires_at?: string | null;
          view_count?: number;
          enquiry_count?: number;
          favourite_count?: number;
          share_count?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listings_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          in_app_enabled: boolean;
          email_enabled: boolean;
          sms_enabled: boolean;
          whatsapp_enabled: boolean;
          push_enabled: boolean;
          sms_consent_at: string | null;
          whatsapp_consent_at: string | null;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          muted_events: string[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          sms_enabled?: boolean;
          whatsapp_enabled?: boolean;
          push_enabled?: boolean;
          sms_consent_at?: string | null;
          whatsapp_consent_at?: string | null;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          muted_events?: string[];
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          sms_enabled?: boolean;
          whatsapp_enabled?: boolean;
          push_enabled?: boolean;
          sms_consent_at?: string | null;
          whatsapp_consent_at?: string | null;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          muted_events?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_templates: {
        Row: {
          key: string;
          name: string;
          description: string | null;
          channels: Enums['notification_channel'][];
          subject_template: string | null;
          body_template: string;
          variables: string[];
          provider_template_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          name: string;
          description?: string | null;
          channels?: Enums['notification_channel'][];
          subject_template?: string | null;
          body_template: string;
          variables?: string[];
          provider_template_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          name?: string;
          description?: string | null;
          channels?: Enums['notification_channel'][];
          subject_template?: string | null;
          body_template?: string;
          variables?: string[];
          provider_template_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          template_key: string | null;
          channel: Enums['notification_channel'];
          event_type: string;
          title: string;
          body: string;
          action_url: string | null;
          entity_type: string | null;
          entity_id: string | null;
          payload: Json;
          status: Enums['notification_status'];
          scheduled_for: string | null;
          sent_at: string | null;
          read_at: string | null;
          failure_reason: string | null;
          provider: string | null;
          provider_message_id: string | null;
          attempts: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_key?: string | null;
          channel?: Enums['notification_channel'];
          event_type: string;
          title: string;
          body: string;
          action_url?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          payload?: Json;
          status?: Enums['notification_status'];
          scheduled_for?: string | null;
          sent_at?: string | null;
          read_at?: string | null;
          failure_reason?: string | null;
          provider?: string | null;
          provider_message_id?: string | null;
          attempts?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_key?: string | null;
          channel?: Enums['notification_channel'];
          event_type?: string;
          title?: string;
          body?: string;
          action_url?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          payload?: Json;
          status?: Enums['notification_status'];
          scheduled_for?: string | null;
          sent_at?: string | null;
          read_at?: string | null;
          failure_reason?: string | null;
          provider?: string | null;
          provider_message_id?: string | null;
          attempts?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_template_key_fkey";
            columns: ["template_key"];
            isOneToOne: false;
            referencedRelation: "notification_templates";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          reference_code: string;
          deal_id: string | null;
          payee_user_id: string | null;
          amount: string;
          amount_minor: number;
          currency: string;
          status: Enums['payment_status'];
          processor: string | null;
          processor_reference: string | null;
          initiated_by: string | null;
          initiated_at: string;
          completed_at: string | null;
          failure_reason: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          deal_id?: string | null;
          payee_user_id?: string | null;
          amount: string;
          amount_minor: number;
          currency?: string;
          status?: Enums['payment_status'];
          processor?: string | null;
          processor_reference?: string | null;
          initiated_by?: string | null;
          initiated_at?: string;
          completed_at?: string | null;
          failure_reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          deal_id?: string | null;
          payee_user_id?: string | null;
          amount?: string;
          amount_minor?: number;
          currency?: string;
          status?: Enums['payment_status'];
          processor?: string | null;
          processor_reference?: string | null;
          initiated_by?: string | null;
          initiated_at?: string;
          completed_at?: string | null;
          failure_reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_initiated_by_fkey";
            columns: ["initiated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_payee_user_id_fkey";
            columns: ["payee_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          display_name: string | null;
          email: string | null;
          phone: string | null;
          phone_country: string;
          avatar_url: string | null;
          locale: string;
          timezone: string;
          country: string;
          city: string | null;
          status: Enums['account_status'];
          email_verified_at: string | null;
          phone_verified_at: string | null;
          consent_marketing: boolean;
          consent_terms_at: string | null;
          consent_privacy_at: string | null;
          last_seen_at: string | null;
          is_demo: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          display_name?: string | null;
          email?: string | null;
          phone?: string | null;
          phone_country?: string;
          avatar_url?: string | null;
          locale?: string;
          timezone?: string;
          country?: string;
          city?: string | null;
          status?: Enums['account_status'];
          email_verified_at?: string | null;
          phone_verified_at?: string | null;
          consent_marketing?: boolean;
          consent_terms_at?: string | null;
          consent_privacy_at?: string | null;
          last_seen_at?: string | null;
          is_demo?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          display_name?: string | null;
          email?: string | null;
          phone?: string | null;
          phone_country?: string;
          avatar_url?: string | null;
          locale?: string;
          timezone?: string;
          country?: string;
          city?: string | null;
          status?: Enums['account_status'];
          email_verified_at?: string | null;
          phone_verified_at?: string | null;
          consent_marketing?: boolean;
          consent_terms_at?: string | null;
          consent_privacy_at?: string | null;
          last_seen_at?: string | null;
          is_demo?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          slug: string;
          name: string;
          developer_name: string | null;
          region_code: string | null;
          city: string;
          locality: string;
          state: string;
          pincode: string | null;
          latitude: string | null;
          longitude: string | null;
          rera_number: string | null;
          rera_state: string | null;
          total_towers: number | null;
          total_units: number | null;
          possession_date: string | null;
          amenities: string[];
          description: string | null;
          cover_image_url: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          developer_name?: string | null;
          region_code?: string | null;
          city: string;
          locality: string;
          state: string;
          pincode?: string | null;
          latitude?: string | null;
          longitude?: string | null;
          rera_number?: string | null;
          rera_state?: string | null;
          total_towers?: number | null;
          total_units?: number | null;
          possession_date?: string | null;
          amenities?: string[];
          description?: string | null;
          cover_image_url?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          developer_name?: string | null;
          region_code?: string | null;
          city?: string;
          locality?: string;
          state?: string;
          pincode?: string | null;
          latitude?: string | null;
          longitude?: string | null;
          rera_number?: string | null;
          rera_state?: string | null;
          total_towers?: number | null;
          total_units?: number | null;
          possession_date?: string | null;
          amenities?: string[];
          description?: string | null;
          cover_image_url?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_region_code_fkey";
            columns: ["region_code"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["code"];
          },
        ];
      };
      property_addresses: {
        Row: {
          property_id: string;
          address_line1: string | null;
          address_line2: string | null;
          landmark: string | null;
          locality: string;
          sub_locality: string | null;
          city: string;
          district: string | null;
          state: string;
          pincode: string | null;
          country: string;
          latitude: string | null;
          longitude: string | null;
          google_place_id: string | null;
          map_url: string | null;
          is_exact_location_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          property_id: string;
          address_line1?: string | null;
          address_line2?: string | null;
          landmark?: string | null;
          locality: string;
          sub_locality?: string | null;
          city: string;
          district?: string | null;
          state: string;
          pincode?: string | null;
          country?: string;
          latitude?: string | null;
          longitude?: string | null;
          google_place_id?: string | null;
          map_url?: string | null;
          is_exact_location_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          property_id?: string;
          address_line1?: string | null;
          address_line2?: string | null;
          landmark?: string | null;
          locality?: string;
          sub_locality?: string | null;
          city?: string;
          district?: string | null;
          state?: string;
          pincode?: string | null;
          country?: string;
          latitude?: string | null;
          longitude?: string | null;
          google_place_id?: string | null;
          map_url?: string | null;
          is_exact_location_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_addresses_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      property_amenities: {
        Row: {
          property_id: string;
          amenity_key: string;
          notes: string | null;
        };
        Insert: {
          property_id: string;
          amenity_key: string;
          notes?: string | null;
        };
        Update: {
          property_id?: string;
          amenity_key?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_amenities_amenity_key_fkey";
            columns: ["amenity_key"];
            isOneToOne: false;
            referencedRelation: "amenities";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "property_amenities_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      property_documents: {
        Row: {
          id: string;
          property_id: string;
          document_type: Enums['document_type'];
          storage_bucket: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size: number;
          checksum: string | null;
          visibility: string;
          status: Enums['verification_status'];
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          extracted_data: Json | null;
          risk_score: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          document_type: Enums['document_type'];
          storage_bucket?: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size: number;
          checksum?: string | null;
          visibility?: string;
          status?: Enums['verification_status'];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          extracted_data?: Json | null;
          risk_score?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          document_type?: Enums['document_type'];
          storage_bucket?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          file_size?: number;
          checksum?: string | null;
          visibility?: string;
          status?: Enums['verification_status'];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          extracted_data?: Json | null;
          risk_score?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_documents_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_duplicate_candidates: {
        Row: {
          id: string;
          property_id: string;
          candidate_id: string;
          confidence: string;
          signals: Json;
          status: Enums['duplicate_status'];
          reviewed_by: string | null;
          reviewed_at: string | null;
          resolution_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          candidate_id: string;
          confidence: string;
          signals?: Json;
          status?: Enums['duplicate_status'];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          candidate_id?: string;
          confidence?: string;
          signals?: Json;
          status?: Enums['duplicate_status'];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_duplicate_candidates_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_duplicate_candidates_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_duplicate_candidates_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_media: {
        Row: {
          id: string;
          property_id: string;
          media_type: Enums['media_type'];
          storage_bucket: string | null;
          storage_path: string | null;
          external_url: string | null;
          caption: string | null;
          alt_text: string | null;
          width: number | null;
          height: number | null;
          file_size: number | null;
          mime_type: string | null;
          image_hash: string | null;
          sort_order: number;
          is_primary: boolean;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          media_type: Enums['media_type'];
          storage_bucket?: string | null;
          storage_path?: string | null;
          external_url?: string | null;
          caption?: string | null;
          alt_text?: string | null;
          width?: number | null;
          height?: number | null;
          file_size?: number | null;
          mime_type?: string | null;
          image_hash?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          media_type?: Enums['media_type'];
          storage_bucket?: string | null;
          storage_path?: string | null;
          external_url?: string | null;
          caption?: string | null;
          alt_text?: string | null;
          width?: number | null;
          height?: number | null;
          file_size?: number | null;
          mime_type?: string | null;
          image_hash?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_media_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_media_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_nearby_places: {
        Row: {
          id: string;
          property_id: string;
          place_type: Enums['nearby_place_type'];
          name: string;
          distance_km: string;
          travel_minutes: number | null;
          google_place_id: string | null;
          latitude: string | null;
          longitude: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          place_type: Enums['nearby_place_type'];
          name: string;
          distance_km: string;
          travel_minutes?: number | null;
          google_place_id?: string | null;
          latitude?: string | null;
          longitude?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          place_type?: Enums['nearby_place_type'];
          name?: string;
          distance_km?: string;
          travel_minutes?: number | null;
          google_place_id?: string | null;
          latitude?: string | null;
          longitude?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_nearby_places_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      property_passports: {
        Row: {
          id: string;
          reference_code: string;
          region_code: string;
          property_type: Enums['property_type'];
          category: Enums['property_category'];
          project_id: string | null;
          building: string | null;
          tower: string | null;
          unit_number: string | null;
          floor: number | null;
          total_floors: number | null;
          carpet_area: string | null;
          built_up_area: string | null;
          super_built_up_area: string | null;
          plot_area: string | null;
          area_unit: string;
          dimensions: string | null;
          bedrooms: number | null;
          bathrooms: number | null;
          balconies: number | null;
          facing: Enums['facing_direction'] | null;
          age_years: number | null;
          ownership_type: Enums['ownership_type'];
          owner_name: string | null;
          owner_contact_masked: string | null;
          rera_number: string | null;
          rera_state: string | null;
          status: Enums['property_status'];
          verification_status: Enums['verification_status'];
          verification_score: string;
          last_verified_at: string | null;
          next_verification_at: string | null;
          listing_count: number;
          active_listing_count: number;
          view_count: number;
          enquiry_count: number;
          visit_count: number;
          favourite_count: number;
          fingerprint: string | null;
          duplicate_of: string | null;
          risk_score: string;
          created_by: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          region_code: string;
          property_type: Enums['property_type'];
          category: Enums['property_category'];
          project_id?: string | null;
          building?: string | null;
          tower?: string | null;
          unit_number?: string | null;
          floor?: number | null;
          total_floors?: number | null;
          carpet_area?: string | null;
          built_up_area?: string | null;
          super_built_up_area?: string | null;
          plot_area?: string | null;
          area_unit?: string;
          dimensions?: string | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          balconies?: number | null;
          facing?: Enums['facing_direction'] | null;
          age_years?: number | null;
          ownership_type?: Enums['ownership_type'];
          owner_name?: string | null;
          owner_contact_masked?: string | null;
          rera_number?: string | null;
          rera_state?: string | null;
          status?: Enums['property_status'];
          verification_status?: Enums['verification_status'];
          verification_score?: string;
          last_verified_at?: string | null;
          next_verification_at?: string | null;
          listing_count?: number;
          active_listing_count?: number;
          view_count?: number;
          enquiry_count?: number;
          visit_count?: number;
          favourite_count?: number;
          fingerprint?: string | null;
          duplicate_of?: string | null;
          risk_score?: string;
          created_by?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          region_code?: string;
          property_type?: Enums['property_type'];
          category?: Enums['property_category'];
          project_id?: string | null;
          building?: string | null;
          tower?: string | null;
          unit_number?: string | null;
          floor?: number | null;
          total_floors?: number | null;
          carpet_area?: string | null;
          built_up_area?: string | null;
          super_built_up_area?: string | null;
          plot_area?: string | null;
          area_unit?: string;
          dimensions?: string | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          balconies?: number | null;
          facing?: Enums['facing_direction'] | null;
          age_years?: number | null;
          ownership_type?: Enums['ownership_type'];
          owner_name?: string | null;
          owner_contact_masked?: string | null;
          rera_number?: string | null;
          rera_state?: string | null;
          status?: Enums['property_status'];
          verification_status?: Enums['verification_status'];
          verification_score?: string;
          last_verified_at?: string | null;
          next_verification_at?: string | null;
          listing_count?: number;
          active_listing_count?: number;
          view_count?: number;
          enquiry_count?: number;
          visit_count?: number;
          favourite_count?: number;
          fingerprint?: string | null;
          duplicate_of?: string | null;
          risk_score?: string;
          created_by?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_passports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_passports_duplicate_of_fkey";
            columns: ["duplicate_of"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_passports_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_passports_region_code_fkey";
            columns: ["region_code"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["code"];
          },
        ];
      };
      property_price_history: {
        Row: {
          id: string;
          property_id: string;
          listing_id: string | null;
          listing_type: Enums['listing_type'];
          price: string;
          currency: string;
          price_per_sqft: string | null;
          recorded_at: string;
          source: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          listing_id?: string | null;
          listing_type: Enums['listing_type'];
          price: string;
          currency?: string;
          price_per_sqft?: string | null;
          recorded_at?: string;
          source?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          listing_id?: string | null;
          listing_type?: Enums['listing_type'];
          price?: string;
          currency?: string;
          price_per_sqft?: string | null;
          recorded_at?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_history_listing_fk";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_price_history_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
      property_verifications: {
        Row: {
          id: string;
          property_id: string;
          status: Enums['verification_status'];
          score: string | null;
          checklist: Json;
          notes: string | null;
          rejection_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string;
          next_verification_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          status: Enums['verification_status'];
          score?: string | null;
          checklist?: Json;
          notes?: string | null;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string;
          next_verification_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          status?: Enums['verification_status'];
          score?: string | null;
          checklist?: Json;
          notes?: string | null;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string;
          next_verification_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_verifications_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_verifications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reference_counters: {
        Row: {
          scope: string;
          next_value: number;
        };
        Insert: {
          scope: string;
          next_value?: number;
        };
        Update: {
          scope?: string;
          next_value?: number;
        };
        Relationships: [];
      };
      regions: {
        Row: {
          code: string;
          name: string;
          country: string;
          state: string | null;
          cities: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          code: string;
          name: string;
          country?: string;
          state?: string | null;
          cities?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          country?: string;
          state?: string | null;
          cities?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      requirement_matches: {
        Row: {
          id: string;
          requirement_id: string;
          listing_id: string;
          score: string;
          breakdown: Json;
          algorithm_version: string;
          is_dismissed: boolean;
          computed_at: string;
        };
        Insert: {
          id?: string;
          requirement_id: string;
          listing_id: string;
          score: string;
          breakdown?: Json;
          algorithm_version?: string;
          is_dismissed?: boolean;
          computed_at?: string;
        };
        Update: {
          id?: string;
          requirement_id?: string;
          listing_id?: string;
          score?: string;
          breakdown?: Json;
          algorithm_version?: string;
          is_dismissed?: boolean;
          computed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "requirement_matches_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requirement_matches_requirement_id_fkey";
            columns: ["requirement_id"];
            isOneToOne: false;
            referencedRelation: "customer_requirements";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          subject_type: Enums['review_subject'];
          agent_id: string | null;
          property_id: string | null;
          visit_id: string | null;
          deal_id: string | null;
          author_id: string;
          customer_id: string | null;
          rating: number;
          title: string | null;
          body: string | null;
          is_verified_interaction: boolean;
          moderation_status: Enums['moderation_status'];
          moderated_by: string | null;
          moderated_at: string | null;
          moderation_notes: string | null;
          rejection_reason: string | null;
          agent_response: string | null;
          agent_responded_at: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject_type: Enums['review_subject'];
          agent_id?: string | null;
          property_id?: string | null;
          visit_id?: string | null;
          deal_id?: string | null;
          author_id: string;
          customer_id?: string | null;
          rating: number;
          title?: string | null;
          body?: string | null;
          is_verified_interaction?: boolean;
          moderation_status?: Enums['moderation_status'];
          moderated_by?: string | null;
          moderated_at?: string | null;
          moderation_notes?: string | null;
          rejection_reason?: string | null;
          agent_response?: string | null;
          agent_responded_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject_type?: Enums['review_subject'];
          agent_id?: string | null;
          property_id?: string | null;
          visit_id?: string | null;
          deal_id?: string | null;
          author_id?: string;
          customer_id?: string | null;
          rating?: number;
          title?: string | null;
          body?: string | null;
          is_verified_interaction?: boolean;
          moderation_status?: Enums['moderation_status'];
          moderated_by?: string | null;
          moderated_at?: string | null;
          moderation_notes?: string | null;
          rejection_reason?: string | null;
          agent_response?: string | null;
          agent_responded_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey";
            columns: ["moderated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          key: Enums['app_role'];
          label: string;
          description: string;
        };
        Insert: {
          key: Enums['app_role'];
          label: string;
          description: string;
        };
        Update: {
          key?: Enums['app_role'];
          label?: string;
          description?: string;
        };
        Relationships: [];
      };
      saved_searches: {
        Row: {
          id: string;
          customer_id: string;
          name: string;
          filters: Json;
          alert_enabled: boolean;
          alert_frequency: string;
          last_alerted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          name: string;
          filters: Json;
          alert_enabled?: boolean;
          alert_frequency?: string;
          last_alerted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          name?: string;
          filters?: Json;
          alert_enabled?: boolean;
          alert_frequency?: string;
          last_alerted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_searches_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Enums['app_role'];
          admin_role: Enums['admin_role'] | null;
          granted_by: string | null;
          granted_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: Enums['app_role'];
          admin_role?: Enums['admin_role'] | null;
          granted_by?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: Enums['app_role'];
          admin_role?: Enums['admin_role'] | null;
          granted_by?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      visit_assignments: {
        Row: {
          id: string;
          visit_id: string;
          agent_id: string;
          status: string;
          offer_rank: number;
          distance_km: string | null;
          match_score: string | null;
          offered_at: string;
          responded_at: string | null;
          expires_at: string | null;
          decline_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          visit_id: string;
          agent_id: string;
          status?: string;
          offer_rank?: number;
          distance_km?: string | null;
          match_score?: string | null;
          offered_at?: string;
          responded_at?: string | null;
          expires_at?: string | null;
          decline_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string;
          agent_id?: string;
          status?: string;
          offer_rank?: number;
          distance_km?: string | null;
          match_score?: string | null;
          offered_at?: string;
          responded_at?: string | null;
          expires_at?: string | null;
          decline_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visit_assignments_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_assignments_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      visit_attributions: {
        Row: {
          id: string;
          deal_id: string | null;
          visit_id: string;
          agent_id: string;
          tier: string;
          visit_rank: number;
          contribution_score: string;
          score_breakdown: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          deal_id?: string | null;
          visit_id: string;
          agent_id: string;
          tier: string;
          visit_rank: number;
          contribution_score?: string;
          score_breakdown?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          deal_id?: string | null;
          visit_id?: string;
          agent_id?: string;
          tier?: string;
          visit_rank?: number;
          contribution_score?: string;
          score_breakdown?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visit_attributions_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_attributions_deal_fk";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_attributions_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      visit_checkins: {
        Row: {
          id: string;
          visit_id: string;
          actor: Enums['checkin_actor'];
          actor_id: string | null;
          action: string;
          latitude: string | null;
          longitude: string | null;
          accuracy_m: string | null;
          distance_from_property_m: string | null;
          within_geofence: boolean | null;
          device_info: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          visit_id: string;
          actor: Enums['checkin_actor'];
          actor_id?: string | null;
          action: string;
          latitude?: string | null;
          longitude?: string | null;
          accuracy_m?: string | null;
          distance_from_property_m?: string | null;
          within_geofence?: boolean | null;
          device_info?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string;
          actor?: Enums['checkin_actor'];
          actor_id?: string | null;
          action?: string;
          latitude?: string | null;
          longitude?: string | null;
          accuracy_m?: string | null;
          distance_from_property_m?: string | null;
          within_geofence?: boolean | null;
          device_info?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visit_checkins_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_checkins_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      visit_feedback: {
        Row: {
          id: string;
          visit_id: string;
          customer_id: string;
          agent_id: string | null;
          did_visit_happen: boolean;
          rating: number | null;
          agent_rating: number | null;
          property_matched_listing: boolean | null;
          interest_level: number | null;
          comments: string | null;
          moderation_status: Enums['moderation_status'];
          created_at: string;
        };
        Insert: {
          id?: string;
          visit_id: string;
          customer_id: string;
          agent_id?: string | null;
          did_visit_happen: boolean;
          rating?: number | null;
          agent_rating?: number | null;
          property_matched_listing?: boolean | null;
          interest_level?: number | null;
          comments?: string | null;
          moderation_status?: Enums['moderation_status'];
          created_at?: string;
        };
        Update: {
          id?: string;
          visit_id?: string;
          customer_id?: string;
          agent_id?: string | null;
          did_visit_happen?: boolean;
          rating?: number | null;
          agent_rating?: number | null;
          property_matched_listing?: boolean | null;
          interest_level?: number | null;
          comments?: string | null;
          moderation_status?: Enums['moderation_status'];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visit_feedback_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_feedback_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visit_feedback_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: true;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      visits: {
        Row: {
          id: string;
          reference_code: string;
          customer_id: string;
          property_id: string;
          listing_id: string | null;
          lead_id: string | null;
          visit_type: Enums['visit_type'];
          status: Enums['visit_status'];
          requested_date: string;
          requested_time: string;
          requested_window_minutes: number;
          scheduled_at: string | null;
          preferred_agent_id: string | null;
          assigned_agent_id: string | null;
          listing_agent_id: string | null;
          assigned_at: string | null;
          started_at: string | null;
          ended_at: string | null;
          duration_minutes: number | null;
          agent_confirmed_at: string | null;
          customer_confirmed_at: string | null;
          otp_code_hash: string | null;
          otp_expires_at: string | null;
          otp_verified_at: string | null;
          geofence_passed: boolean | null;
          geofence_distance_m: string | null;
          is_qualified: boolean;
          qualified_at: string | null;
          qualification_reasons: Json;
          disqualification_reason: string | null;
          outcome: Enums['visit_outcome'];
          interest_level: number | null;
          agent_notes: string | null;
          customer_notes: string | null;
          cancellation_reason: string | null;
          cancelled_by: string | null;
          cancelled_at: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_code?: string;
          customer_id: string;
          property_id: string;
          listing_id?: string | null;
          lead_id?: string | null;
          visit_type?: Enums['visit_type'];
          status?: Enums['visit_status'];
          requested_date: string;
          requested_time: string;
          requested_window_minutes?: number;
          scheduled_at?: string | null;
          preferred_agent_id?: string | null;
          assigned_agent_id?: string | null;
          listing_agent_id?: string | null;
          assigned_at?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          agent_confirmed_at?: string | null;
          customer_confirmed_at?: string | null;
          otp_code_hash?: string | null;
          otp_expires_at?: string | null;
          otp_verified_at?: string | null;
          geofence_passed?: boolean | null;
          geofence_distance_m?: string | null;
          is_qualified?: boolean;
          qualified_at?: string | null;
          qualification_reasons?: Json;
          disqualification_reason?: string | null;
          outcome?: Enums['visit_outcome'];
          interest_level?: number | null;
          agent_notes?: string | null;
          customer_notes?: string | null;
          cancellation_reason?: string | null;
          cancelled_by?: string | null;
          cancelled_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_code?: string;
          customer_id?: string;
          property_id?: string;
          listing_id?: string | null;
          lead_id?: string | null;
          visit_type?: Enums['visit_type'];
          status?: Enums['visit_status'];
          requested_date?: string;
          requested_time?: string;
          requested_window_minutes?: number;
          scheduled_at?: string | null;
          preferred_agent_id?: string | null;
          assigned_agent_id?: string | null;
          listing_agent_id?: string | null;
          assigned_at?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          agent_confirmed_at?: string | null;
          customer_confirmed_at?: string | null;
          otp_code_hash?: string | null;
          otp_expires_at?: string | null;
          otp_verified_at?: string | null;
          geofence_passed?: boolean | null;
          geofence_distance_m?: string | null;
          is_qualified?: boolean;
          qualified_at?: string | null;
          qualification_reasons?: Json;
          disqualification_reason?: string | null;
          outcome?: Enums['visit_outcome'];
          interest_level?: number | null;
          agent_notes?: string | null;
          customer_notes?: string | null;
          cancellation_reason?: string | null;
          cancelled_by?: string | null;
          cancelled_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visits_assigned_agent_id_fkey";
            columns: ["assigned_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_listing_agent_id_fkey";
            columns: ["listing_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_preferred_agent_id_fkey";
            columns: ["preferred_agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "property_passports";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      public_agents: {
        Row: {
          id: string | null;
          slug: string | null;
          agency_name: string | null;
          headline: string | null;
          bio: string | null;
          experience_years: number | null;
          languages: string[] | null;
          specializations: Enums['property_type'][] | null;
          service_cities: string[] | null;
          service_localities: string[] | null;
          verification_level: Enums['verification_level'] | null;
          badges: Enums['agent_badge'][] | null;
          rating_average: string | null;
          rating_count: number | null;
          closed_deal_count: number | null;
          joined_at: string | null;
          full_name: string | null;
          display_name: string | null;
          avatar_url: string | null;
          city: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    CompositeTypes: {
      [key: string]: never;
    };
    Enums: {
      account_status: "ACTIVE" | "PENDING" | "SUSPENDED" | "DEACTIVATED";
      admin_role: "super_admin" | "operations_admin" | "verification_admin" | "finance_admin" | "support_admin" | "content_admin";
      agent_badge: "IDENTITY_VERIFIED" | "RERA_VERIFIED" | "TRUSTED_AGENT" | "TOP_PERFORMER";
      agreement_status: "DRAFT" | "PENDING_LEGAL_REVIEW" | "PENDING_SIGNATURE" | "ACTIVE" | "EXPIRED" | "TERMINATED" | "CANCELLED";
      agreement_type: "EXCLUSIVE_MARKETING_RIGHTS" | "INVENTORY_RESERVATION" | "DISTRIBUTION_RIGHTS" | "CONTRACTUAL_RIGHTS";
      app_role: "customer" | "agent" | "investor" | "admin";
      checkin_actor: "CUSTOMER" | "AGENT";
      commission_pool_mode: "PERCENT_OF_TRANSACTION" | "FIXED_AMOUNT";
      commission_status: "PENDING" | "CALCULATED" | "APPROVED" | "PAYMENT_PROCESSING" | "PAID" | "DISPUTED" | "CANCELLED";
      crm_task_status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "OVERDUE";
      crm_task_type: "CALL" | "MEETING" | "VISIT" | "FOLLOW_UP" | "DOCUMENT" | "PAYMENT" | "OTHER";
      deal_participant_role: "LISTING_AGENT" | "SALES_AGENT" | "VISITING_AGENT" | "REFERRAL_AGENT" | "INVESTOR" | "PLATFORM" | "SELLER" | "BUYER";
      deal_status: "INITIATED" | "NEGOTIATION" | "AGREED" | "BOOKED" | "AGREEMENT_SIGNED" | "REGISTRATION_PENDING" | "CLOSED_WON" | "CLOSED_LOST" | "CANCELLED" | "DISPUTED";
      dispute_category: "LEAD_OWNERSHIP" | "PROPERTY_OWNERSHIP" | "VISIT_ATTRIBUTION" | "COMMISSION" | "DEAL_ATTRIBUTION" | "CONDUCT" | "OTHER";
      dispute_status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED" | "ESCALATED";
      document_type: "PAN" | "AADHAAR" | "PASSPORT" | "DRIVING_LICENCE" | "VOTER_ID" | "GST_CERTIFICATE" | "BUSINESS_REGISTRATION" | "BANK_PROOF" | "RERA_CERTIFICATE" | "SALE_DEED" | "REGISTRY" | "MUTATION" | "ALLOTMENT_LETTER" | "POSSESSION_LETTER" | "BUILDER_NOC" | "OCCUPANCY_CERTIFICATE" | "COMPLETION_CERTIFICATE" | "FLOOR_PLAN" | "BROCHURE" | "ENCUMBRANCE_CERTIFICATE" | "PROPERTY_TAX_RECEIPT" | "AGREEMENT" | "OTHER";
      duplicate_status: "PENDING" | "CONFIRMED_DUPLICATE" | "NOT_DUPLICATE" | "MERGED";
      exclusive_status: "AVAILABLE" | "INVESTOR_INTERESTED" | "UNDER_NEGOTIATION" | "EXCLUSIVE" | "EXPIRED" | "RELEASED" | "SOLD";
      facing_direction: "NORTH" | "SOUTH" | "EAST" | "WEST" | "NORTH_EAST" | "NORTH_WEST" | "SOUTH_EAST" | "SOUTH_WEST";
      furnishing_status: "UNFURNISHED" | "SEMI_FURNISHED" | "FULLY_FURNISHED";
      lead_source: "ORGANIC_WEBSITE" | "DIRECT_AGENT_REFERRAL" | "AGENT_INVENTORY_SHARE" | "ADVERTISEMENT" | "SOCIAL_MEDIA" | "WHATSAPP" | "DIRECT_ENQUIRY" | "CUSTOMER_SEARCH" | "REQUIREMENT_MATCH" | "CALLBACK_REQUEST" | "OTHER";
      lead_stage: "NEW" | "CONTACTED" | "QUALIFIED" | "PROPERTY_SHARED" | "VISIT_REQUESTED" | "VISIT_SCHEDULED" | "VISIT_COMPLETED" | "INTERESTED" | "NEGOTIATION" | "BOOKING" | "CLOSED_WON" | "CLOSED_LOST" | "FOLLOW_UP";
      ledger_entry_type: "EARNING" | "ADJUSTMENT" | "REVERSAL" | "PAYOUT";
      listing_status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "SUSPENDED" | "EXPIRED" | "SOLD" | "RENTED";
      listing_type: "SALE" | "RENT" | "LEASE";
      media_type: "IMAGE" | "VIDEO" | "YOUTUBE" | "INSTAGRAM_REEL" | "VIRTUAL_TOUR" | "TOUR_360" | "FLOOR_PLAN" | "BROCHURE";
      moderation_status: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
      nearby_place_type: "METRO" | "BUS_STOP" | "RAILWAY_STATION" | "AIRPORT" | "SCHOOL" | "COLLEGE" | "HOSPITAL" | "MALL" | "MARKET" | "HIGHWAY" | "OFFICE_HUB" | "RESTAURANT" | "PARK" | "BANK" | "ATM" | "GYM" | "PLACE_OF_WORSHIP" | "OTHER";
      notification_channel: "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
      notification_status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "SKIPPED";
      ownership_type: "FREEHOLD" | "LEASEHOLD" | "POWER_OF_ATTORNEY" | "CO_OPERATIVE_SOCIETY" | "UNKNOWN";
      payment_status: "INITIATED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "CANCELLED";
      possession_status: "READY_TO_MOVE" | "UNDER_CONSTRUCTION" | "NEW_LAUNCH" | "RESALE";
      property_category: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL" | "LAND";
      property_status: "DRAFT" | "PENDING_VERIFICATION" | "ACTIVE" | "RESERVED" | "UNDER_NEGOTIATION" | "BOOKED" | "SOLD" | "RENTED" | "EXPIRED" | "SUSPENDED" | "ARCHIVED";
      property_type: "APARTMENT" | "INDEPENDENT_HOUSE" | "VILLA" | "BUILDER_FLOOR" | "PENTHOUSE" | "STUDIO" | "PLOT" | "FARMHOUSE" | "OFFICE" | "SHOP" | "SHOWROOM" | "WAREHOUSE" | "INDUSTRIAL" | "CO_WORKING" | "SERVICED_APARTMENT" | "OTHER";
      requirement_status: "ACTIVE" | "FULFILLED" | "PAUSED" | "EXPIRED" | "CANCELLED";
      review_subject: "AGENT" | "VISIT" | "PROPERTY";
      share_status: "REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED" | "EXPIRED";
      verification_level: "NONE" | "IDENTITY_VERIFIED" | "BUSINESS_VERIFIED" | "RERA_VERIFIED" | "PLATFORM_TRUSTED";
      verification_status: "NOT_SUBMITTED" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
      visit_distribution_model: "LATEST_WEIGHTED" | "WEIGHTED_SCORE" | "EQUAL" | "CUSTOM";
      visit_outcome: "INTERESTED" | "NEEDS_FOLLOW_UP" | "NOT_INTERESTED" | "PRICE_MISMATCH" | "LOCATION_MISMATCH" | "PROPERTY_MISMATCH" | "NEGOTIATION_STARTED" | "NOT_RECORDED";
      visit_status: "REQUESTED" | "OFFERED" | "ASSIGNED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "QUALIFIED" | "CANCELLED" | "NO_SHOW" | "EXPIRED" | "REJECTED";
      visit_type: "PHYSICAL" | "VIRTUAL" | "LIVE_VIDEO";
    };
  };
}

export type Enums = Database['public']['Enums'];
export type Tables = Database['public']['Tables'];
export type Views = Database['public']['Views'];

export type Row<T extends keyof Tables> = Tables[T]['Row'];
export type Insert<T extends keyof Tables> = Tables[T]['Insert'];
export type Update<T extends keyof Tables> = Tables[T]['Update'];
