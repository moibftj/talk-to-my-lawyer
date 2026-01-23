/**
 * MSW (Mock Service Worker) API handlers
 * Use for mocking HTTP requests in tests
 */

import { http, HttpResponse } from 'msw'

// Base URL for API requests
const BASE_URL = 'http://localhost:3000'

// Mock handlers for API endpoints
export const handlers = [
  // Health check
  http.get(`${BASE_URL}/api/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        redis: 'healthy',
        openai: 'healthy',
        stripe: 'healthy',
      },
    })
  }),

  // Detailed health check
  http.get(`${BASE_URL}/api/health/detailed`, () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', latency: 5 },
        redis: { status: 'healthy', latency: 2 },
        openai: { status: 'healthy', latency: 150 },
        stripe: { status: 'healthy', latency: 100 },
      },
      version: '1.0.0',
    })
  }),

  // CSRF token
  http.get(`${BASE_URL}/api/admin/csrf`, () => {
    return HttpResponse.json({
      token: 'mock-csrf-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    })
  }),

  // Allowance check
  http.get(`${BASE_URL}/api/subscriptions/check-allowance`, () => {
    return HttpResponse.json({
      allowance_remaining: 5,
      allowance_total: 5,
      tier: 'basic',
      reset_at: new Date(Date.now() + 86400000).toISOString(),
    })
  }),

  // Letters list
  http.get(`${BASE_URL}/api/letters/drafts`, () => {
    return HttpResponse.json({
      letters: [],
      count: 0,
    })
  }),

  // Admin letters list
  http.get(`${BASE_URL}/api/admin/letters`, () => {
    return HttpResponse.json({
      letters: [],
      count: 0,
      stats: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      },
    })
  }),

  // Admin analytics
  http.get(`${BASE_URL}/api/admin/analytics`, () => {
    return HttpResponse.json({
      total_letters: 0,
      pending_review: 0,
      approved_today: 0,
      rejected_today: 0,
      active_subscribers: 0,
      revenue_this_month: 0,
    })
  }),

  // Admin coupons
  http.get(`${BASE_URL}/api/admin/coupons`, () => {
    return HttpResponse.json({
      coupons: [],
      count: 0,
    })
  }),

  // Employee referral link
  http.get(`${BASE_URL}/api/employee/referral-link`, () => {
    return HttpResponse.json({
      coupon_code: 'TEST2025',
      referral_link: 'https://example.com?ref=TEST2025',
      share_link: 'https://example.com/share/TEST2025',
      uses: 0,
      commissions: 0,
    })
  }),

  // Employee payouts
  http.get(`${BASE_URL}/api/employee/payouts`, () => {
    return HttpResponse.json({
      total_commissions: 0,
      pending_payout: 0,
      paid_payout: 0,
      payout_history: [],
    })
  }),
]
