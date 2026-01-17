#!/usr/bin/env node

// Check which email provider is configured
import { getEmailService } from './lib/email/service.js'

async function checkProvider() {
  console.log('📧 Email Service Configuration Check\n')

  const emailService = getEmailService()
  const defaultFrom = emailService.getDefaultFrom()

  console.log('✅ Email service is configured:', emailService.isConfigured())
  console.log('📤 Default FROM email:', defaultFrom.email)
  console.log('👤 Default FROM name:', defaultFrom.name)
  console.log('\n📋 Available Providers:\n')

  // Check each provider
  const providers = ['resend']

  for (const providerName of providers) {
    try {
      // In the single-provider architecture, we check the main service directly
      const isConfigured = emailService.isConfigured()
      const status = isConfigured ? '✅ Configured' : '❌ Not configured'
      console.log(`  ${providerName.toUpperCase().padEnd(10)} - ${status}`)
    } catch (error) {
      console.log(`  ${providerName.toUpperCase().padEnd(10)} - ❌ Not available`)
    }
  }

  console.log('\n🎯 The system uses Resend as the exclusive email provider.')
}

checkProvider()
