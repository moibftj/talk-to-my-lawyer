# n8n Workflow Integration Setup Guide

This document explains how to set up the n8n workflow integration for seamless AI letter generation and PDF generation.

## Overview

The application uses two n8n workflows:

1. **AI-Powered Legal Letter Generation** (`fRWD4L9r7WH4m81HlAkhV`)
   - Handles jurisdiction research, GPT-4o letter generation
   - Updates Supabase directly with generated content
   - Webhook: `/webhook/legal-letter-submission`

2. **TTML - Standalone PDF Generator** (`YleWYMCqBS2JRa0yGN_8Q`)
   - Converts approved letters to professionally formatted PDFs
   - Uploads PDF to Supabase Storage
   - Webhook: `/webhook/generate-pdf-test`

## Prerequisites

1. **n8n Instance** (either self-hosted or n8n.cloud)
2. **Basic Authentication** configured for both workflows
3. **Webhook URLs** from n8n workflow settings
4. **Environment variables** configured in your deployment

## Step 1: Configure n8n Workflows

### Letter Generation Workflow

1. Import the workflow `fRWD4L9r7WH4m81HlAkhV` into your n8n instance
2. **Add a Respond to Webhook node** at the end of the workflow:
   - Response format:
   ```json
   {
     "success": true,
     "letterId": {{ $('Extract Form Data').item.json.letterId }},
     "status": "pending_review",
     "supabaseUpdated": true,
     "message": "Letter generated successfully with jurisdiction research"
   }
   ```
3. Configure Basic Auth in the webhook node:
   - Username: Your chosen username
   - Password: Your chosen password

### PDF Generator Workflow

1. Import the workflow `YleWYMCqBS2JRa0yGN_8Q`
2. Ensure Respond to Webhook node is configured (already exists)
3. Configure Basic Auth in the webhook node (same credentials)

## Step 2: Configure Environment Variables

Add these variables to your `.env.local` file (Vercel Dashboard for production):

```bash
# Letter Generation Webhook URL
N8N_WEBHOOK_URL=https://designtec.app.n8n.cloud/webhook/legal-letter-submission

# PDF Generation Webhook URL
N8N_PDF_WEBHOOK_URL=https://designtec.app.n8n.cloud/webhook/generate-pdf-test

# n8n Webhook Basic Authentication
N8N_WEBHOOK_AUTH_USER=your-username
N8N_WEBHOOK_AUTH_PASSWORD=your-password
```

**Get the webhook URLs from your n8n dashboard:**
1. Go to the workflow
2. Find the webhook node
3. Copy the "Production URL"
4. Enable Basic Auth and set username/password

## Step 3: Validate Configuration

Run the environment validation script:
```bash
pnpm validate-env
```

This will check that all required variables are set.

## Step 4: Apply Database Schema

Run the migrations to ensure all required columns exist:
```bash
pnpm db:migrate
```

Required columns:
- `ai_draft_content` (text) - AI-generated letter content
- `subject` (text) - Letter subject line
- `statutes_cited` (text[]) - Legal statutes referenced
- `legal_basis` (text) - Legal basis summary
- `next_steps` (text) - Recommended next steps
- `delivery_instructions` (text) - Jurisdiction-specific delivery instructions
- `pdf_storage_path` (text) - PDF storage location
- `pdf_generated_at` (timestamptz) - PDF generation timestamp
- `generated_at` (timestamptz) - AI generation timestamp

## Step 5: Test the Integration

### Test Letter Generation

1. Go to your app: `http://localhost:3000`
2. Submit a letter through the form
3. Check the workflow logs in n8n
4. Verify the letter appears with status `pending_review`

### Test PDF Generation

1. As an attorney, go to `/attorney-portal/review/[id]`
2. Approve a letter
3. Check PDF workflow logs in n8n
4. Verify `pdf_storage_path` is set in the letter record

## Error Handling

### Common Issues

1. **Webhook returns 401**: Check Basic Auth credentials
2. **Webhook returns 404**: Verify webhook URLs are correct
3. **Letter stuck in "generating"**: Check n8n execution logs
4. **PDF not generated**: Verify PDF webhook URL and permissions

### Debug Steps

1. Check n8n execution history in dashboard
2. View app logs for error messages
3. Run `pnpm validate-env` to check configuration
4. Test webhook URLs manually with curl

## Production Deployment

For Vercel deployment:

1. Add environment variables to Vercel Dashboard:
   - Use "Sensitive" type for all secrets
   - Public variables (NEXT_PUBLIC_*) use "Text" type
2. Run production build:
   ```bash
   CI=1 pnpm build
   ```
3. Deploy to production

## Security Notes

- Never commit environment variables to version control
- Use different credentials for development/staging/production
- Rotate secrets regularly (quarterly for production)
- Use Vercel's "Sensitive" type for all secret variables
- Enable audit logging for secret access in your n8n instance

## Monitoring

Both workflows are automatically monitored:

- Letter generation: App logs status changes and n8n execution
- PDF generation: Triggered automatically on letter approval
- Error notifications: Sent to subscribers when generation fails

## Troubleshooting

### n8n Tools

Use these commands for debugging:

```bash
# Check configuration
pnpm validate-env

# View logs (development only)
pnpm dev

# Run database migrations
pnpm db:migrate
```

### Check Configuration File

The app checks configuration at runtime:

```typescript
import { isN8nConfigured } from '@/lib/services/n8n-webhook-service'
console.log('n8n configured:', isN8nConfigured())
console.log('PDF configured:', isN8nPdfConfigured())
```

### Verify Workflow URLs

Test your webhooks directly:

```bash
# Test letter generation
curl -X POST YOUR_N8N_WEBHOOK_URL \
  -H "Authorization: Basic YOUR_BASE64_CREDS" \
  -H "Content-Type: application/json" \
  -d '{"letterType":"demand_letter","letterId":"test","userId":"test","intakeData":{}}'
```

## Support

For issues:
1. Check n8n execution logs
2. Verify environment variables
3. Review this setup guide
4. Check the application logs