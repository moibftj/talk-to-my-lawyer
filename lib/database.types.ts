export type UserRole = 'subscriber' | 'employee' | 'admin'
export type AdminSubRole = 'super_admin' | 'attorney_admin'

export type LetterStatus =
  | 'draft'
  | 'generating'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'failed'

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due'
export type CommissionStatus = 'pending' | 'paid'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  admin_sub_role: AdminSubRole | null
  phone: string | null
  company_name: string | null
  free_trial_used: boolean
  stripe_customer_id: string | null
  total_letters_generated: number
  is_licensed_attorney: boolean
  created_at: string
  updated_at: string
}

export interface Letter {
  id: string
  user_id: string
  title: string
  letter_type: string | null
  status: LetterStatus
  intake_data: Record<string, any> | null
  ai_draft_content: string | null
  final_content: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  rejection_reason: string | null
  approved_at: string | null
  draft_metadata: Record<string, any> | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan: string | null
  plan_type: string | null
  status: SubscriptionStatus | null
  price: number | null
  discount: number | null
  coupon_code: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  remaining_letters: number | null
  letters_remaining: number | null
  letters_per_period: number | null
  credits_remaining: number | null
  last_reset_at: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeCoupon {
  id: string
  employee_id: string | null
  code: string
  description: string | null
  discount_percent: number | null
  is_active: boolean | null
  usage_count: number | null
  max_uses: number | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface Commission {
  id: string
  employee_id: string
  subscription_id: string
  subscription_amount: number
  commission_rate: number | null
  commission_amount: number
  status: CommissionStatus | null
  paid_at: string | null
  created_at: string
}

export interface LetterAuditTrail {
  id: string
  letter_id: string
  action: string
  performed_by: string | null
  old_status: string | null
  new_status: string | null
  notes: string | null
  metadata: Record<string, any> | null
  created_at: string
}

export interface CouponUsage {
  id: string
  user_id: string
  employee_id: string | null
  coupon_code: string
  discount_percent: number
  amount_before: number
  amount_after: number
  ip_address: string | null
  user_agent: string | null
  fingerprint: string | null
  fraud_risk_score: number | null
  fraud_detection_data: Record<string, any> | null
  created_at: string
}

export interface Admin {
  id: string
  email: string
  full_name: string | null
  role: 'admin'
  admin_sub_role: AdminSubRole | null
  created_at: string
  updated_at: string
}
