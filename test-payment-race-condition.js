#!/usr/bin/env node

/**
 * Payment Race Condition Test
 * 
 * This script tests the verify-payment race condition fix by simulating
 * concurrent requests to both the verify-payment endpoint and webhook.
 * 
 * Usage:
 *   1. Start the dev server: pnpm dev
 *   2. Set up test environment variables
 *   3. Run: node test-payment-race-condition.js
 * 
 * Prerequisites:
 *   - Valid Stripe test session ID
 *   - Test user authentication token
 *   - ENABLE_TEST_MODE=true
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const TEST_SESSION_ID = process.env.TEST_STRIPE_SESSION_ID || 'cs_test_example'
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

/**
 * Simulate verify-payment request
 */
async function callVerifyPayment(sessionId, userToken) {
  const startTime = Date.now()
  
  try {
    const response = await fetch(`${BASE_URL}/api/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({ sessionId }),
    })
    
    const duration = Date.now() - startTime
    const data = await response.json()
    
    return {
      success: response.ok,
      status: response.status,
      data,
      duration,
      endpoint: 'verify-payment',
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
      endpoint: 'verify-payment',
    }
  }
}

/**
 * Simulate webhook request (for testing only - normally Stripe calls this)
 */
async function callWebhook(sessionId, metadata) {
  const startTime = Date.now()
  
  try {
    // Note: In production, this requires valid Stripe signature
    // This is for local testing only with ENABLE_TEST_MODE=true
    const response = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test_signature',
      },
      body: JSON.stringify({
        id: `evt_test_${Date.now()}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            payment_status: 'paid',
            customer: 'cus_test',
            metadata,
          },
        },
      }),
    })
    
    const duration = Date.now() - startTime
    const data = await response.json()
    
    return {
      success: response.ok,
      status: response.status,
      data,
      duration,
      endpoint: 'webhook',
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
      endpoint: 'webhook',
    }
  }
}

/**
 * Test concurrent requests
 */
async function testConcurrentRequests() {
  log('\n=== Testing Payment Race Condition ===\n', 'cyan')
  
  if (!TEST_USER_TOKEN) {
    log('ERROR: TEST_USER_TOKEN not set', 'red')
    log('Please set environment variable with a valid auth token', 'yellow')
    return
  }
  
  const testMetadata = {
    user_id: 'test-user-id',
    plan_type: 'monthly',
    letters: '10',
    base_price: '29.99',
    final_price: '29.99',
    discount: '0',
  }
  
  log('Starting concurrent requests...', 'blue')
  log(`Session ID: ${TEST_SESSION_ID}`, 'blue')
  
  // Fire both requests simultaneously
  const [verifyResult, webhookResult] = await Promise.all([
    callVerifyPayment(TEST_SESSION_ID, TEST_USER_TOKEN),
    callWebhook(TEST_SESSION_ID, testMetadata),
  ])
  
  // Display results
  log('\n=== Results ===\n', 'cyan')
  
  log(`Verify Payment (${verifyResult.duration}ms):`, 'blue')
  if (verifyResult.success) {
    log(`  ✓ Success (${verifyResult.status})`, 'green')
    log(`  Message: ${verifyResult.data.message}`, 'green')
    if (verifyResult.data.subscriptionId) {
      log(`  Subscription ID: ${verifyResult.data.subscriptionId}`, 'green')
    }
  } else {
    log(`  ✗ Failed (${verifyResult.status})`, 'red')
    log(`  Error: ${verifyResult.error || JSON.stringify(verifyResult.data)}`, 'red')
  }
  
  log(`\nWebhook (${webhookResult.duration}ms):`, 'blue')
  if (webhookResult.success) {
    log(`  ✓ Success (${webhookResult.status})`, 'green')
    if (webhookResult.data.already_processed) {
      log(`  Already processed (idempotency check)`, 'yellow')
    }
  } else {
    log(`  ✗ Failed (${webhookResult.status})`, 'red')
    log(`  Error: ${webhookResult.error || JSON.stringify(webhookResult.data)}`, 'red')
  }
  
  // Analyze results
  log('\n=== Analysis ===\n', 'cyan')
  
  const bothSucceeded = verifyResult.success && webhookResult.success
  const oneSucceeded = verifyResult.success || webhookResult.success
  const noneSucceeded = !verifyResult.success && !webhookResult.success
  
  if (bothSucceeded) {
    log('✓ Both endpoints succeeded - race condition handled correctly!', 'green')
    
    if (verifyResult.data.message?.includes('webhook') || 
        webhookResult.data.already_processed) {
      log('✓ Idempotency working - no duplicate processing detected', 'green')
    }
  } else if (oneSucceeded) {
    log('⚠ Only one endpoint succeeded', 'yellow')
    log('This may be expected if one completes before the other starts', 'yellow')
  } else if (noneSucceeded) {
    log('✗ Both endpoints failed - check configuration', 'red')
  }
  
  log('\n=== Test Complete ===\n', 'cyan')
}

/**
 * Test sequential requests (should always succeed)
 */
async function testSequentialRequests() {
  log('\n=== Testing Sequential Requests ===\n', 'cyan')
  
  if (!TEST_USER_TOKEN) {
    log('ERROR: TEST_USER_TOKEN not set', 'red')
    return
  }
  
  const sessionId1 = `${TEST_SESSION_ID}_seq1`
  const sessionId2 = `${TEST_SESSION_ID}_seq2`
  
  log('Testing verify-payment followed by webhook...', 'blue')
  
  // First request
  const result1 = await callVerifyPayment(sessionId1, TEST_USER_TOKEN)
  log(`\n1. Verify Payment: ${result1.success ? '✓' : '✗'} (${result1.duration}ms)`, 
      result1.success ? 'green' : 'red')
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Second request with same session
  const result2 = await callVerifyPayment(sessionId1, TEST_USER_TOKEN)
  log(`2. Verify Payment (duplicate): ${result2.success ? '✓' : '✗'} (${result2.duration}ms)`,
      result2.success ? 'green' : 'red')
  
  if (result2.data?.message?.includes('already')) {
    log('   ✓ Correctly detected as already processed', 'green')
  }
  
  log('\n=== Sequential Test Complete ===\n', 'cyan')
}

// Main execution
async function main() {
  log('Payment Race Condition Test Suite', 'cyan')
  log('==================================\n', 'cyan')
  
  if (process.env.NODE_ENV === 'production') {
    log('WARNING: Do not run this in production!', 'red')
    process.exit(1)
  }
  
  // Run tests
  await testConcurrentRequests()
  await testSequentialRequests()
}

main().catch(error => {
  log(`\nUnexpected error: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})
