#!/usr/bin/env node

/**
 * Direct Email Queue Processor
 * 
 * Uses direct PostgreSQL connection instead of REST API to avoid PGRST002 errors
 * This script processes emails in the queue and sends them via Resend
 */

import dotenv from 'dotenv'
import { Client } from 'pg'
import { Resend } from 'resend'
import dns from 'dns'

// Force IPv4 DNS resolution
dns.setDefaultResultOrder('ipv4first')

// Load environment variables
dotenv.config({ path: '.env.local' })

const resend = new Resend(process.env.RESEND_API_KEY)

// Create direct PostgreSQL connection
const client = new Client({
  host: 'db.nomiiqzxaxyxnxndvkbe.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'kE2RCNmEcwrWgh8R',
  ssl: { rejectUnauthorized: false }
})

async function processEmailQueue() {
  try {
    console.log('🔌 Connecting to database...')
    await client.connect()
    console.log('✅ Connected to database')

    // Fetch pending emails
    console.log('📥 Fetching pending emails...')
    const result = await client.query(`
      SELECT id, "to", subject, html, text, attempts, max_retries
      FROM email_queue 
      WHERE status = 'pending' 
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      LIMIT 10
    `)

    console.log(`📧 Found ${result.rows.length} pending emails`)

    for (const email of result.rows) {
      try {
        console.log(`\n📤 Processing email ${email.id} to ${email.to}...`)
        
        // Send email via Resend
        const emailResult = await resend.emails.send({
          from: process.env.EMAIL_FROM,
          to: email.to,
          subject: email.subject,
          html: email.html || undefined,
          text: email.text || undefined
        })

        if (emailResult.error) {
          throw new Error(`Resend error: ${emailResult.error.message}`)
        }

        // Mark as sent
        await client.query(`
          UPDATE email_queue 
          SET status = 'sent', 
              sent_at = NOW(), 
              updated_at = NOW()
          WHERE id = $1
        `, [email.id])

        console.log(`✅ Email ${email.id} sent successfully (Message ID: ${emailResult.data?.id})`)

      } catch (error) {
        console.error(`❌ Failed to send email ${email.id}:`, error.message)
        
        // Update attempt count and status
        const newAttempts = email.attempts + 1
        const shouldRetry = newAttempts < email.max_retries
        
        if (shouldRetry) {
          // Schedule retry
          const nextRetry = new Date(Date.now() + Math.pow(2, newAttempts) * 60000) // Exponential backoff
          await client.query(`
            UPDATE email_queue 
            SET attempts = $1, 
                next_retry_at = $2,
                error = $3,
                updated_at = NOW()
            WHERE id = $4
          `, [newAttempts, nextRetry, error.message, email.id])
          
          console.log(`🔄 Scheduled retry ${newAttempts}/${email.max_retries} for email ${email.id}`)
        } else {
          // Mark as failed
          await client.query(`
            UPDATE email_queue 
            SET status = 'failed', 
                attempts = $1,
                error = $2,
                updated_at = NOW()
            WHERE id = $3
          `, [newAttempts, error.message, email.id])
          
          console.log(`💀 Email ${email.id} marked as failed after ${newAttempts} attempts`)
        }
      }
    }

    console.log('\n✅ Email queue processing completed')

  } catch (error) {
    console.error('❌ Email queue processing failed:', error)
  } finally {
    await client.end()
    console.log('🔌 Database connection closed')
  }
}

// Run the processor
processEmailQueue().catch(console.error)