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
  const providers = ['resend', 'brevo', 'sendgrid', 'smtp', 'console']

  for (const providerName of providers) {
    try {
      const provider = emailService.getProvider(providerName)
      const isConfigured = provider.isConfigured()
      const status = isConfigured ? '✅ Configured' : '❌ Not configured'
      console.log(`  ${providerName.toUpperCase().padEnd(10)} - ${status}`)
    } catch (error) {
      console.log(`  ${providerName.toUpperCase().padEnd(10)} - ❌ Not available`)
    }
  }

  console.log('\n🎯 The system will automatically use the first configured provider in this priority order:')
  console.log('   1. Resend (recommended)')
  console.log('   2. Brevo')
  console.log('   3. SendGrid')
  console.log('   4. SMTP')
  console.log('   5. Console (development fallback)\n')
}

checkProvider()
