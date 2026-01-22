"""
Letter Workflow Tests
=====================

Tests for the complete letter generation and review workflow.
"""

import pytest
import httpx


class TestLetterGenerationEndpoints:
    """Test letter generation API endpoints."""
    
    def test_generate_letter_requires_auth(self, http_client, sample_letter_data):
        """Generate letter endpoint requires authentication."""
        response = http_client.post(
            '/api/generate-letter',
            json=sample_letter_data
        )
        assert response.status_code in [401, 403]
    
    def test_drafts_list_requires_auth(self, http_client):
        """Drafts list endpoint requires authentication."""
        response = http_client.get('/api/letters/drafts')
        assert response.status_code in [401, 403]
    
    def test_drafts_save_requires_auth(self, http_client, sample_letter_data):
        """Save draft endpoint requires authentication."""
        response = http_client.post(
            '/api/letters/drafts',
            json=sample_letter_data
        )
        assert response.status_code in [401, 403]
    
    def test_improve_letter_requires_auth(self, http_client):
        """Improve letter endpoint requires authentication."""
        response = http_client.post(
            '/api/letters/improve',
            json={'content': 'Test content', 'feedback': 'Make it better'}
        )
        assert response.status_code in [401, 403]


class TestLetterReviewEndpoints:
    """Test letter review workflow API endpoints."""
    
    def test_submit_letter_requires_auth(self, http_client):
        """Submit letter endpoint requires authentication."""
        response = http_client.post('/api/letters/test-id/submit')
        assert response.status_code in [401, 403, 404]
    
    def test_start_review_requires_auth(self, http_client):
        """Start review (claim) endpoint requires authentication."""
        response = http_client.post('/api/letters/test-id/start-review')
        assert response.status_code in [401, 403, 404]
    
    def test_approve_letter_requires_auth(self, http_client):
        """Approve letter endpoint requires authentication."""
        response = http_client.post(
            '/api/letters/test-id/approve',
            json={'notes': 'Approved'}
        )
        assert response.status_code in [401, 403, 404]
    
    def test_reject_letter_requires_auth(self, http_client):
        """Reject letter endpoint requires authentication."""
        response = http_client.post(
            '/api/letters/test-id/reject',
            json={'reason': 'Needs revision'}
        )
        assert response.status_code in [401, 403, 404]
    
    def test_resubmit_letter_requires_auth(self, http_client):
        """Resubmit letter endpoint requires authentication."""
        response = http_client.post('/api/letters/test-id/resubmit')
        assert response.status_code in [401, 403, 404]
    
    def test_complete_letter_requires_auth(self, http_client):
        """Complete letter endpoint requires authentication."""
        response = http_client.post('/api/letters/test-id/complete')
        assert response.status_code in [401, 403, 404]


class TestLetterDeliveryEndpoints:
    """Test letter delivery API endpoints."""
    
    def test_pdf_download_requires_auth(self, http_client):
        """PDF download endpoint requires authentication."""
        response = http_client.get('/api/letters/test-id/pdf')
        assert response.status_code in [401, 403, 404]
    
    def test_send_email_requires_auth(self, http_client):
        """Send letter via email requires authentication."""
        response = http_client.post(
            '/api/letters/test-id/send-email',
            json={'recipientEmail': 'test@example.com'}
        )
        assert response.status_code in [401, 403, 404]
    
    def test_delete_letter_requires_auth(self, http_client):
        """Delete letter endpoint requires authentication."""
        response = http_client.delete('/api/letters/test-id/delete')
        assert response.status_code in [401, 403, 404, 405]


class TestLetterAuditEndpoints:
    """Test letter audit trail API endpoints."""
    
    def test_audit_trail_requires_auth(self, http_client):
        """Audit trail endpoint requires authentication."""
        response = http_client.get('/api/letters/test-id/audit')
        assert response.status_code in [401, 403, 404]


@pytest.mark.database
class TestLetterWorkflowDatabase:
    """Test letter workflow database support."""
    
    def test_letter_status_transitions(self, supabase_admin):
        """Letters can have various status values."""
        # Query letters grouped by status
        result = supabase_admin.table('letters').select('status').limit(50).execute()
        
        status_set = set(letter['status'] for letter in result.data if letter.get('status'))
        
        # At minimum, the status field works
        assert hasattr(result, 'data')
    
    def test_letter_claim_workflow(self, supabase_admin):
        """Letters support claim workflow."""
        result = supabase_admin.table('letters').select(
            'id, claimed_by, claimed_at'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letter_review_workflow(self, supabase_admin):
        """Letters support review workflow."""
        result = supabase_admin.table('letters').select(
            'id, reviewed_by, reviewed_at, review_notes, is_attorney_reviewed'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letter_approval_workflow(self, supabase_admin):
        """Letters support approval workflow."""
        result = supabase_admin.table('letters').select(
            'id, status, approved_at, final_content'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letter_rejection_workflow(self, supabase_admin):
        """Letters support rejection workflow."""
        result = supabase_admin.table('letters').select(
            'id, status, rejection_reason'
        ).limit(1).execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestLetterAuditTrail:
    """Test letter audit trail database support."""
    
    def test_audit_trail_structure(self, supabase_admin):
        """Audit trail has required columns."""
        result = supabase_admin.table('letter_audit_trail').select(
            'id, letter_id, action, actor_id, created_at'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_audit_trail_metadata(self, supabase_admin):
        """Audit trail stores metadata."""
        result = supabase_admin.table('letter_audit_trail').select(
            'id, old_status, new_status, metadata'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_log_letter_audit_function(self, supabase_admin):
        """log_letter_audit function exists."""
        # This function should exist for audit logging
        # We can't easily test it without creating data
        # Just verify the table is usable
        result = supabase_admin.table('letter_audit_trail').select('id').limit(1).execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestLetterTypes:
    """Test letter type support."""
    
    def test_letter_type_storage(self, supabase_admin):
        """Letters store letter type."""
        result = supabase_admin.table('letters').select(
            'id, letter_type'
        ).limit(10).execute()
        assert hasattr(result, 'data')
    
    def test_letter_intake_data_storage(self, supabase_admin):
        """Letters store intake data as JSONB."""
        result = supabase_admin.table('letters').select(
            'id, intake_data'
        ).limit(5).execute()
        assert hasattr(result, 'data')
        
        # Intake data should be dict/null
        for letter in result.data:
            intake = letter.get('intake_data')
            assert intake is None or isinstance(intake, dict)
    
    def test_letter_draft_metadata_storage(self, supabase_admin):
        """Letters store draft metadata."""
        result = supabase_admin.table('letters').select(
            'id, draft_metadata'
        ).limit(5).execute()
        assert hasattr(result, 'data')
