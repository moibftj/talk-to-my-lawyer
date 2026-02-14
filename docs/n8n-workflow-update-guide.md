# n8n Workflow Update Guide

## Issue

The **Letter Generation Workflow** (`fRWD4L9r7WH4m81HlAkhV`) is missing a "Respond to Webhook" node at the end.

**Current workflow ends at:** "Save Generated Letter" (Supabase node)

**Expected:** Should return a JSON response to the webhook caller.

## Solution

### Step 1: Open Workflow in n8n

1. Go to https://designtec.app.n8n.cloud
2. Open workflow: **AI-Powered Legal Letter Generation with Jurisdiction Research**
3. Click **Edit** button

### Step 2: Add Respond to Webhook Node

1. Click **+** button at the end of the workflow (after "Save Generated Letter")
2. Search for **Respond to Webhook** node
3. Drag it to the canvas after "Save Generated Letter"
4. Connect them: drag from **Save Generated Letter** to **Respond to Webhook**

### Step 3: Configure Response Node

Click on the **Respond to Webhook** node and configure:

**Response Code:** `200`

**Response Body (JSON):**

```json
{
  "success": true,
  "letterId": {{ $('Extract Form Data').item.json.letterId }},
  "status": "pending_review",
  "supabaseUpdated": true,
  "message": "Letter generated successfully with jurisdiction research"
}
```

**Important:** Make sure "Respond to Webhook" is selected (NOT "Last Node" which is the default)

### Step 4: Save and Activate

1. Click **Save** in the top right
2. Make sure workflow is **Active** (toggle in top right)

## Verification

Test the webhook with curl:

```bash
curl -X POST https://designtec.app.n8n.cloud/webhook/legal-letter-submission \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic YOUR_BASE64_CREDENTIALS" \
  -d '{
    "letterType": "Demand Letter",
    "letterId": "test-letter-123",
    "userId": "test-user-456",
    "intakeData": {
      "senderName": "Test",
      "senderAddress": "123 Main St",
      "senderState": "CA",
      "recipientName": "Recipient",
      "recipientAddress": "456 Oak Ave",
      "recipientState": "NY",
      "issueDescription": "Test issue",
      "desiredOutcome": "Test outcome"
    }
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "letterId": "test-letter-123",
  "status": "pending_review",
  "supabaseUpdated": true,
  "message": "Letter generated successfully with jurisdiction research"
}
```

## PDF Workflow Status

The **PDF Generator Workflow** (`YleWYMCqBS2JRa0yGN_8Q`) already has a "Return Success Response" node (Respond to Webhook) at the end. No changes needed for this workflow.

## Next Steps

1. Configure environment variables in `.env.local` (see `.env.local` file)
2. Run database migrations: `pnpm db:migrate`
3. Test the full flow from your app
