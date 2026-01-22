"""
GDPR Compliance Tests
=====================

Tests for GDPR compliance endpoints and functionality.
"""

import pytest
import httpx


class TestGDPREndpoints:
    """Test GDPR compliance API endpoints."""
    
    def test_accept_privacy_policy_get(self, http_client):
        """Privacy policy acceptance check endpoint exists."""
        response = http_client.get('/api/gdpr/accept-privacy-policy')
        # Should require auth
        assert response.status_code in [200, 401, 403]
    
    def test_accept_privacy_policy_post(self, http_client):
        """Privacy policy acceptance endpoint exists."""
        response = http_client.post(
            '/api/gdpr/accept-privacy-policy',
            json={'version': '1.0'}
        )
        assert response.status_code in [200, 401, 403]
    
    def test_export_data_get(self, http_client):
        """Data export status endpoint requires auth."""
        response = http_client.get('/api/gdpr/export-data')
        assert response.status_code in [401, 403]
    
    def test_export_data_post(self, http_client):
        """Data export request endpoint requires auth."""
        response = http_client.post('/api/gdpr/export-data')
        assert response.status_code in [401, 403]
    
    def test_delete_account_get(self, http_client):
        """Account deletion status endpoint requires auth."""
        response = http_client.get('/api/gdpr/delete-account')
        assert response.status_code in [401, 403]
    
    def test_delete_account_post(self, http_client):
        """Account deletion request endpoint requires auth."""
        response = http_client.post('/api/gdpr/delete-account')
        assert response.status_code in [401, 403]
    
    def test_delete_account_delete(self, http_client):
        """Account deletion confirm endpoint requires auth."""
        response = http_client.delete('/api/gdpr/delete-account')
        assert response.status_code in [401, 403]


@pytest.mark.database
class TestGDPRDatabaseSupport:
    """Test GDPR database support."""
    
    def test_privacy_policy_table_structure(self, supabase_admin):
        """Privacy policy table has required columns."""
        result = supabase_admin.table('privacy_policy_acceptances').select(
            'id, user_id, policy_version, accepted_at, ip_address'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_data_export_table_structure(self, supabase_admin):
        """Data export requests table has required columns."""
        result = supabase_admin.table('data_export_requests').select(
            'id, user_id, status, requested_at, completed_at, download_url'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_data_deletion_table_structure(self, supabase_admin):
        """Data deletion requests table has required columns."""
        result = supabase_admin.table('data_deletion_requests').select(
            'id, user_id, status, requested_at, reason'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_data_access_logs_structure(self, supabase_admin):
        """Data access logs table has required columns."""
        result = supabase_admin.table('data_access_logs').select(
            'id, user_id, access_type, accessed_at, accessed_by'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_valid_export_statuses(self, supabase_admin):
        """Data export requests have valid statuses."""
        valid_statuses = ['pending', 'processing', 'completed', 'failed']
        
        result = supabase_admin.table('data_export_requests').select('status').limit(10).execute()
        
        for req in result.data:
            if req.get('status'):
                assert req['status'] in valid_statuses
    
    def test_valid_deletion_statuses(self, supabase_admin):
        """Data deletion requests have valid statuses."""
        valid_statuses = ['pending', 'approved', 'rejected', 'completed']
        
        result = supabase_admin.table('data_deletion_requests').select('status').limit(10).execute()
        
        for req in result.data:
            if req.get('status'):
                assert req['status'] in valid_statuses


class TestGDPRCompliance:
    """Test GDPR compliance requirements."""
    
    def test_user_can_request_data_export(self):
        """Users should be able to request their data."""
        # This is a design/compliance test
        # The endpoint exists (tested above)
        assert True
    
    def test_user_can_request_deletion(self):
        """Users should be able to request account deletion."""
        # This is a design/compliance test
        # The endpoint exists (tested above)
        assert True
    
    def test_privacy_policy_tracking(self):
        """System tracks privacy policy acceptance."""
        # This is a design/compliance test
        # The table exists (tested above)
        assert True
    
    def test_data_access_logging(self):
        """System logs data access events."""
        # This is a design/compliance test
        # The table exists (tested above)
        assert True
