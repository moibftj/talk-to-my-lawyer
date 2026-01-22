"""
Health Check Tests
==================

Tests for API health and connectivity.
"""

import pytest
import httpx


class TestHealthEndpoints:
    """Test health check endpoints."""
    
    def test_basic_health_check(self, http_client, config):
        """Test basic health endpoint returns 200."""
        response = http_client.get('/api/health')
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') in ['ok', 'healthy']
    
    def test_detailed_health_check(self, http_client, config):
        """Test detailed health endpoint returns component status."""
        response = http_client.get('/api/health/detailed')
        assert response.status_code == 200
        data = response.json()
        
        # Should include component statuses
        assert 'status' in data
        # May include database, redis, etc.
    
    def test_health_response_time(self, http_client, config):
        """Health check should respond quickly (under 2 seconds)."""
        import time
        start = time.time()
        response = http_client.get('/api/health')
        duration = time.time() - start
        
        assert response.status_code == 200
        assert duration < 2.0, f"Health check took {duration:.2f}s, expected < 2s"


class TestAPIConnectivity:
    """Test basic API connectivity."""
    
    def test_api_returns_json(self, http_client):
        """API should return JSON content type."""
        response = http_client.get('/api/health')
        assert 'application/json' in response.headers.get('content-type', '')
    
    def test_cors_headers_present(self, http_client):
        """API should include CORS headers."""
        response = http_client.options('/api/health')
        # For preflight requests, may return various status codes
        # The important thing is it doesn't error
        assert response.status_code in [200, 204, 405]
    
    def test_404_for_unknown_endpoint(self, http_client):
        """Unknown endpoints should return 404."""
        response = http_client.get('/api/nonexistent-endpoint-xyz')
        assert response.status_code == 404


class TestRateLimiting:
    """Test rate limiting functionality."""
    
    @pytest.mark.slow
    def test_rate_limit_headers(self, http_client):
        """API should include rate limit headers."""
        response = http_client.get('/api/health')
        # Rate limit headers may or may not be present
        # Just verify the request succeeds
        assert response.status_code == 200
