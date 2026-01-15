import type {
  Commission,
  CouponUsage,
  EmployeeCoupon,
  Letter,
  LetterStatus,
  Profile,
  Subscription,
  SubscriptionStatus,
} from "@/lib/database.types"

export type {
  Commission,
  CouponUsage,
  EmployeeCoupon,
  Letter,
  LetterStatus,
  Profile,
  Subscription,
  SubscriptionStatus,
}

// Search params for letters page
export interface LettersSearchParams {
  status?: string
  search?: string
  page?: string
  limit?: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

// Plan types
export interface Plan {
  id: string
  name: string
  price: number
  credits: number
  description: string
  features: string[]
  popular?: boolean
}
