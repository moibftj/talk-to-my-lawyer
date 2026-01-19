#!/usr/bin/env node

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

console.log('🚀 Testing Email Queue Processing...\n')

// Create Supabase client directly
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

const resend = new Resend(process.env.RESEND_API_KEY)

async function processPendingEmails() {
  try {
    console.log('📥 Fetching pending emails from queue...')
    
    const { data: emails, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .limit(5)
    
    if (error) {
      console.error('❌ Error fetching emails:', error)
      return
    }
    
    console.log(`📊 Found ${emails?.length || 0} pending emails`)
    
    if (!emails || emails.length === 0) {
      console.log('✅ No pending emails to process')
      return
    }
    
    // Process each email
    for (const email of emails) {
      console.log(`\n📧 Processing email ${email.id}...`)
      console.log(`   To: ${email.to}`)
      console.log(`   Subject: ${email.subject}`)
      
      try {
        // Send via Resend
        const result = await resend.emails.send({
          from: process.env.EMAIL_FROM || 'noreply@talk-to-my-lawyer.com',
          to: email.to,
          subject: email.subject,
          html: email.html || undefined,
          text: email.text || undefined,
        })
        
        console.log(`   ✅ Sent successfully! Message ID: ${result.data?.id}`)
        
        // Update status to sent
        const { error: updateError } = await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id)
          
        if (updateError) {
          console.error(`   ⚠️ Warning: Failed to update status:`, updateError)
        } else {
          console.log(`   📝 Status updated to 'sent'`)
        }
        
      } catch (sendError) {
        console.error(`   ❌ Failed to send:`, sendError.message)
        
        // Update attempts and status
        const newAttempts = email.attempts + 1
        const newStatus = newAttempts >= email.max_retries ? 'failed' : 'pending'
        const nextRetry = newStatus === 'pending' 
          ? new Date(Date.now() + Math.pow(2, newAttempts) * 60000).toISOString() // exponential backoff
          : null
          
        const { error: updateError } = await supabase
          .from('email_queue')
          .update({
            status: newStatus,
            attempts: newAttempts,
            next_retry_at: nextRetry,
            error: sendError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id)
          
        if (updateError) {
          console.error(`   ⚠️ Warning: Failed to update error status:`, updateError)
        } else {
          console.log(`   📝 Updated attempts to ${newAttempts}, status: ${newStatus}`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error in processPendingEmails:', error)
  }
}

// Run the processor
processPendingEmails()
  .then(() => {
    console.log('\n🎉 Email queue processing completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })