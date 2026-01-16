export type UserRole = "subscriber" | "employee" | "admin";
export type AdminSubRole = "system_admin" | "attorney_admin" | "super_admin";

export type LetterStatus =
  | "draft"
  | "generating"
  | "pending_review"
  | "under_review"
  | "approved"
  | "completed"
  | "rejected"
  | "failed"
  | "sent";

export type SubscriptionStatus =
  | "active"
  | "pending"
  | "canceled"
  | "past_due"
  | "payment_failed"
  | "trialing";
export type CommissionStatus = "pending" | "paid";

// GDPR Types
export type DataExportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type DataDeletionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed";
export type DataAccessType = "view" | "export" | "edit" | "delete";

// Email Types
export type EmailQueueStatus = "pending" | "sent" | "failed";
export type EmailDeliveryStatus = "sent" | "failed" | "bounced";

// Fraud Types
export type FraudAction = "allow" | "flag" | "block";
export type PatternSeverity = "low" | "medium" | "high" | "critical";
export type PatternType =
  | "velocity"
  | "distribution"
  | "timing"
  | "behavior"
  | "technical";

// Payout Types
export type PayoutStatus = "pending" | "processing" | "completed" | "rejected";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  admin_sub_role: AdminSubRole | null;
  phone: string | null;
  company_name: string | null;
  free_trial_used: boolean;
  stripe_customer_id: string | null;
  total_letters_generated: number;
  is_licensed_attorney: boolean;
  created_at: string;
  updated_at: string;
}

export interface Letter {
  id: string;
  user_id: string;
  title: string;
  letter_type: string | null;
  status: LetterStatus;
  intake_data: Record<string, unknown> | null;
  ai_draft_content: string | null;
  final_content: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  draft_metadata: Record<string, unknown> | null;
  pdf_url: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  is_attorney_reviewed: boolean;
  claimer?: {
    id: string;
    full_name: string | null;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: string | null;
  plan_type: string | null;
  status: SubscriptionStatus | null;
  price: number | null;
  discount: number | null;
  coupon_code: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_session_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  remaining_letters: number | null;
  letters_remaining: number | null;
  letters_per_period: number | null;
  credits_remaining: number | null;
  last_reset_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCoupon {
  id: string;
  employee_id: string | null;
  code: string;
  description: string | null;
  discount_percent: number | null;
  is_active: boolean | null;
  usage_count: number | null;
  max_uses: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Commission {
  id: string;
  employee_id: string;
  subscription_id: string;
  subscription_amount: number;
  commission_rate: number | null;
  commission_amount: number;
  status: CommissionStatus | null;
  paid_at: string | null;
  created_at: string;
}

export interface LetterAuditTrail {
  id: string;
  letter_id: string;
  action: string;
  performed_by: string | null;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CouponUsage {
  id: string;
  user_id: string;
  employee_id: string | null;
  coupon_code: string;
  discount_percent: number;
  amount_before: number;
  amount_after: number;
  subscription_id: string | null;
  plan_type: string | null;
  ip_address: string | null;
  user_agent: string | null;
  fingerprint: string | null;
  fraud_risk_score: number | null;
  fraud_detection_data: Record<string, unknown> | null;
  created_at: string;
}

export interface Admin {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin";
  admin_sub_role: AdminSubRole | null;
  created_at: string;
  updated_at: string;
}

// GDPR Tables
export interface PrivacyPolicyAcceptance {
  id: string;
  user_id: string;
  policy_version: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  marketing_consent: boolean;
  analytics_consent: boolean;
}

export interface DataExportRequest {
  id: string;
  user_id: string;
  requested_at: string;
  status: DataExportStatus;
  completed_at: string | null;
  download_url: string | null;
  expires_at: string | null;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface DataDeletionRequest {
  id: string;
  user_id: string;
  requested_at: string;
  status: DataDeletionStatus;
  approved_at: string | null;
  approved_by: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface DataAccessLog {
  id: string;
  user_id: string;
  accessed_at: string;
  accessed_by: string | null;
  access_type: DataAccessType;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
}

// Email Tables
export interface EmailQueue {
  id: string;
  to: string;
  subject: string;
  html: string | null;
  text: string | null;
  status: EmailQueueStatus;
  attempts: number;
  max_retries: number;
  next_retry_at: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailQueueLog {
  id: string;
  email_id: string;
  status: string;
  error_message: string | null;
  provider: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface EmailDeliveryLog {
  id: string;
  email_queue_id: string | null;
  recipient_email: string;
  subject: string;
  template_type: string | null;
  provider: string | null;
  status: EmailDeliveryStatus;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: string;
}

// Security & Fraud Tables
export interface SecurityAuditLog {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface SecurityConfig {
  id: string;
  key: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface FraudDetectionConfig {
  id: string;
  config_key: string;
  config_value: Record<string, unknown>;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FraudDetectionLog {
  id: string;
  coupon_code: string;
  ip_address: string;
  user_agent: string | null;
  user_id: string | null;
  risk_score: number;
  action: FraudAction;
  reasons: string[];
  patterns: Record<string, unknown> | null;
  created_at: string;
}

export interface SuspiciousPattern {
  id: string;
  pattern_type: PatternType;
  severity: PatternSeverity;
  description: string;
  evidence: Record<string, unknown> | null;
  threshold_value: number | null;
  actual_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Admin Tables
export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Payout Tables
export interface PayoutRequest {
  id: string;
  employee_id: string;
  amount: number;
  payment_method: string;
  payment_details: Record<string, unknown>;
  notes: string | null;
  status: PayoutStatus;
  processed_at: string | null;
  processed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Promotional Code Tables
export interface PromotionalCodeUsage {
  id: string;
  user_id: string;
  code: string;
  discount_percent: number;
  plan_id: string | null;
  subscription_id: string | null;
  created_at: string;
}

// Webhook Tables
export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// View Types
export interface AdminCouponAnalytics {
  coupon_code: string | null;
  total_uses: number | null;
  total_discount_given: number | null;
  total_revenue: number | null;
  last_used: string | null;
  employee_id: string | null;
  employee_name: string | null;
}

// Database type for Supabase client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profile>;
      };
      letters: {
        Row: Letter;
        Insert: Omit<Letter, "id" | "created_at" | "updated_at" | "claimer"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Letter, "claimer">>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Subscription>;
      };
      employee_coupons: {
        Row: EmployeeCoupon;
        Insert: Omit<EmployeeCoupon, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<EmployeeCoupon>;
      };
      commissions: {
        Row: Commission;
        Insert: Omit<Commission, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Commission>;
      };
      letter_audit_trail: {
        Row: LetterAuditTrail;
        Insert: Omit<LetterAuditTrail, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<LetterAuditTrail>;
      };
      coupon_usage: {
        Row: CouponUsage;
        Insert: Omit<CouponUsage, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<CouponUsage>;
      };
      privacy_policy_acceptances: {
        Row: PrivacyPolicyAcceptance;
        Insert: Omit<PrivacyPolicyAcceptance, "id" | "accepted_at"> & {
          id?: string;
          accepted_at?: string;
        };
        Update: Partial<PrivacyPolicyAcceptance>;
      };
      data_export_requests: {
        Row: DataExportRequest;
        Insert: Omit<DataExportRequest, "id" | "requested_at"> & {
          id?: string;
          requested_at?: string;
        };
        Update: Partial<DataExportRequest>;
      };
      data_deletion_requests: {
        Row: DataDeletionRequest;
        Insert: Omit<DataDeletionRequest, "id" | "requested_at"> & {
          id?: string;
          requested_at?: string;
        };
        Update: Partial<DataDeletionRequest>;
      };
      data_access_logs: {
        Row: DataAccessLog;
        Insert: Omit<DataAccessLog, "id" | "accessed_at"> & {
          id?: string;
          accessed_at?: string;
        };
        Update: Partial<DataAccessLog>;
      };
      email_queue: {
        Row: EmailQueue;
        Insert: Omit<EmailQueue, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<EmailQueue>;
      };
      email_queue_logs: {
        Row: EmailQueueLog;
        Insert: Omit<EmailQueueLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<EmailQueueLog>;
      };
      email_delivery_log: {
        Row: EmailDeliveryLog;
        Insert: Omit<EmailDeliveryLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<EmailDeliveryLog>;
      };
      security_audit_log: {
        Row: SecurityAuditLog;
        Insert: Omit<SecurityAuditLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<SecurityAuditLog>;
      };
      security_config: {
        Row: SecurityConfig;
        Insert: Omit<SecurityConfig, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<SecurityConfig>;
      };
      fraud_detection_config: {
        Row: FraudDetectionConfig;
        Insert: Omit<
          FraudDetectionConfig,
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<FraudDetectionConfig>;
      };
      fraud_detection_logs: {
        Row: FraudDetectionLog;
        Insert: Omit<FraudDetectionLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<FraudDetectionLog>;
      };
      suspicious_patterns: {
        Row: SuspiciousPattern;
        Insert: Omit<SuspiciousPattern, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<SuspiciousPattern>;
      };
      admin_audit_log: {
        Row: AdminAuditLog;
        Insert: Omit<AdminAuditLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AdminAuditLog>;
      };
      payout_requests: {
        Row: PayoutRequest;
        Insert: Omit<PayoutRequest, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<PayoutRequest>;
      };
      promotional_code_usage: {
        Row: PromotionalCodeUsage;
        Insert: Omit<PromotionalCodeUsage, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<PromotionalCodeUsage>;
      };
      webhook_events: {
        Row: WebhookEvent;
        Insert: Omit<WebhookEvent, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<WebhookEvent>;
      };
    };
    Views: {
      admin_coupon_analytics: {
        Row: AdminCouponAnalytics;
      };
    };
    Enums: {
      user_role: UserRole;
      admin_sub_role: AdminSubRole;
      letter_status: LetterStatus;
      subscription_status: SubscriptionStatus;
      commission_status: CommissionStatus;
    };
  };
}
