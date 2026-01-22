"""
Super Admin (System Admin) Tests
=================================

Tests for super admin (super_admin role) functionality.
Full system access including analytics, users, coupons, and letters.
"""

import pytest
import httpx


class TestAdminPortalPages:
    """Test super admin portal pages."""
    
    def test_admin_login_page_accessible(self, http_client):
        """Admin login page should be accessible."""
        response = http_client.get('/secure-admin-gateway/login', follow_redirects=True)
        assert response.status_code == 200
    
    def test_admin_dashboard_requires_auth(self, http_client):
        """Admin dashboard requires authentication."""
        response = http_client.get('/secure-admin-gateway/dashboard', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_admin_analytics_requires_auth(self, http_client):
        """Analytics page requires authentication."""
        response = http_client.get('/secure-admin-gateway/dashboard/analytics', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_admin_users_requires_auth(self, http_client):
        """Users management page requires authentication."""
        response = http_client.get('/secure-admin-gateway/dashboard/users', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_admin_coupons_requires_auth(self, http_client):
        """Coupons management page requires authentication."""
        response = http_client.get('/secure-admin-gateway/dashboard/coupons', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_admin_commissions_requires_auth(self, http_client):
        """Commissions management page requires authentication."""
        response = http_client.get('/secure-admin-gateway/dashboard/commissions', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_admin_letters_requires_auth(self, http_client):
        """Letters management page requires authentication."""
        response = http_client.get('/secure-admin-gateway/dashboard/letters', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_admin_all_letters_requires_auth(self, http_client):
        """All letters page requires authentication."""
        response = http_client.get('/secure-admin-gateway/dashboard/all-letters', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_admin_email_queue_requires_auth(self, http_client):
        """Email queue page requires authentication."""
        response = http_client.get('/secure-admin-gateway/dashboard/email-queue', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]


class TestAdminAPIEndpoints:
    """Test super admin API endpoints."""
    
    def test_admin_csrf_endpoint(self, http_client):
        """Admin CSRF endpoint should exist."""
        response = http_client.get('/api/admin/csrf')
        # May return token or require auth
        assert response.status_code in [200, 401, 403]
    
    def test_admin_analytics_api_requires_auth(self, http_client):
        """Analytics API requires authentication."""
        response = http_client.get('/api/admin/analytics')
        assert response.status_code in [401, 403]
    
    def test_admin_letters_api_requires_auth(self, http_client):
        """Admin letters API requires authentication."""
        response = http_client.get('/api/admin/letters')
        assert response.status_code in [401, 403]
    
    def test_admin_coupons_api_requires_auth(self, http_client):
        """Admin coupons API requires authentication."""
        response = http_client.get('/api/admin/coupons')
        assert response.status_code in [401, 403]
    
    def test_admin_email_queue_api_requires_auth(self, http_client):
        """Admin email queue API requires authentication."""
        response = http_client.get('/api/admin/email-queue')
        assert response.status_code in [401, 403]
    
    def test_admin_batch_letters_requires_auth(self, http_client):
        """Batch letters endpoint requires authentication."""
        response = http_client.post(
            '/api/admin/letters/batch',
            json={'action': 'approve', 'letterIds': []}
        )
        assert response.status_code in [401, 403]
    
    def test_admin_create_coupon_requires_auth(self, http_client):
        """Create coupon endpoint requires authentication."""
        response = http_client.post(
            '/api/admin/coupons/create',
            json={'code': 'TEST20', 'discount': 20}
        )
        assert response.status_code in [401, 403]


class TestAdminAuthEndpoints:
    """Test admin authentication endpoints."""
    
    def test_admin_login_endpoint_exists(self, http_client):
        """Admin login endpoint should exist."""
        response = http_client.post(
            '/api/admin-auth/login',
            json={'email': 'test@example.com', 'password': 'test'}
        )
        # Should reject invalid credentials but endpoint exists
        assert response.status_code in [200, 400, 401, 403]
    
    def test_admin_logout_endpoint_exists(self, http_client):
        """Admin logout endpoint should exist."""
        response = http_client.post('/api/admin-auth/logout')
        # May require auth or accept unauthenticated
        assert response.status_code in [200, 302, 401]


@pytest.mark.database
class TestSuperAdminDatabase:
    """Test super admin database operations."""
    
    def test_super_admin_role_exists(self, supabase_admin):
        """Should be able to query super admins."""
        result = supabase_admin.table('profiles').select('id, admin_sub_role').eq('role', 'admin').eq('admin_sub_role', 'super_admin').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_admin_audit_log_table_exists(self, supabase_admin):
        """Admin audit log table should exist."""
        result = supabase_admin.table('admin_audit_log').select('id, admin_id, action').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_is_super_admin_function_exists(self, supabase_admin):
        """is_super_admin() function should exist."""
        result = supabase_admin.rpc('is_super_admin').execute()
        assert hasattr(result, 'data')
    
    def test_is_system_admin_function_exists(self, supabase_admin):
        """is_system_admin() function (alias) should exist."""
        result = supabase_admin.rpc('is_system_admin').execute()
        assert hasattr(result, 'data')
    
    def test_is_any_admin_function_exists(self, supabase_admin):
        """is_any_admin() function should exist."""
        result = supabase_admin.rpc('is_any_admin').execute()
        assert hasattr(result, 'data')
    
    def test_get_admin_dashboard_stats_function_exists(self, supabase_admin):
        """get_admin_dashboard_stats() function should exist."""
        result = supabase_admin.rpc('get_admin_dashboard_stats').execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestAdminSubRoleConsistency:
    """Test admin sub-role naming consistency (super_admin everywhere)."""
    
    def test_admin_sub_role_enum_values(self, supabase_admin):
        """Verify admin_sub_role uses correct enum values."""
        # Query existing admins
        result = supabase_admin.table('profiles').select('admin_sub_role').eq('role', 'admin').limit(10).execute()
        
        valid_sub_roles = ['super_admin', 'attorney_admin', None]
        
        for profile in result.data:
            sub_role = profile.get('admin_sub_role')
            assert sub_role in valid_sub_roles, f"Invalid admin_sub_role: {sub_role}"
    
    def test_no_system_admin_in_database(self, supabase_admin):
        """Verify 'system_admin' is not stored (should be 'super_admin')."""
        # This should return empty - system_admin should not exist as a value
        result = supabase_admin.table('profiles').select('id').eq('admin_sub_role', 'system_admin').limit(1).execute()
        
        # Should be empty - system_admin is not a valid enum value
        assert len(result.data) == 0, "Found 'system_admin' in database - should be 'super_admin'"


@pytest.mark.database
class TestSuperAdminPermissions:
    """Test super admin has full access."""
    
    def test_super_admin_can_query_all_profiles(self, supabase_admin):
        """Super admin should access all profiles."""
        result = supabase_admin.table('profiles').select('id, role').limit(10).execute()
        assert hasattr(result, 'data')
    
    def test_super_admin_can_query_all_letters(self, supabase_admin):
        """Super admin should access all letters."""
        result = supabase_admin.table('letters').select('id, status, user_id').limit(10).execute()
        assert hasattr(result, 'data')
    
    def test_super_admin_can_query_all_subscriptions(self, supabase_admin):
        """Super admin should access all subscriptions."""
        result = supabase_admin.table('subscriptions').select('id, user_id, status').limit(10).execute()
        assert hasattr(result, 'data')
    
    def test_super_admin_can_query_all_commissions(self, supabase_admin):
        """Super admin should access all commissions."""
        result = supabase_admin.table('commissions').select('id, employee_id, status').limit(10).execute()
        assert hasattr(result, 'data')
    
    def test_super_admin_can_query_email_queue(self, supabase_admin):
        """Super admin should access email queue."""
        result = supabase_admin.table('email_queue').select('id, status').limit(10).execute()
        assert hasattr(result, 'data')
    
    def test_super_admin_can_query_audit_logs(self, supabase_admin):
        """Super admin should access audit logs."""
        result = supabase_admin.table('admin_audit_log').select('id, action').limit(10).execute()
        assert hasattr(result, 'data')
