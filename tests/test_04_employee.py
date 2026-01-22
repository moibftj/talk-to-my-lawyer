"""
Employee Dashboard Tests
========================

Tests for employee-specific functionality.
"""

import pytest
import httpx


class TestEmployeePages:
    """Test employee dashboard pages."""
    
    def test_employee_settings_requires_auth(self, http_client):
        """Employee settings page requires authentication."""
        response = http_client.get('/dashboard/employee-settings', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_commissions_page_requires_auth(self, http_client):
        """Commissions page requires authentication."""
        response = http_client.get('/dashboard/commissions', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_referrals_page_requires_auth(self, http_client):
        """Referrals page requires authentication."""
        response = http_client.get('/dashboard/referrals', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_payouts_page_requires_auth(self, http_client):
        """Payouts page requires authentication."""
        response = http_client.get('/dashboard/payouts', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]


class TestEmployeeAPIEndpoints:
    """Test employee-specific API endpoints."""
    
    def test_referral_link_requires_auth(self, http_client):
        """Referral link endpoint requires authentication."""
        response = http_client.get('/api/employee/referral-link')
        assert response.status_code in [401, 403]
    
    def test_payouts_endpoint_requires_auth(self, http_client):
        """Payouts endpoint requires authentication."""
        response = http_client.get('/api/employee/payouts')
        assert response.status_code in [401, 403]
    
    def test_payouts_post_requires_auth(self, http_client):
        """Payout request requires authentication."""
        response = http_client.post(
            '/api/employee/payouts',
            json={'amount': 100}
        )
        assert response.status_code in [401, 403]


@pytest.mark.database
class TestEmployeeDatabase:
    """Test employee-related database operations."""
    
    def test_employee_coupons_table_exists(self, supabase_admin):
        """Employee coupons table should exist."""
        result = supabase_admin.table('employee_coupons').select('id, code, employee_id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_commissions_table_exists(self, supabase_admin):
        """Commissions table should exist."""
        result = supabase_admin.table('commissions').select('id, employee_id, status').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_coupon_usage_table_exists(self, supabase_admin):
        """Coupon usage table should exist."""
        result = supabase_admin.table('coupon_usage').select('id, coupon_id').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_payout_requests_table_exists(self, supabase_admin):
        """Payout requests table should exist."""
        result = supabase_admin.table('payout_requests').select('id, employee_id, status').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_employee_role_exists(self, supabase_admin):
        """Should be able to query employees."""
        result = supabase_admin.table('profiles').select('id').eq('role', 'employee').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_commission_statuses_valid(self, supabase_admin):
        """Commissions should have valid status values."""
        valid_statuses = ['pending', 'paid']
        
        result = supabase_admin.table('commissions').select('status').limit(10).execute()
        
        for commission in result.data:
            if commission.get('status'):
                assert commission['status'] in valid_statuses


@pytest.mark.database
class TestEmployeeCouponSystem:
    """Test employee coupon system."""
    
    def test_coupon_code_format(self, supabase_admin):
        """Employee coupon codes should follow expected format."""
        result = supabase_admin.table('employee_coupons').select('code').limit(10).execute()
        
        for coupon in result.data:
            code = coupon.get('code', '')
            # Coupon codes should be non-empty strings
            if code:
                assert len(code) >= 4, "Coupon code too short"
                assert len(code) <= 50, "Coupon code too long"
    
    def test_coupon_discount_values(self, supabase_admin):
        """Coupon discounts should be reasonable percentages."""
        result = supabase_admin.table('employee_coupons').select('discount_percent').limit(10).execute()
        
        for coupon in result.data:
            discount = coupon.get('discount_percent')
            if discount is not None:
                assert 0 < discount <= 100, f"Invalid discount: {discount}%"
    
    def test_commission_rate_values(self, supabase_admin):
        """Commission rates should be reasonable percentages."""
        result = supabase_admin.table('employee_coupons').select('commission_rate').limit(10).execute()
        
        for coupon in result.data:
            rate = coupon.get('commission_rate')
            if rate is not None:
                assert 0 < rate <= 50, f"Invalid commission rate: {rate}%"
