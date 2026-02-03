#!/usr/bin/env node
/**
 * Zapier Webhook Signature Test Script
 *
 * Tests HMAC signature generation and verification for the Zapier integration.
 *
 * USAGE:
 *   # Test against production
 *   ZAPIER_WEBHOOK_SECRET=your-secret node scripts/test-webhook-signature.ts
 *
 *   # Test against local development
 *   ZAPIER_WEBHOOK_SECRET=test-secret NODE_ENV=development node scripts/test-webhook-signature.ts
 *
 *   # With custom endpoint
 *   ENDPOINT=http://localhost:3000/api/letter-generated node scripts/test-webhook-signature.ts
 *
 * ENVIRONMENT VARIABLES:
 *   - ZAPIER_WEBHOOK_SECRET: The shared secret (required)
 *   - ENDPOINT: The webhook URL to test (default: production URL)
 *   - NODE_ENV: Set to 'development' to skip signature verification
 *
 * WHAT IT TESTS:
 *   1. Signature generation matches expected format
 *   2. Webhook endpoint accepts valid signatures
 *   3. Webhook endpoint rejects invalid signatures
 *   4. Payload format is correct
 */

import { createHmac } from 'crypto'
import fetch from 'node-fetch'

// Configuration from environment
const SECRET = process.env.ZAPIER_WEBHOOK_SECRET || ''
const ENDPOINT = process.env.ENDPOINT || 'https://www.talk-to-my-lawyer.com/api/letter-generated'
const NODE_ENV = process.env.NODE_ENV || 'production'

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
}

function log(message: string, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function success(message: string) {
  log(`✓ ${message}`, 'green')
}

function error(message: string) {
  log(`✗ ${message}`, 'red')
}

function info(message: string) {
  log(`ℹ ${message}`, 'cyan')
}

function section(title: string) {
  console.log('')
  log(`─── ${title} ───`, 'bright')
}

/**
 * Generate HMAC-SHA256 signature
 * Matches the implementation in Zapier's Code by Zapier step
 */
function generateSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(payload, 'utf8')
  return 'sha256=' + hmac.digest('hex')
}

/**
 * Test payload that matches Zapier's output format
 */
function createTestPayload(letterId: string): string {
  const payload = {
    letterId,
    generatedContent: `DEMAND LETTER

Date: ${new Date().toLocaleDateString()}

From: Test Sender
123 Verification Street
Suite 100
San Francisco, CA 94102

To: Test Recipient LLC
456 Recipient Avenue
New York, NY 10001

Re: Unpaid Wages Demand

Dear Recipient,

This letter serves as formal notice that your company owes unpaid wages in the amount of $5,000.00 for work performed by the undersigned in January 2026.

Despite our previous requests for payment, the amount remains outstanding. We demand full payment of all unpaid wages, plus any applicable interest, within ten (10) business days of receipt of this letter.

Failure to remit payment may result in further legal action to recover the owed amount, including any additional damages and legal fees as permitted by law.

Please direct payment to the address listed above or contact us at your earliest convenience to resolve this matter.

Sincerely,

Test Sender`,
    success: true,
    metadata: {
      letterType: 'demand_letter',
      generatedAt: new Date().toISOString(),
      model: 'chatgpt-via-zapier',
      source: 'test-script'
    }
  }

  return JSON.stringify(payload)
}

/**
 * Test 1: Verify configuration
 */
function testConfiguration(): boolean {
  section('TEST 1: Configuration Check')

  if (!SECRET) {
    error('ZAPIER_WEBHOOK_SECRET is not set')
    info('Set it with: ZAPIER_WEBHOOK_SECRET=your-secret node scripts/test-webhook-signature.ts')
    return false
  }

  success(`ZAPIER_WEBHOOK_SECRET is configured (${SECRET.length} chars)`)
  success(`Testing endpoint: ${ENDPOINT}`)
  success(`Environment: ${NODE_ENV}`)

  if (SECRET.length < 32) {
    error('Secret is too short (should be at least 32 characters)')
    return false
  }

  success('Secret length is sufficient (≥32 characters)')
  return true
}

/**
 * Test 2: Signature generation
 */
function testSignatureGeneration(): boolean {
  section('TEST 2: Signature Generation')

  const testPayload = createTestPayload('test-123')
  const signature = generateSignature(testPayload, SECRET)

  info(`Payload length: ${testPayload.length} bytes`)
  info(`Generated signature: ${signature.substring(0, 20)}...`)

  if (!signature.startsWith('sha256=')) {
    error('Signature does not start with "sha256="')
    return false
  }

  success('Signature format is correct (sha256=...)')

  const hashPart = signature.split('=')[1]
  if (hashPart.length !== 64) {
    error(`Hash length is ${hashPart.length}, expected 64 (hex-encoded SHA256)`)
    return false
  }

  success('Hash length is correct (64 characters)')
  return true
}

/**
 * Test 3: Signature consistency
 */
function testSignatureConsistency(): boolean {
  section('TEST 3: Signature Consistency')

  const testPayload = createTestPayload('test-456')
  const sig1 = generateSignature(testPayload, SECRET)
  const sig2 = generateSignature(testPayload, SECRET)

  if (sig1 !== sig2) {
    error('Signatures are not consistent for same payload')
    return false
  }

  success('Signature generation is deterministic')

  // Different payload should produce different signature
  const differentPayload = testPayload.replace('test-456', 'test-789')
  const sig3 = generateSignature(differentPayload, SECRET)

  if (sig1 === sig3) {
    error('Different payloads produced same signature')
    return false
  }

  success('Different payloads produce different signatures')
  return true
}

/**
 * Test 4: Webhook endpoint - Valid signature
 */
async function testValidSignature(): Promise<boolean> {
  section('TEST 4: Webhook Endpoint - Valid Signature')

  const letterId = `test-${Date.now()}`
  const payload = createTestPayload(letterId)
  const signature = generateSignature(payload, SECRET)

  info(`Sending POST to ${ENDPOINT}`)
  info(`Letter ID: ${letterId}`)
  info(`Payload: ${payload.substring(0, 100)}...`)
  info(`Signature: ${signature.substring(0, 30)}...`)

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zapier-Signature': signature,
        'X-Webhook-Source': 'test-script'
      },
      body: payload
    })

    info(`Response status: ${response.status} ${response.statusText}`)

    const responseText = await response.text()
    info(`Response body: ${responseText.substring(0, 200)}...`)

    // In development mode, signature verification is bypassed
    if (NODE_ENV === 'development') {
      info('Development mode: signature verification is bypassed')
      // We still expect 404 for non-existent letter
      if (response.status === 404) {
        success('Endpoint accepted request (404 = letter not found, expected for test)')
        return true
      }
    }

    // In production, expect 404 (letter not found) or 200 if somehow letter exists
    // 401 would mean signature verification failed
    if (response.status === 404) {
      success('Webhook accepted request (404 = letter not found, which is expected)')
      return true
    }

    if (response.status === 401) {
      error('Webhook rejected signature (401 Unauthorized)')
      return false
    }

    if (response.status === 200) {
      success('Webhook processed successfully')
      return true
    }

    error(`Unexpected response status: ${response.status}`)
    return false

  } catch (err) {
    error(`Request failed: ${err}`)
    return false
  }
}

/**
 * Test 5: Webhook endpoint - Invalid signature
 */
async function testInvalidSignature(): Promise<boolean> {
  section('TEST 5: Webhook Endpoint - Invalid Signature')

  const letterId = `test-invalid-${Date.now()}`
  const payload = createTestPayload(letterId)
  const invalidSignature = 'sha256=' + '0'.repeat(64) // All zeros

  info(`Sending POST with invalid signature`)
  info(`Letter ID: ${letterId}`)

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zapier-Signature': invalidSignature,
        'X-Webhook-Source': 'test-script'
      },
      body: payload
    })

    info(`Response status: ${response.status} ${response.statusText}`)

    // In development mode, invalid signatures are accepted
    if (NODE_ENV === 'development') {
      info('Development mode: signature verification is bypassed')
      return true
    }

    // In production, expect 401 for invalid signature
    if (response.status === 401) {
      success('Webhook correctly rejected invalid signature (401 Unauthorized)')
      return true
    }

    if (response.status === 404) {
      error('Webhook accepted invalid signature (should have been rejected)')
      return false
    }

    error(`Unexpected response status: ${response.status}`)
    return false

  } catch (err) {
    error(`Request failed: ${err}`)
    return false
  }
}

/**
 * Test 6: Zapier Code by Zapier JavaScript snippet
 */
function testZapierCodeSnippet() {
  section('TEST 6: Zapier Code Snippet (Reference)')

  info('Copy this code into your Zapier "Code by Zapier" step:')
  console.log('')

  const codeSnippet = `
// Zapier "Code by Zapier" - Run JavaScript
// Input Data Variables:
// - letterId: {{1.letterId}}
// - generatedContent: {{2.Response}} or {{2.Message}}
// - secret: YOUR_ZAPIER_WEBHOOK_SECRET_VALUE
// - letterType: {{1.letterType}} (optional)

const crypto = require('crypto');

// Build the payload that will be sent to the app
const payload = {
  letterId: inputData.letterId,
  generatedContent: inputData.generatedContent,
  success: true,
  metadata: {
    letterType: inputData.letterType || 'unknown',
    generatedAt: new Date().toISOString(),
    model: 'chatgpt-via-zapier',
    source: 'zapier'
  }
};

// Convert to JSON string (this EXACT string will be sent)
const payloadString = JSON.stringify(payload);

// Compute HMAC-SHA256 signature using the shared secret
const hmac = crypto.createHmac('sha256', inputData.secret);
hmac.update(payloadString, 'utf8');
const signature = 'sha256=' + hmac.digest('hex');

// Return the payload string and signature for the next step
output = {
  payloadString: payloadString,
  signature: signature,
  letterId: payload.letterId
};
`.trim()

  console.log(colors.gray + codeSnippet + colors.reset)
  console.log('')

  info('Then in the "Webhooks by Zapier" POST step:')
  console.log('')
  console.log(colors.gray + `
URL: ${ENDPOINT}
Payload Type: JSON
Data: {{3.payloadString}}  (use "Switch to Code Mode" or "Raw")
Headers:
  Content-Type: application/json
  X-Zapier-Signature: {{3.signature}}
  X-Webhook-Source: talk-to-my-lawyer
`.trim() + colors.reset)
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('')
  log('╔════════════════════════════════════════════════════════════╗', 'cyan')
  log('║     Zapier Webhook Signature Test Suite                    ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════╝', 'cyan')
  console.log('')

  const results: { name: string; passed: boolean }[] = []

  // Test 1: Configuration
  results.push({ name: 'Configuration Check', passed: testConfiguration() })

  if (!results[0].passed) {
    console.log('')
    error('Configuration failed. Please set ZAPIER_WEBHOOK_SECRET.')
    process.exit(1)
  }

  // Test 2: Signature Generation
  results.push({ name: 'Signature Generation', passed: testSignatureGeneration() })

  // Test 3: Signature Consistency
  results.push({ name: 'Signature Consistency', passed: testSignatureConsistency() })

  // Test 4: Valid Signature
  results.push({ name: 'Valid Signature Webhook', passed: await testValidSignature() })

  // Test 5: Invalid Signature
  results.push({ name: 'Invalid Signature Rejection', passed: await testInvalidSignature() })

  // Test 6: Show Zapier code snippet
  testZapierCodeSnippet()

  // Summary
  section('TEST SUMMARY')
  console.log('')

  const passed = results.filter(r => r.passed).length
  const total = results.length

  for (const result of results) {
    if (result.passed) {
      success(result.name)
    } else {
      error(result.name)
    }
  }

  console.log('')
  if (passed === total) {
    log(`All tests passed! (${passed}/${total})`, 'green')
    console.log('')
    info('Your Zapier webhook signature is correctly configured.')
    info('You can now test the full letter generation flow.')
  } else {
    log(`Some tests failed (${passed}/${total} passed)`, 'red')
    console.log('')
    error('Please review the failed tests above.')
    process.exit(1)
  }
}

// Run tests
runTests().catch(err => {
  console.error('')
  error(`Test suite error: ${err}`)
  process.exit(1)
})
