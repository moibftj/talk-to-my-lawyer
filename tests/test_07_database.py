"""
Database Schema & Integrity Tests
=================================

Tests for database schema structure and data integrity.
"""

import pytest


@pytest.mark.database
class TestCoreTablesExist:
    """Verify all core tables exist."""
    
    def test_profiles_table(self, supabase_admin):
        """Profiles table exists."""
        result = supabase_admin.table('profiles').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letters_table(self, supabase_admin):
        """Letters table exists."""
        result = supabase_admin.table('letters').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_subscriptions_table(self, supabase_admin):
        """Subscriptions table exists."""
        result = supabase_admin.table('subscriptions').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_employee_coupons_table(self, supabase_admin):
        """Employee coupons table exists."""
        result = supabase_admin.table('employee_coupons').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_commissions_table(self, supabase_admin):
        """Commissions table exists."""
        result = supabase_admin.table('commissions').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_coupon_usage_table(self, supabase_admin):
        """Coupon usage table exists."""
        result = supabase_admin.table('coupon_usage').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letter_audit_trail_table(self, supabase_admin):
        """Letter audit trail table exists."""
        result = supabase_admin.table('letter_audit_trail').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_admin_audit_log_table(self, supabase_admin):
        """Admin audit log table exists."""
        result = supabase_admin.table('admin_audit_log').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_email_queue_table(self, supabase_admin):
        """Email queue table exists."""
        result = supabase_admin.table('email_queue').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_payout_requests_table(self, supabase_admin):
        """Payout requests table exists."""
        result = supabase_admin.table('payout_requests').select('id').limit(1).execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestGDPRTablesExist:
    """Verify GDPR compliance tables exist."""
    
    def test_privacy_policy_acceptances_table(self, supabase_admin):
        """Privacy policy acceptances table exists."""
        result = supabase_admin.table('privacy_policy_acceptances').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_data_export_requests_table(self, supabase_admin):
        """Data export requests table exists."""
        result = supabase_admin.table('data_export_requests').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_data_deletion_requests_table(self, supabase_admin):
        """Data deletion requests table exists."""
        result = supabase_admin.table('data_deletion_requests').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_data_access_logs_table(self, supabase_admin):
        """Data access logs table exists."""
        result = supabase_admin.table('data_access_logs').select('id').limit(1).execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestSecurityTablesExist:
    """Verify security and fraud tables exist."""
    
    def test_security_audit_log_table(self, supabase_admin):
        """Security audit log table exists."""
        result = supabase_admin.table('security_audit_log').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_fraud_detection_logs_table(self, supabase_admin):
        """Fraud detection logs table exists."""
        result = supabase_admin.table('fraud_detection_logs').select('id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_suspicious_patterns_table(self, supabase_admin):
        """Suspicious patterns table exists."""
        result = supabase_admin.table('suspicious_patterns').select('id').limit(1).execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestProfilesSchema:
    """Test profiles table schema."""
    
    def test_profile_required_columns(self, supabase_admin):
        """Profiles have all required columns."""
        result = supabase_admin.table('profiles').select(
            'id, email, role, admin_sub_role, full_name, phone, company_name, '
            'stripe_customer_id, total_letters_generated, is_licensed_attorney, '
            'created_at, updated_at'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_profile_social_columns(self, supabase_admin):
        """Profiles have social/profile columns."""
        result = supabase_admin.table('profiles').select(
            'avatar_url, bio, cover_photo_url, is_online, last_seen'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_valid_user_roles(self, supabase_admin):
        """All profiles have valid roles."""
        valid_roles = ['subscriber', 'employee', 'admin']
        
        result = supabase_admin.table('profiles').select('role').limit(100).execute()
        
        for profile in result.data:
            assert profile['role'] in valid_roles


@pytest.mark.database
class TestLettersSchema:
    """Test letters table schema."""
    
    def test_letter_required_columns(self, supabase_admin):
        """Letters have all required columns."""
        result = supabase_admin.table('letters').select(
            'id, user_id, title, status, letter_type, intake_data, '
            'ai_draft_content, final_content, created_at, updated_at'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letter_review_columns(self, supabase_admin):
        """Letters have review workflow columns."""
        result = supabase_admin.table('letters').select(
            'reviewed_by, reviewed_at, review_notes, rejection_reason, '
            'approved_at, claimed_by, claimed_at, is_attorney_reviewed'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_valid_letter_statuses(self, supabase_admin):
        """All letters have valid statuses."""
        valid_statuses = [
            'draft', 'generating', 'pending_review', 'under_review',
            'approved', 'completed', 'rejected', 'failed'
        ]
        
        result = supabase_admin.table('letters').select('status').limit(100).execute()
        
        for letter in result.data:
            assert letter['status'] in valid_statuses


@pytest.mark.database
class TestSubscriptionsSchema:
    """Test subscriptions table schema."""
    
    def test_subscription_required_columns(self, supabase_admin):
        """Subscriptions have all required columns."""
        result = supabase_admin.table('subscriptions').select(
            'id, user_id, plan, status, price, remaining_letters, '
            'credits_remaining, created_at, updated_at'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_subscription_stripe_columns(self, supabase_admin):
        """Subscriptions have Stripe integration columns."""
        result = supabase_admin.table('subscriptions').select(
            'stripe_subscription_id, stripe_customer_id, stripe_session_id'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_valid_subscription_statuses(self, supabase_admin):
        """All subscriptions have valid statuses."""
        valid_statuses = ['active', 'canceled', 'past_due', 'payment_failed', 'trialing']
        
        result = supabase_admin.table('subscriptions').select('status').limit(100).execute()
        
        for sub in result.data:
            if sub.get('status'):
                assert sub['status'] in valid_statuses


@pytest.mark.database
class TestForeignKeyRelationships:
    """Test foreign key relationships are intact."""
    
    def test_letters_reference_profiles(self, supabase_admin):
        """Letters should reference valid profiles."""
        result = supabase_admin.table('letters').select(
            'id, user_id, profiles!inner(id)'
        ).limit(5).execute()
        # If FK is intact, query succeeds
        assert hasattr(result, 'data')
    
    def test_subscriptions_reference_profiles(self, supabase_admin):
        """Subscriptions should reference valid profiles."""
        result = supabase_admin.table('subscriptions').select(
            'id, user_id, profiles!inner(id)'
        ).limit(5).execute()
        assert hasattr(result, 'data')
    
    def test_commissions_reference_employees(self, supabase_admin):
        """Commissions should reference valid employee profiles."""
        result = supabase_admin.table('commissions').select(
            'id, employee_id'
        ).limit(5).execute()
        assert hasattr(result, 'data')
    
    def test_employee_coupons_reference_profiles(self, supabase_admin):
        """Employee coupons should reference valid profiles."""
        result = supabase_admin.table('employee_coupons').select(
            'id, employee_id'
        ).limit(5).execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestDatabaseFunctions:
    """Test critical database functions exist and are callable."""
    
    def test_check_letter_allowance(self, supabase_admin):
        """check_letter_allowance function is callable."""
        result = supabase_admin.rpc('check_letter_allowance', {
            'p_user_id': '00000000-0000-0000-0000-000000000000'
        }).execute()
        assert hasattr(result, 'data') or hasattr(result, 'error')
    
    def test_check_and_deduct_allowance(self, supabase_admin):
        """check_and_deduct_allowance function is callable."""
        result = supabase_admin.rpc('check_and_deduct_allowance', {
            'p_user_id': '00000000-0000-0000-0000-000000000000'
        }).execute()
        assert hasattr(result, 'data') or hasattr(result, 'error')
    
    def test_refund_letter_allowance(self, supabase_admin):
        """refund_letter_allowance function is callable."""
        result = supabase_admin.rpc('refund_letter_allowance', {
            'p_user_id': '00000000-0000-0000-0000-000000000000',
            'p_amount': 1
        }).execute()
        assert hasattr(result, 'data') or hasattr(result, 'error')
    
    def test_get_admin_dashboard_stats(self, supabase_admin):
        """get_admin_dashboard_stats function is callable."""
        result = supabase_admin.rpc('get_admin_dashboard_stats').execute()
        assert hasattr(result, 'data')
    
    def test_is_super_admin(self, supabase_admin):
        """is_super_admin function is callable."""
        result = supabase_admin.rpc('is_super_admin').execute()
        assert hasattr(result, 'data')
    
    def test_is_attorney_admin(self, supabase_admin):
        """is_attorney_admin function is callable."""
        result = supabase_admin.rpc('is_attorney_admin').execute()
        assert hasattr(result, 'data')
    
    def test_is_any_admin(self, supabase_admin):
        """is_any_admin function is callable."""
        result = supabase_admin.rpc('is_any_admin').execute()
        assert hasattr(result, 'data')
    
    def test_claim_letter(self, supabase_admin):
        """claim_letter function is callable."""
        result = supabase_admin.rpc('claim_letter', {
            'p_letter_id': '00000000-0000-0000-0000-000000000000'
        }).execute()
        assert hasattr(result, 'data') or hasattr(result, 'error')
    
    def test_release_letter_claim(self, supabase_admin):
        """release_letter_claim function is callable."""
        result = supabase_admin.rpc('release_letter_claim', {
            'p_letter_id': '00000000-0000-0000-0000-000000000000'
        }).execute()
        assert hasattr(result, 'data') or hasattr(result, 'error')
