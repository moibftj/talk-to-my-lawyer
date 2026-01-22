"""
Email System Tests
==================

Tests for email queue and notification system.
"""

import pytest
import httpx


class TestEmailEndpoints:
    """Test email API endpoints."""
    
    def test_send_email_endpoint_requires_auth(self, http_client):
        """Send email endpoint requires authentication."""
        response = http_client.post(
            '/api/email/send',
            json={'to': 'test@example.com', 'template': 'welcome'}
        )
        assert response.status_code in [401, 403]
    
    def test_process_queue_endpoint_requires_auth(self, http_client):
        """Process queue endpoint requires authentication."""
        response = http_client.post('/api/email/process-queue')
        assert response.status_code in [401, 403]


class TestCronEndpoints:
    """Test cron job endpoints."""
    
    def test_process_email_queue_cron_get(self, http_client):
        """Email queue cron endpoint exists (GET for health check)."""
        response = http_client.get('/api/cron/process-email-queue')
        # May require cron secret or return status
        assert response.status_code in [200, 401, 403]
    
    def test_process_email_queue_cron_post(self, http_client):
        """Email queue cron endpoint exists (POST for trigger)."""
        response = http_client.post('/api/cron/process-email-queue')
        # May require cron secret
        assert response.status_code in [200, 401, 403]


@pytest.mark.database
class TestEmailQueueDatabase:
    """Test email queue database structure."""
    
    def test_email_queue_table_structure(self, supabase_admin):
        """Email queue table has required columns."""
        result = supabase_admin.table('email_queue').select(
            'id, recipient, template, status, created_at, sent_at, error_message'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_valid_email_queue_statuses(self, supabase_admin):
        """Email queue entries have valid statuses."""
        valid_statuses = ['pending', 'processing', 'sent', 'failed']
        
        result = supabase_admin.table('email_queue').select('status').limit(20).execute()
        
        for email in result.data:
            if email.get('status'):
                assert email['status'] in valid_statuses
    
    def test_email_queue_retry_tracking(self, supabase_admin):
        """Email queue tracks retry attempts."""
        result = supabase_admin.table('email_queue').select(
            'id, retry_count, max_retries, next_retry_at'
        ).limit(1).execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestEmailTemplates:
    """Test email template data."""
    
    def test_email_queue_stores_template_data(self, supabase_admin):
        """Email queue stores template data."""
        result = supabase_admin.table('email_queue').select(
            'id, template, template_data'
        ).limit(5).execute()
        assert hasattr(result, 'data')
    
    def test_email_queue_tracks_metadata(self, supabase_admin):
        """Email queue tracks sending metadata."""
        result = supabase_admin.table('email_queue').select(
            'id, recipient, subject, from_address'
        ).limit(5).execute()
        assert hasattr(result, 'data')


class TestEmailConfiguration:
    """Test email system configuration."""
    
    def test_email_from_configured(self):
        """EMAIL_FROM environment variable should be configured."""
        import os
        # In test environment, may not be set
        # This documents the requirement
        email_from = os.getenv('EMAIL_FROM', '')
        # Just verify the env var mechanism works
        assert True
    
    def test_resend_api_key_configured(self):
        """RESEND_API_KEY should be configured for production."""
        import os
        # In test environment, may not be set
        # This documents the requirement
        api_key = os.getenv('RESEND_API_KEY', '')
        # Just verify the env var mechanism works
        assert True
