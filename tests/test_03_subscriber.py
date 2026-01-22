"""
Subscriber Dashboard Tests
===========================

Tests for subscriber-specific functionality.
"""

import pytest
import httpx


class TestSubscriberPages:
    """Test subscriber dashboard pages."""
    
    def test_membership_page_accessible(self, http_client):
        """Membership/pricing page should be publicly accessible."""
        response = http_client.get('/membership', follow_redirects=True)
        assert response.status_code == 200
    
    def test_how_it_works_page_accessible(self, http_client):
        """How it works page should be publicly accessible."""
        response = http_client.get('/how-it-works', follow_redirects=True)
        assert response.status_code == 200
    
    def test_faq_page_accessible(self, http_client):
        """FAQ page should be publicly accessible."""
        response = http_client.get('/faq', follow_redirects=True)
        assert response.status_code == 200
    
    def test_contact_page_accessible(self, http_client):
        """Contact page should be publicly accessible."""
        response = http_client.get('/contact', follow_redirects=True)
        assert response.status_code == 200


class TestSubscriptionEndpoints:
    """Test subscription-related API endpoints."""
    
    def test_check_allowance_requires_auth(self, http_client):
        """Check allowance endpoint requires authentication."""
        response = http_client.get('/api/subscriptions/check-allowance')
        assert response.status_code in [401, 403]
    
    def test_billing_history_requires_auth(self, http_client):
        """Billing history endpoint requires authentication."""
        response = http_client.get('/api/subscriptions/billing-history')
        assert response.status_code in [401, 403]
    
    def test_create_checkout_requires_auth(self, http_client):
        """Create checkout endpoint requires authentication."""
        response = http_client.post(
            '/api/create-checkout',
            json={'planId': 'basic'}
        )
        assert response.status_code in [401, 403]


class TestLetterEndpoints:
    """Test letter-related API endpoints."""
    
    def test_generate_letter_requires_auth(self, http_client):
        """Generate letter endpoint requires authentication."""
        response = http_client.post(
            '/api/generate-letter',
            json={'letterType': 'demand_letter', 'title': 'Test'}
        )
        assert response.status_code in [401, 403]
    
    def test_drafts_endpoint_requires_auth(self, http_client):
        """Drafts endpoint requires authentication."""
        response = http_client.get('/api/letters/drafts')
        assert response.status_code in [401, 403]
    
    def test_improve_letter_requires_auth(self, http_client):
        """Improve letter endpoint requires authentication."""
        response = http_client.post(
            '/api/letters/improve',
            json={'letterId': 'test-id', 'feedback': 'Make it better'}
        )
        assert response.status_code in [401, 403]


@pytest.mark.database
class TestSubscriberDatabase:
    """Test subscriber-related database operations."""
    
    def test_profiles_table_exists(self, supabase_admin):
        """Profiles table should exist and be queryable."""
        result = supabase_admin.table('profiles').select('id, email, role').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letters_table_exists(self, supabase_admin):
        """Letters table should exist and be queryable."""
        result = supabase_admin.table('letters').select('id, title, status').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_subscriptions_table_exists(self, supabase_admin):
        """Subscriptions table should exist and be queryable."""
        result = supabase_admin.table('subscriptions').select('id, status, plan').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_subscriber_role_exists(self, supabase_admin):
        """Should be able to query subscribers."""
        result = supabase_admin.table('profiles').select('id').eq('role', 'subscriber').limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_letter_statuses_valid(self, supabase_admin):
        """Letters should have valid status values."""
        valid_statuses = ['draft', 'generating', 'pending_review', 'under_review', 
                          'approved', 'completed', 'rejected', 'failed']
        
        result = supabase_admin.table('letters').select('status').limit(10).execute()
        
        for letter in result.data:
            if letter.get('status'):
                assert letter['status'] in valid_statuses, f"Invalid status: {letter['status']}"


@pytest.mark.database
class TestLetterAllowanceFunctions:
    """Test letter allowance database functions."""
    
    def test_check_letter_allowance_function_exists(self, supabase_admin):
        """check_letter_allowance function should exist."""
        # Query information_schema or try calling the function
        # This is a simple existence check
        result = supabase_admin.rpc('check_letter_allowance', {
            'p_user_id': '00000000-0000-0000-0000-000000000000'
        }).execute()
        # Will likely return error for non-existent user, but function exists
        assert hasattr(result, 'data') or hasattr(result, 'error')
    
    def test_check_and_deduct_allowance_function_exists(self, supabase_admin):
        """check_and_deduct_allowance function should exist."""
        result = supabase_admin.rpc('check_and_deduct_allowance', {
            'p_user_id': '00000000-0000-0000-0000-000000000000'
        }).execute()
        assert hasattr(result, 'data') or hasattr(result, 'error')
