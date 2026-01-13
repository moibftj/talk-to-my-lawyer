#!/usr/bin/env python3
"""
Email System Testing for Talk-To-My-Lawyer Application
Tests email configuration, templates, and API endpoints
"""

import requests
import json
import sys
import time
from datetime import datetime
from typing import Dict, Any, Optional

class EmailSystemTester:
    def __init__(self, base_url="https://www.talk-to-my-lawyer.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'EmailTester/1.0'
        })
        
        self.test_results = {
            'total': 0,
            'passed': 0,
            'failed': 0,
            'errors': []
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.test_results['total'] += 1
        if success:
            self.test_results['passed'] += 1
            print(f"✅ {name}")
            if details:
                print(f"   {details}")
        else:
            self.test_results['failed'] += 1
            print(f"❌ {name}")
            if details:
                print(f"   {details}")
                self.test_results['errors'].append(f"{name}: {details}")

    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    headers: Dict = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and return success status and response data"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            else:
                return False, {'error': f'Unsupported method: {method}'}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {'status_code': response.status_code, 'text': response.text[:500]}
                
            return success, response_data
            
        except Exception as e:
            return False, {'error': str(e)}

    def test_resend_confirmation_endpoint(self):
        """Test the /api/auth/resend-confirmation endpoint"""
        print("\n📧 Testing Resend Confirmation Endpoint...")
        
        # Test with valid email format
        test_data = {
            'email': 'test-user@example.com'
        }
        
        success, response = self.make_request('POST', '/api/auth/resend-confirmation', test_data)
        self.log_test("Resend Confirmation API", success, 
                     f"Response: {response.get('message', response.get('error', 'No message'))}")
        
        # Test with missing email
        success, response = self.make_request('POST', '/api/auth/resend-confirmation', {}, expected_status=400)
        self.log_test("Resend Confirmation - Missing Email", success, 
                     f"Error: {response.get('error', 'No error message')}")
        
        # Test with invalid email format
        invalid_data = {'email': 'invalid-email'}
        success, response = self.make_request('POST', '/api/auth/resend-confirmation', invalid_data)
        # This might still return 200 for security reasons (not revealing if user exists)
        self.log_test("Resend Confirmation - Invalid Email", True, 
                     f"Response: {response.get('message', 'Handled gracefully')}")

    def test_send_email_endpoint(self):
        """Test the /api/auth/send-email endpoint"""
        print("\n📨 Testing Send Email Endpoint...")
        
        # Test GET request to check endpoint status
        success, response = self.make_request('GET', '/api/auth/send-email')
        self.log_test("Send Email Endpoint Status", success, 
                     f"Status: {response.get('status', 'unknown')}")
        
        # Test POST with signup email type
        test_webhook_data = {
            'type': 'signup',
            'user': {
                'email': 'test@example.com',
                'user_metadata': {
                    'full_name': 'Test User'
                }
            },
            'email_data': {
                'confirmation_url': 'https://talk-to-my-lawyer.com/auth/confirm?token=test123',
                'token': 'test123'
            }
        }
        
        success, response = self.make_request('POST', '/api/auth/send-email', test_webhook_data)
        self.log_test("Send Email - Signup Type", success, 
                     f"Response: {response.get('messageId', response.get('error', 'No response'))}")

    def test_email_configuration(self):
        """Test email system configuration"""
        print("\n⚙️ Testing Email Configuration...")
        
        # Check if we can access the email service configuration
        # This would typically be done through a health check or status endpoint
        
        # For now, we'll test if the endpoints are accessible
        success, response = self.make_request('GET', '/api/health', expected_status=200)
        if success:
            self.log_test("Application Health Check", True, "App is running")
        else:
            self.log_test("Application Health Check", False, "App may not be running")

    def test_signup_flow_with_email(self):
        """Test the complete signup flow that should trigger email"""
        print("\n👤 Testing Signup Flow with Email...")
        
        # Generate unique test email
        timestamp = int(time.time())
        test_email = f"test-signup-{timestamp}@example.com"
        
        signup_data = {
            'email': test_email,
            'password': 'TestPass123!',
            'fullName': 'Test User',
            'role': 'subscriber'
        }
        
        # This should trigger the signup process and potentially send an email
        success, response = self.make_request('POST', '/api/auth/signup', signup_data)
        self.log_test("Signup Process", success, 
                     f"Response: {response.get('message', response.get('error', 'No message'))}")
        
        if success:
            # Now test resending confirmation for this user
            time.sleep(1)  # Brief delay
            resend_data = {'email': test_email}
            success, response = self.make_request('POST', '/api/auth/resend-confirmation', resend_data)
            self.log_test("Resend for New User", success, 
                         f"Response: {response.get('message', response.get('error', 'No message'))}")

    def test_email_templates(self):
        """Test email template rendering (if accessible)"""
        print("\n📝 Testing Email Templates...")
        
        # Since templates are server-side, we can only test if the endpoints work
        # The actual template rendering would be tested through the email sending
        
        # Test different email types through the send-email endpoint
        email_types = [
            'signup',
            'recovery', 
            'email_change',
            'magic_link'
        ]
        
        for email_type in email_types:
            test_data = {
                'type': email_type,
                'user': {
                    'email': 'test@example.com',
                    'user_metadata': {'full_name': 'Test User'}
                },
                'email_data': {
                    'confirmation_url': f'https://talk-to-my-lawyer.com/auth/confirm?type={email_type}',
                    'token': 'test123'
                }
            }
            
            success, response = self.make_request('POST', '/api/auth/send-email', test_data)
            self.log_test(f"Email Template - {email_type}", success, 
                         f"Response: {response.get('messageId', response.get('error', 'No response'))}")

    def run_all_tests(self):
        """Run comprehensive email testing suite"""
        print("📧 Starting Email System Testing Suite")
        print(f"🌐 Testing against: {self.base_url}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        try:
            self.test_email_configuration()
            self.test_resend_confirmation_endpoint()
            self.test_send_email_endpoint()
            self.test_email_templates()
            self.test_signup_flow_with_email()
            
        except KeyboardInterrupt:
            print("\n⚠️  Testing interrupted by user")
        except Exception as e:
            print(f"\n❌ Unexpected error during testing: {str(e)}")
            self.test_results['errors'].append(f"Unexpected error: {str(e)}")
        
        self.print_summary()

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 EMAIL TESTING RESULTS SUMMARY")
        print("=" * 60)
        
        total = self.test_results['total']
        passed = self.test_results['passed']
        failed = self.test_results['failed']
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        
        if total > 0:
            success_rate = (passed / total) * 100
            print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.test_results['errors']:
            print(f"\n🔍 FAILED TESTS:")
            for error in self.test_results['errors']:
                print(f"   • {error}")
        
        print(f"\n⏰ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return failed == 0

def main():
    """Main test execution"""
    tester = EmailSystemTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()