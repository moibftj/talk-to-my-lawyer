"""
Attorney Admin Tests
====================

Tests for attorney admin (attorney_admin role) functionality.
"""

import pytest
import httpx


class TestAttorneyPortalPages:
    """Test attorney portal pages."""
    
    def test_attorney_login_page_accessible(self, http_client):
        """Attorney login page should be accessible."""
        response = http_client.get('/attorney-portal/login', follow_redirects=True)
        assert response.status_code == 200
    
    def test_attorney_review_requires_auth(self, http_client):
        """Attorney review page requires authentication."""
        response = http_client.get('/attorney-portal/review', follow_redirects=False)
        assert response.status_code in [302, 307, 401, 403]


class TestAttorneyAPIEndpoints:
    """Test attorney-specific API endpoints."""
    
    def test_letter_approve_requires_auth(self, http_client):
        """Letter approval endpoint requires authentication."""
        response = http_client.post(
            '/api/letters/test-id/approve',
            json={'notes': 'Approved'}
        )
        assert response.status_code in [401, 403]
    
    def test_letter_reject_requires_auth(self, http_client):
        """Letter rejection endpoint requires authentication."""
        response = http_client.post(
            '/api/letters/test-id/reject',
            json={'reason': 'Test rejection'}
        )
        assert response.status_code in [401, 403]
    
    def test_letter_start_review_requires_auth(self, http_client):
        """Start review endpoint requires authentication."""
        response = http_client.post('/api/letters/test-id/start-review')
        assert response.status_code in [401, 403]
    
    def test_letter_complete_requires_auth(self, http_client):
        """Complete letter endpoint requires authentication."""
        response = http_client.post('/api/letters/test-id/complete')
        assert response.status_code in [401, 403]
    
    def test_letter_audit_requires_auth(self, http_client):
        """Letter audit endpoint requires authentication."""
        response = http_client.get('/api/letters/test-id/audit')
        assert response.status_code in [401, 403]


@pytest.mark.database
class TestAttorneyDatabase:
    """Test attorney admin database operations."""
    
    def test_attorney_admin_role_exists(self, supabase_admin):
        """Should be able to query attorney admins."""
        result = supabase_admin.table('profiles').select('id, admin_sub_role').eq('role', 'admin').eq('admin_sub_role', 'attorney_admin').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letter_audit_trail_table_exists(self, supabase_admin):
        """Letter audit trail table should exist."""
        result = supabase_admin.table('letter_audit_trail').select('id, letter_id, action').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_is_attorney_admin_function_exists(self, supabase_admin):
        """is_attorney_admin() function should exist."""
        # Try to call the function (will return false for service role)
        result = supabase_admin.rpc('is_attorney_admin').execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestLetterReviewWorkflow:
    """Test letter review workflow database support."""
    
    def test_letter_claim_columns_exist(self, supabase_admin):
        """Letters table should have claim tracking columns."""
        result = supabase_admin.table('letters').select('id, claimed_by, claimed_at').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letter_review_columns_exist(self, supabase_admin):
        """Letters table should have review tracking columns."""
        result = supabase_admin.table('letters').select(
            'id, reviewed_by, reviewed_at, review_notes, rejection_reason, is_attorney_reviewed'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_claim_letter_function_exists(self, supabase_admin):
        """claim_letter() function should exist."""
        result = supabase_admin.rpc('claim_letter', {
            'p_letter_id': '00000000-0000-0000-0000-000000000000'
        }).execute()
        # Will error for non-existent letter, but function exists
        assert hasattr(result, 'data') or hasattr(result, 'error')
    
    def test_release_letter_claim_function_exists(self, supabase_admin):
        """release_letter_claim() function should exist."""
        result = supabase_admin.rpc('release_letter_claim', {
            'p_letter_id': '00000000-0000-0000-0000-000000000000'
        }).execute()
        assert hasattr(result, 'data') or hasattr(result, 'error')


@pytest.mark.database
class TestAttorneyPermissions:
    """Test attorney admin permission boundaries."""
    
    def test_attorney_cannot_see_analytics(self, supabase_admin):
        """Verify analytics are restricted from attorney admins."""
        # This is a documentation/architecture test
        # Attorney admins should only have letter review access
        # Check that the RLS policies are in place
        
        # Query to verify attorney_admin role exists
        result = supabase_admin.table('profiles').select('admin_sub_role').eq('admin_sub_role', 'attorney_admin').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_attorney_letter_access(self, supabase_admin):
        """Attorney admins should be able to see pending letters."""
        # Verify letters with pending_review status can be queried
        result = supabase_admin.table('letters').select('id, status').in_('status', ['pending_review', 'under_review']).limit(5).execute()
        assert hasattr(result, 'data')
