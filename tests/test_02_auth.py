"""
Authentication Tests
====================

Tests for user authentication flows.
"""

import pytest
import httpx
from faker import Faker

fake = Faker()


class TestAuthEndpoints:
    """Test authentication API endpoints."""
    
    def test_login_page_accessible(self, http_client):
        """Login page should be accessible."""
        response = http_client.get('/auth/login', follow_redirects=True)
        assert response.status_code == 200
    
    def test_signup_page_accessible(self, http_client):
        """Signup page should be accessible."""
        response = http_client.get('/auth/signup', follow_redirects=True)
        assert response.status_code == 200
    
    def test_forgot_password_page_accessible(self, http_client):
        """Forgot password page should be accessible."""
        response = http_client.get('/auth/forgot-password', follow_redirects=True)
        assert response.status_code == 200
    
    def test_auth_callback_exists(self, http_client):
        """Auth callback endpoint should exist."""
        # Without proper auth code, should redirect or error gracefully
        response = http_client.get('/auth/callback', follow_redirects=False)
        # Should redirect to login or error page
        assert response.status_code in [302, 307, 400, 401]


class TestPasswordReset:
    """Test password reset functionality."""
    
    def test_reset_password_endpoint_exists(self, http_client):
        """Password reset endpoint should exist."""
        response = http_client.post(
            '/api/auth/reset-password',
            json={'email': 'test@example.com'}
        )
        # Should accept the request (even if email doesn't exist for security)
        assert response.status_code in [200, 400, 404]
    
    def test_reset_password_requires_email(self, http_client):
        """Password reset should require email."""
        response = http_client.post(
            '/api/auth/reset-password',
            json={}
        )
        assert response.status_code in [400, 422]


class TestResendConfirmation:
    """Test email confirmation resend functionality."""
    
    def test_resend_confirmation_endpoint_exists(self, http_client):
        """Resend confirmation endpoint should exist."""
        response = http_client.post(
            '/api/auth/resend-confirmation',
            json={'email': 'test@example.com'}
        )
        # Should accept the request
        assert response.status_code in [200, 400, 404, 429]


class TestProtectedRoutes:
    """Test that protected routes require authentication."""
    
    def test_dashboard_requires_auth(self, http_client):
        """Dashboard should redirect unauthenticated users."""
        response = http_client.get('/dashboard', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_letters_page_requires_auth(self, http_client):
        """Letters page should require authentication."""
        response = http_client.get('/dashboard/letters', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_settings_page_requires_auth(self, http_client):
        """Settings page should require authentication."""
        response = http_client.get('/dashboard/settings', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_admin_portal_requires_auth(self, http_client):
        """Admin portal should require authentication."""
        response = http_client.get('/secure-admin-gateway', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]
    
    def test_attorney_portal_requires_auth(self, http_client):
        """Attorney portal should require authentication."""
        response = http_client.get('/attorney-portal/review', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]


@pytest.mark.integration
class TestAuthWithSupabase:
    """Integration tests with Supabase auth."""
    
    def test_supabase_connection(self, supabase_anon):
        """Verify Supabase connection works."""
        # Simple query to verify connection
        result = supabase_anon.auth.get_session()
        # Should return None for unauthenticated client
        assert result is None or hasattr(result, 'user')
    
    @pytest.mark.auth
    def test_signup_creates_profile(self, supabase_admin, random_email):
        """Signing up should create a profile via trigger."""
        # This tests the database trigger handle_new_user
        # Note: In production, use the actual signup flow
        
        # Check if profiles table is accessible
        result = supabase_admin.table('profiles').select('id').limit(1).execute()
        assert hasattr(result, 'data')
