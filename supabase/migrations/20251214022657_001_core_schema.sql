/*
  # Core Schema for Talk-To-My-Lawyer

  1. New Tables
    - `profiles` - User profiles with role-based access (subscriber, employee, admin)
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique, required)
      - `full_name` (text)
      - `role` (user_role enum: subscriber, employee, admin)
      - `phone` (text)
      - `company_name` (text)
      - `is_super_user` (boolean, for unlimited access)
      - `stripe_customer_id` (text, for Stripe integration)
      - timestamps

    - `employee_coupons` - Employee referral codes with 20% discount
      - `id` (uuid, primary key)
      - `employee_id` (uuid, references profiles, unique per employee)
      - `code` (text, unique coupon code)
      - `discount_percent` (int, default 20)
      - `is_active` (boolean)
      - `usage_count` (int)
      - timestamps

    - `subscriptions` - User subscription plans with letter allowances
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `status` (subscription_status enum)
      - `plan` (text)
      - `plan_type` (text)
      - `price` (numeric)
      - `discount` (numeric)
      - `remaining_letters` (int)
      - `credits_remaining` (int)
      - Stripe fields and timestamps

    - `commissions` - Employee commission tracking (5% per sale)
      - `id` (uuid, primary key)
      - `employee_id` (uuid, references profiles)
      - `subscription_id` (uuid, references subscriptions)
      - `commission_rate` (numeric, default 0.05)
      - `subscription_amount` (numeric)
      - `commission_amount` (numeric)
      - `status` (commission_status enum)
      - timestamps

    - `letters` - Legal letter requests and content
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `title` (text)
      - `status` (letter_status enum)
      - `letter_type` (text)
      - `intake_data` (jsonb)
      - `ai_draft_content` (text)
      - `final_content` (text)
      - `pdf_url` (text)
      - Review fields and timestamps

  2. Security
    - All tables have RLS enabled (policies in next migration)
    - Foreign key constraints with CASCADE delete
    - Check constraints for data integrity

  3. Indexes
    - Performance indexes on frequently queried columns
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('subscriber', 'employee', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE letter_status AS ENUM ('draft', 'generating', 'pending_review', 'under_review', 'approved', 'rejected', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE commission_status AS ENUM ('pending', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role user_role DEFAULT 'subscriber',
    phone TEXT,
    company_name TEXT,
    is_super_user BOOLEAN DEFAULT FALSE,
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    discount_percent INT CHECK (discount_percent >= 0 AND discount_percent <= 100) DEFAULT 20,
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0 CHECK (usage_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status subscription_status DEFAULT 'active',
    plan TEXT DEFAULT 'single_letter',
    plan_type TEXT,
    price NUMERIC(10,2) DEFAULT 299.00 CHECK (price >= 0 AND price <= 99999.99),
    discount NUMERIC(10,2) DEFAULT 0.00 CHECK (discount >= 0),
    coupon_code TEXT,
    remaining_letters INT DEFAULT 0,
    credits_remaining INT DEFAULT 0,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    commission_rate NUMERIC(5,4) DEFAULT 0.05 CHECK (commission_rate >= 0 AND commission_rate <= 1),
    subscription_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subscription_amount >= 0),
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
    status commission_status DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status letter_status DEFAULT 'draft',
    letter_type TEXT,
    intake_data JSONB DEFAULT '{}',
    ai_draft_content TEXT,
    final_content TEXT,
    pdf_url TEXT,
    is_attorney_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_employee_coupons_code ON employee_coupons(code);
CREATE INDEX IF NOT EXISTS idx_employee_coupons_employee ON employee_coupons(employee_id);
CREATE INDEX IF NOT EXISTS idx_letters_user_id ON letters(user_id);
CREATE INDEX IF NOT EXISTS idx_letters_status ON letters(status);
CREATE INDEX IF NOT EXISTS idx_letters_reviewed_at ON letters(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_commissions_employee ON commissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_type ON subscriptions(plan_type);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;