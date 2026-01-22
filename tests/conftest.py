"""
Test Configuration for Talk-To-My-Lawyer Application
=====================================================

This module provides fixtures and configuration for the test suite.
"""

import os
import pytest
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client
from faker import Faker

# Load environment variables
load_dotenv('.env.local')
load_dotenv('.env.test', override=True)

fake = Faker()


# =============================================================================
# Configuration
# =============================================================================

class TestConfig:
    """Test configuration loaded from environment variables."""
    
    # App URLs
    BASE_URL = os.getenv('TEST_BASE_URL', 'http://localhost:3000')
    
    # Supabase
    SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '')
    SUPABASE_ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
    
    # Test accounts (create these in your test environment)
    TEST_SUBSCRIBER_EMAIL = os.getenv('TEST_SUBSCRIBER_EMAIL', 'test+subscriber@example.com')
    TEST_SUBSCRIBER_PASSWORD = os.getenv('TEST_SUBSCRIBER_PASSWORD', 'TestPassword123!')
    
    TEST_EMPLOYEE_EMAIL = os.getenv('TEST_EMPLOYEE_EMAIL', 'test+employee@example.com')
    TEST_EMPLOYEE_PASSWORD = os.getenv('TEST_EMPLOYEE_PASSWORD', 'TestPassword123!')
    
    TEST_ATTORNEY_EMAIL = os.getenv('TEST_ATTORNEY_EMAIL', 'test+attorney@example.com')
    TEST_ATTORNEY_PASSWORD = os.getenv('TEST_ATTORNEY_PASSWORD', 'TestPassword123!')
    
    TEST_SUPERADMIN_EMAIL = os.getenv('TEST_SUPERADMIN_EMAIL', 'test+superadmin@example.com')
    TEST_SUPERADMIN_PASSWORD = os.getenv('TEST_SUPERADMIN_PASSWORD', 'TestPassword123!')
    
    # Stripe test mode
    STRIPE_TEST_CARD = '4242424242424242'


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture(scope='session')
def config():
    """Provide test configuration."""
    return TestConfig()


@pytest.fixture(scope='session')
def supabase_admin(config) -> Client:
    """Create Supabase admin client with service role key."""
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_KEY:
        pytest.skip("Supabase credentials not configured")
    return create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)


@pytest.fixture(scope='session')
def supabase_anon(config) -> Client:
    """Create Supabase client with anon key."""
    if not config.SUPABASE_URL or not config.SUPABASE_ANON_KEY:
        pytest.skip("Supabase credentials not configured")
    return create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)


@pytest.fixture(scope='session')
def http_client(config):
    """Create HTTP client for API testing."""
    return httpx.Client(base_url=config.BASE_URL, timeout=30.0)


@pytest.fixture(scope='session')
def async_http_client(config):
    """Create async HTTP client for API testing."""
    return httpx.AsyncClient(base_url=config.BASE_URL, timeout=30.0)


@pytest.fixture
def random_email():
    """Generate a random test email."""
    return f"test+{fake.uuid4()[:8]}@example.com"


@pytest.fixture
def random_user_data(random_email):
    """Generate random user data for testing."""
    return {
        'email': random_email,
        'password': 'TestPassword123!',
        'full_name': fake.name(),
        'phone': fake.phone_number(),
        'company_name': fake.company()
    }


@pytest.fixture
def sample_letter_data():
    """Sample letter data for testing letter generation."""
    return {
        'letterType': 'demand_letter',
        'title': 'Test Demand Letter',
        'recipientName': fake.name(),
        'recipientAddress': fake.address(),
        'senderName': fake.name(),
        'senderAddress': fake.address(),
        'issueDescription': 'This is a test issue description for testing purposes. ' * 5,
        'desiredOutcome': 'The desired outcome is to test the letter generation system.',
        'amountDemanded': 5000,
        'deadlineDate': '2026-02-01',
        'additionalDetails': 'Additional test details here.'
    }


# =============================================================================
# Helper Functions
# =============================================================================

def get_auth_headers(access_token: str) -> dict:
    """Create authorization headers from access token."""
    return {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }


async def login_user(client: httpx.AsyncClient, supabase: Client, email: str, password: str) -> dict:
    """Login a user and return session info."""
    response = supabase.auth.sign_in_with_password({
        'email': email,
        'password': password
    })
    return {
        'access_token': response.session.access_token,
        'refresh_token': response.session.refresh_token,
        'user': response.user
    }


# =============================================================================
# Pytest Configuration
# =============================================================================

def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "slow: mark test as slow running")
    config.addinivalue_line("markers", "auth: tests requiring authentication")
    config.addinivalue_line("markers", "admin: tests requiring admin access")
    config.addinivalue_line("markers", "subscriber: tests for subscriber role")
    config.addinivalue_line("markers", "employee: tests for employee role")
    config.addinivalue_line("markers", "attorney: tests for attorney admin role")
    config.addinivalue_line("markers", "superadmin: tests for super admin role")
    config.addinivalue_line("markers", "integration: integration tests")
    config.addinivalue_line("markers", "database: tests requiring database access")
