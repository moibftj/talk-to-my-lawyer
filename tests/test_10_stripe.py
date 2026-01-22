"""
Stripe Integration Tests
========================

Tests for Stripe payment integration.
"""

import pytest
import httpx


class TestStripeEndpoints:
    """Test Stripe-related API endpoints."""
    
    def test_create_checkout_requires_auth(self, http_client):
        """Create checkout endpoint requires authentication."""
        response = http_client.post(
            '/api/create-checkout',
            json={'planId': 'basic'}
        )
        assert response.status_code in [401, 403]
    
    def test_verify_payment_requires_session(self, http_client):
        """Verify payment endpoint requires session ID."""
        response = http_client.post(
            '/api/verify-payment',
            json={}
        )
        # Should error without session ID
        assert response.status_code in [400, 401, 403, 422]
    
    def test_webhook_endpoint_exists(self, http_client):
        """Stripe webhook endpoint exists."""
        # Without proper signature, should reject
        response = http_client.post(
            '/api/stripe/webhook',
            content=b'{}',
            headers={'Content-Type': 'application/json'}
        )
        # Should reject invalid webhook signature
        assert response.status_code in [400, 401, 403]


class TestSubscriptionEndpoints:
    """Test subscription management endpoints."""
    
    def test_activate_subscription_requires_auth(self, http_client):
        """Activate subscription requires authentication."""
        response = http_client.post(
            '/api/subscriptions/activate',
            json={'sessionId': 'test_session'}
        )
        assert response.status_code in [401, 403]
    
    def test_reset_monthly_requires_auth(self, http_client):
        """Reset monthly allowance requires authentication."""
        response = http_client.post('/api/subscriptions/reset-monthly')
        assert response.status_code in [401, 403]
    
    def test_check_allowance_requires_auth(self, http_client):
        """Check allowance requires authentication."""
        response = http_client.get('/api/subscriptions/check-allowance')
        assert response.status_code in [401, 403]
    
    def test_billing_history_requires_auth(self, http_client):
        """Billing history requires authentication."""
        response = http_client.get('/api/subscriptions/billing-history')
        assert response.status_code in [401, 403]


@pytest.mark.database
class TestStripeDatabase:
    """Test Stripe-related database fields."""
    
    def test_profiles_have_stripe_customer_id(self, supabase_admin):
        """Profiles table has stripe_customer_id column."""
        result = supabase_admin.table('profiles').select(
            'id, stripe_customer_id'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_subscriptions_have_stripe_fields(self, supabase_admin):
        """Subscriptions table has Stripe integration fields."""
        result = supabase_admin.table('subscriptions').select(
            'id, stripe_subscription_id, stripe_customer_id, stripe_session_id'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_subscriptions_have_billing_period(self, supabase_admin):
        """Subscriptions table has billing period fields."""
        result = supabase_admin.table('subscriptions').select(
            'id, current_period_start, current_period_end'
        ).limit(1).execute()
        assert hasattr(result, 'data')
    
    def test_subscriptions_have_pricing(self, supabase_admin):
        """Subscriptions table has pricing fields."""
        result = supabase_admin.table('subscriptions').select(
            'id, price, discount, coupon_code'
        ).limit(1).execute()
        assert hasattr(result, 'data')


@pytest.mark.database
class TestWebhookEvents:
    """Test webhook event tracking."""
    
    def test_webhook_events_table_exists(self, supabase_admin):
        """Webhook events table should exist."""
        try:
            result = supabase_admin.table('webhook_events').select('id').limit(1).execute()
            assert hasattr(result, 'data')
        except Exception:
            # Table may not exist in all environments
            pytest.skip("webhook_events table not present")


class TestStripeTestMode:
    """Test Stripe test mode configuration."""
    
    def test_stripe_test_key_format(self):
        """Stripe test keys should have correct format."""
        import os
        
        # In test environment, check key format if present
        secret_key = os.getenv('STRIPE_SECRET_KEY', '')
        
        if secret_key:
            # Test keys start with sk_test_
            is_test_key = secret_key.startswith('sk_test_')
            is_live_key = secret_key.startswith('sk_live_')
            assert is_test_key or is_live_key, "Invalid Stripe key format"
    
    def test_stripe_publishable_key_format(self):
        """Stripe publishable key should have correct format."""
        import os
        
        pub_key = os.getenv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', '')
        
        if pub_key:
            is_test_key = pub_key.startswith('pk_test_')
            is_live_key = pub_key.startswith('pk_live_')
            assert is_test_key or is_live_key, "Invalid Stripe publishable key format"
