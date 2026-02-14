---
name: ttml-n8n-workflow-integration
description: n8n workflow integration for AI letter generation with jurisdiction research and direct database updates. Use when implementing n8n workflows, debugging webhook calls, handling fallbacks to OpenAI, or optimizing legal research automation.
---

# n8n Workflow Integration

## Architecture Overview

```
Primary Generation Path (Preferred):
User Request → API → n8n Webhook → GPT-4o + Legal Research → Direct DB Update → Response

Fallback Path (When n8n Unavailable):
User Request → API → OpenAI Direct → DB Update → Response
```

**Why n8n is Superior:**
- ✅ State-specific statute research (CA Civil Code §1942)
- ✅ Jurisdiction-aware legal conventions
- ✅ Required disclosure statements by state
- ✅ Direct Supabase integration (no callback needed)
- ✅ Geographic court jurisdiction awareness
- ✅ Richer legal context than standalone OpenAI

---

## Critical Rules (MUST Follow)

1. **[N8N FIRST]** ALWAYS attempt n8n workflow BEFORE OpenAI fallback. n8n provides superior legal context and jurisdiction research.

2. **[TIMEOUT DISCIPLINE]** n8n requests timeout at 55 seconds (5 second buffer before API 60s timeout). Use `AbortSignal.timeout(55000)`.

3. **[DIRECT DB UPDATE]** n8n workflow updates Supabase DIRECTLY. No callback webhook needed. API polls database for completion.

4. **[ERROR TRANSPARENCY]** n8n errors must include: error type, step failed, input data (sanitized), timestamp. Log for debugging.

5. **[FALLBACK GRACEFUL]** If n8n fails/timeouts, fallback to OpenAI must be SILENT to user. No "n8n failed" messages in UI.

6. **[WEBHOOK SECURITY]** n8n webhook URL must be HTTPS. Consider adding webhook signature verification for production.

7. **[PAYLOAD VALIDATION]** Validate n8n response contains required fields: `letter_id`, `ai_draft_content`, `status`. Reject incomplete responses.

8. **[JURISDICTION EXTRACTION]** n8n extracts jurisdiction from address if not provided. Falls back to 'CA' default.

9. **[RESEARCH DATA STORAGE]** Store n8n research results in `letters.research_data` JSONB field for attorney reference.

10. **[MONITORING]** Track n8n availability, response time, failure rate. Alert if <95% success rate or >30s average response time.

---

## n8n Workflow Configuration

> **Note**: For programmatic workflow management (fixing connections, monitoring health, etc.), see [`n8n-rest-api-management.md`](./n8n-rest-api-management.md)

### Environment Variables

**Application Side (Vercel):**
```env
# n8n Webhook URL (REQUIRED for n8n integration)
N8N_WEBHOOK_URL=https://designtec.app.n8n.cloud/webhook/legal-letter-submission

# n8n Basic Authentication (REQUIRED)
N8N_WEBHOOK_AUTH_USER=talk-to-my-lawyer
N8N_WEBHOOK_AUTH_PASSWORD=ttml-n8n-secure-2024
```

**n8n Workflow Side (n8n Environment Variables):**
```env
# Supabase Connection (for n8n direct DB access)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Service role for RLS bypass

# OpenAI (for letter generation)
OPENAI_API_KEY=sk-...

# Perplexity (optional - for legal research)
PERPLEXITY_API_KEY=pplx-...
```

**n8n REST API Access (for workflow management):**
```env
# Available in Manus environment for programmatic workflow fixes
N8N_INSTANCE_URL=https://designtec.app.n8n.cloud/workflow/fRWD4L9r7WH4m81HlAkhV
N8N_API_KEY=<JWT token for MCP server API>
```

### Availability Check

```typescript
export function isN8nConfigured(): boolean {
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  
  if (!webhookUrl) {
    console.log('[n8n] Not configured (N8N_WEBHOOK_URL missing)')
    return false
  }
  
  if (!webhookUrl.startsWith('https://')) {
    console.warn('[n8n] Insecure webhook URL (should be HTTPS):', webhookUrl)
    return false
  }
  
  return true
}
```

---

## API Integration Pattern

### Letter Generation Flow with n8n

```typescript
export async function POST(request: NextRequest) {
  const { letterType, intakeData, jurisdiction } = await request.json()
  
  // 1. Create letter record (status: generating)
  const { data: letter } = await supabase
    .from('letters')
    .insert({
      user_id: userId,
      letter_type: letterType,
      intake_data: intakeData,
      status: 'generating',
      created_at: new Date()
    })
    .select()
    .single()
  
  const letterId = letter.id
  
  // 2. Check n8n availability
  const n8nAvailable = isN8nConfigured()
  
  try {
    if (n8nAvailable) {
      // 3a. PRIMARY PATH: Call n8n workflow
      console.log('[Generation] Using n8n workflow for letter:', letterId)
      
      const n8nResult = await generateLetterViaN8n({
        letter_id: letterId,
        user_id: userId,
        letter_type: letterType,
        intake: intakeData,
        jurisdiction: jurisdiction || extractJurisdictionFromAddress(intakeData)
      })
      
      if (n8nResult.success) {
        console.log('[n8n] Letter generated successfully:', letterId)
        
        // n8n already updated DB, just verify
        const { data: updatedLetter } = await supabase
          .from('letters')
          .select('status, ai_draft_content')
          .eq('id', letterId)
          .single()
        
        if (updatedLetter?.status === 'pending_review') {
          return successResponse({
            letter_id: letterId,
            status: 'pending_review',
            message: 'Letter generated and queued for attorney review'
          })
        }
      }
      
      // n8n call failed, fallback to OpenAI
      console.warn('[n8n] Failed, falling back to OpenAI:', n8nResult.error)
    }
    
    // 3b. FALLBACK PATH: OpenAI direct generation
    console.log('[Generation] Using OpenAI fallback for letter:', letterId)
    
    const content = await generateLetterContent(userId, letterType, intakeData, jurisdiction)
    
    await supabase
      .from('letters')
      .update({
        ai_draft_content: content,
        status: 'pending_review',
        updated_at: new Date()
      })
      .eq('id', letterId)
    
    return successResponse({
      letter_id: letterId,
      status: 'pending_review',
      message: 'Letter generated and queued for attorney review'
    })
    
  } catch (error) {
    // Generation failed completely, refund allowance
    await refundLetterAllowance(userId, letterId, 1)
    
    await supabase
      .from('letters')
      .update({
        status: 'failed',
        error_message: error.message,
        updated_at: new Date()
      })
      .eq('id', letterId)
    
    throw error
  }
}
```

---

## n8n Webhook Call Implementation

### Request Payload Structure

```typescript
export interface N8nLetterRequest {
  letter_id: string           // UUID of letter record
  user_id: string             // UUID of requesting user
  letter_type: string         // demand-letter, cease-and-desist, etc.
  intake: {
    sender: {
      name: string
      address: string
      email?: string
      phone?: string
    }
    recipient: {
      name: string
      address: string
      email?: string
    }
    details: Record<string, any>  // Type-specific fields
    jurisdiction?: string          // State code (CA, NY, TX, etc.)
  }
  metadata?: {
    user_email: string
    created_at: string
  }
}
```

### Transform Intake to n8n Format

```typescript
export function transformIntakeToN8nFormat(
  letterId: string,
  userId: string,
  letterType: string,
  intakeData: any,
  jurisdiction?: string
): N8nLetterRequest {
  // Extract jurisdiction from address if not provided
  const extractedJurisdiction = jurisdiction || 
    extractStateCode(intakeData.sender_address) ||
    extractStateCode(intakeData.recipient_address) ||
    'CA'  // Default to California
  
  return {
    letter_id: letterId,
    user_id: userId,
    letter_type: letterType,
    intake: {
      sender: {
        name: intakeData.sender_name,
        address: intakeData.sender_address,
        email: intakeData.sender_email,
        phone: intakeData.sender_phone
      },
      recipient: {
        name: intakeData.recipient_name,
        address: intakeData.recipient_address,
        email: intakeData.recipient_email
      },
      details: extractTypeSpecificFields(letterType, intakeData),
      jurisdiction: extractedJurisdiction
    },
    metadata: {
      user_email: userEmail,
      created_at: new Date().toISOString()
    }
  }
}

// Helper: Extract state code from address
function extractStateCode(address: string): string | null {
  const statePattern = /\b([A-Z]{2})\s+\d{5}/  // Match "CA 12345"
  const match = address.match(statePattern)
  return match ? match[1] : null
}

// Helper: Extract type-specific fields
function extractTypeSpecificFields(letterType: string, intakeData: any): Record<string, any> {
  const typeFieldMap: Record<string, string[]> = {
    'demand-letter': ['amount_owed', 'deadline_date', 'incident_description'],
    'cease-and-desist': ['violation_description', 'demanded_action', 'deadline_date'],
    'contract-breach': ['contract_date', 'breach_description', 'remedy_sought'],
    'eviction-notice': ['property_address', 'reason_for_eviction', 'notice_period'],
    'employment-dispute': ['dispute_description', 'employment_dates', 'resolution_sought'],
    'consumer-complaint': ['complaint_description', 'purchase_date', 'resolution_sought']
  }
  
  const relevantFields = typeFieldMap[letterType] || []
  const details: Record<string, any> = {}
  
  for (const field of relevantFields) {
    if (intakeData[field] !== undefined) {
      details[field] = intakeData[field]
    }
  }
  
  return details
}
```

### Make n8n Webhook Call

```typescript
export async function generateLetterViaN8n(
  request: N8nLetterRequest
): Promise<N8nGenerationResult> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL!
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET
  
  try {
    console.log('[n8n] Calling webhook:', {
      letter_id: request.letter_id,
      letter_type: request.letter_type,
      jurisdiction: request.intake.jurisdiction
    })
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // Add authentication header if secret configured
    if (webhookSecret) {
      headers['X-Webhook-Secret'] = webhookSecret
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(55000)  // 55 second timeout
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[n8n] HTTP error:', response.status, errorText)
      
      return {
        success: false,
        error: `n8n returned ${response.status}: ${errorText}`,
        error_type: 'http_error'
      }
    }
    
    const result = await response.json()
    
    // Validate response structure
    if (!result.letter_id || !result.status) {
      console.error('[n8n] Invalid response structure:', result)
      
      return {
        success: false,
        error: 'n8n response missing required fields',
        error_type: 'invalid_response'
      }
    }
    
    console.log('[n8n] Success:', {
      letter_id: result.letter_id,
      status: result.status,
      has_research: !!result.research_data
    })
    
    return {
      success: true,
      letter_id: result.letter_id,
      status: result.status,
      ai_draft_content: result.ai_draft_content,
      research_data: result.research_data
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[n8n] Timeout after 55 seconds')
      return {
        success: false,
        error: 'n8n workflow timeout',
        error_type: 'timeout'
      }
    }
    
    console.error('[n8n] Request failed:', error)
    return {
      success: false,
      error: error.message,
      error_type: 'network_error'
    }
  }
}

export interface N8nGenerationResult {
  success: boolean
  letter_id?: string
  status?: string
  ai_draft_content?: string
  research_data?: {
    statutes_cited: string[]
    disclosures_required: string[]
    jurisdiction_notes: string
  }
  error?: string
  error_type?: 'http_error' | 'invalid_response' | 'timeout' | 'network_error'
}
```

---

## n8n Workflow Design

### Workflow Overview

```
n8n Workflow Steps:
1. Webhook Trigger (receives POST request)
   ↓
2. Extract Jurisdiction (from intake data)
   ↓
3. Research State Statutes (query legal databases)
   ↓
4. Extract Requirements (jurisdiction-specific rules)
   ↓
5. Build Context (combine intake + research)
   ↓
6. Call GPT-4o (with enriched legal context)
   ↓
7. Format Letter (professional business letter format)
   ↓
8. Update Supabase (direct database write)
   ↓
9. Return Response (success confirmation)
```

### Step 1: Webhook Trigger

**Node Type:** Webhook
**Method:** POST
**Path:** `/webhook/generate-letter`
**Authentication:** Header Auth (X-Webhook-Secret)

**Response Mode:** Wait for Completion

### Step 2: Extract Jurisdiction

**Node Type:** Code (JavaScript)

```javascript
// Extract jurisdiction from intake data
const intake = $input.item.json.intake
const jurisdiction = intake.jurisdiction || 'CA'

// Validate jurisdiction (must be 2-letter state code)
const validStates = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', ...] // All 50 states
if (!validStates.includes(jurisdiction)) {
  jurisdiction = 'CA'  // Default to California
}

return {
  json: {
    ...item.json,
    jurisdiction: jurisdiction,
    jurisdiction_full: getStateName(jurisdiction)
  }
}

function getStateName(code) {
  const stateMap = {
    'CA': 'California',
    'NY': 'New York',
    'TX': 'Texas',
    // ... all 50 states
  }
  return stateMap[code] || 'California'
}
```

### Step 3: Research State Statutes

**Node Type:** HTTP Request (to legal API)

**URL:** `https://legal-api.example.com/statutes`

**Query Parameters:**
```json
{
  "state": "{{ $json.jurisdiction }}",
  "letter_type": "{{ $json.letter_type }}",
  "topics": ["tenant_rights", "consumer_protection", "contract_law"]
}
```

**Response Processing:**
```javascript
// Extract relevant statutes
const statutes = $input.item.json.results.map(statute => ({
  code: statute.code_section,
  title: statute.title,
  summary: statute.summary,
  url: statute.official_url
}))

return {
  json: {
    statutes_cited: statutes,
    search_completed: true
  }
}
```

### Step 4: Extract Requirements

**Node Type:** Code (JavaScript)

```javascript
// Jurisdiction-specific requirements
const jurisdiction = $json.jurisdiction
const letterType = $json.letter_type

const requirements = {
  disclosures: [],
  legal_language: [],
  formatting_rules: []
}

// California-specific requirements
if (jurisdiction === 'CA') {
  if (letterType === 'eviction-notice') {
    requirements.disclosures.push('3-day notice required for non-payment')
    requirements.disclosures.push('Must include right to respond statement')
    requirements.legal_language.push('Reference to CA Civil Code §1161')
  }
  
  if (letterType === 'demand-letter') {
    requirements.disclosures.push('Consumer Legal Remedies Act notice')
    requirements.legal_language.push('30-day cure period required')
  }
}

// New York-specific requirements
if (jurisdiction === 'NY') {
  if (letterType === 'eviction-notice') {
    requirements.disclosures.push('14-day notice required')
    requirements.legal_language.push('Reference to NY Real Property Law §711')
  }
}

// Texas-specific requirements
if (jurisdiction === 'TX') {
  // ... Texas-specific rules
}

return {
  json: {
    jurisdiction_requirements: requirements
  }
}
```

### Step 5: Build GPT-4o Context

**Node Type:** Code (JavaScript)

```javascript
const intake = $json.intake
const statutes = $json.statutes_cited || []
const requirements = $json.jurisdiction_requirements

const systemPrompt = `You are a professional legal letter writer specializing in ${$json.jurisdiction_full} law.

JURISDICTION: ${$json.jurisdiction_full}
LETTER TYPE: ${$json.letter_type}

RELEVANT STATUTES:
${statutes.map(s => `- ${s.code}: ${s.title}`).join('\n')}

REQUIRED DISCLOSURES:
${requirements.disclosures.join('\n')}

LEGAL LANGUAGE TO INCLUDE:
${requirements.legal_language.join('\n')}

INSTRUCTIONS:
- Generate a formal ${$json.letter_type} based on the provided information
- Use professional business letter format
- Include appropriate legal references for ${$json.jurisdiction_full}
- Maintain a firm but professional tone
- Include all required disclosures
- DO NOT include placeholders like [INSERT X] - use actual provided data
- DO NOT include "This is not legal advice" disclaimers (attorney will review)
`

const userPrompt = `Generate a professional ${$json.letter_type} with the following details:

SENDER:
Name: ${intake.sender.name}
Address: ${intake.sender.address}

RECIPIENT:
Name: ${intake.recipient.name}
Address: ${intake.recipient.address}

CASE DETAILS:
${JSON.stringify(intake.details, null, 2)}

Generate a complete, professional letter that can be reviewed by an attorney.`

return {
  json: {
    system_prompt: systemPrompt,
    user_prompt: userPrompt
  }
}
```

### Step 6: Call GPT-4o

**Node Type:** OpenAI
**Model:** gpt-4-turbo
**Temperature:** 0.3
**Max Tokens:** 2000

**Messages:**
```json
[
  {
    "role": "system",
    "content": "{{ $json.system_prompt }}"
  },
  {
    "role": "user",
    "content": "{{ $json.user_prompt }}"
  }
]
```

### Step 7: Format Letter

**Node Type:** Code (JavaScript)

```javascript
const generatedContent = $input.item.json.choices[0].message.content

// Add letterhead and formatting
const formattedLetter = `
${generatedContent}

---
ATTORNEY REVIEW PENDING
This letter will be reviewed by a licensed attorney before delivery.
`.trim()

return {
  json: {
    ai_draft_content: formattedLetter,
    generation_completed: true
  }
}
```

### Step 8: Update Supabase

**Node Type:** Supabase (Database)
**Operation:** UPDATE
**Table:** letters
**Match:** id = {{ $json.letter_id }}

**Fields to Update:**
```json
{
  "ai_draft_content": "{{ $json.ai_draft_content }}",
  "status": "pending_review",
  "research_data": {
    "statutes_cited": "{{ $json.statutes_cited }}",
    "disclosures_required": "{{ $json.jurisdiction_requirements.disclosures }}",
    "jurisdiction_notes": "Generated for {{ $json.jurisdiction_full }}"
  },
  "updated_at": "{{ $now }}"
}
```

**Supabase Connection:**
```javascript
// Use service role key (bypasses RLS)
{
  url: process.env.N8N_SUPABASE_URL,
  key: process.env.N8N_SUPABASE_SERVICE_KEY
}
```

### Step 9: Return Response

**Node Type:** Respond to Webhook
**Response Code:** 200

**Response Body:**
```json
{
  "success": true,
  "letter_id": "{{ $json.letter_id }}",
  "status": "pending_review",
  "ai_draft_content": "{{ $json.ai_draft_content }}",
  "research_data": {
    "statutes_cited": "{{ $json.statutes_cited }}",
    "disclosures_required": "{{ $json.jurisdiction_requirements.disclosures }}",
    "jurisdiction_notes": "{{ $json.jurisdiction_requirements.notes }}"
  }
}
```

---

## Error Handling in n8n

### Workflow Error Catcher

**Node Type:** Error Trigger
**Connected to:** All nodes

**Error Response:**

```javascript
// Log error details
console.error('n8n workflow error:', {
  step: $json.$node.name,
  error: $json.error.message,
  letter_id: $json.letter_id
})

// Update letter status to failed
const supabaseUpdate = {
  table: 'letters',
  id: $json.letter_id,
  data: {
    status: 'failed',
    error_message: `n8n error at ${$json.$node.name}: ${$json.error.message}`,
    updated_at: new Date().toISOString()
  }
}

// Return error response
return {
  json: {
    success: false,
    error: $json.error.message,
    error_step: $json.$node.name,
    letter_id: $json.letter_id
  }
}
```

---

## Monitoring & Debugging

### n8n Availability Monitor

```typescript
// Cron job: Check n8n every 5 minutes
export async function checkN8nHealth() {
  if (!isN8nConfigured()) return
  
  try {
    const response = await fetch(process.env.N8N_WEBHOOK_URL + '/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    
    if (response.ok) {
      console.log('[n8n] Health check passed')
    } else {
      console.error('[n8n] Health check failed:', response.status)
      // Alert DevOps
    }
  } catch (error) {
    console.error('[n8n] Health check error:', error)
    // Alert DevOps
  }
}
```

### n8n Metrics Tracking

```typescript
// Track n8n performance
export interface N8nMetrics {
  total_calls: number
  successful_calls: number
  failed_calls: number
  timeout_calls: number
  average_response_time_ms: number
  last_success: Date | null
  last_failure: Date | null
}

// Store metrics in Redis
await redis.hincrby('n8n:metrics', 'total_calls', 1)
await redis.hincrby('n8n:metrics', 'successful_calls', result.success ? 1 : 0)
await redis.hincrby('n8n:metrics', 'failed_calls', result.success ? 0 : 1)
```

---

## Testing n8n Integration

### Manual Webhook Test

```bash
# Test n8n webhook directly
curl -X POST https://your-n8n.com/webhook/generate-letter \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "letter_id": "test-letter-id",
    "user_id": "test-user-id",
    "letter_type": "demand-letter",
    "intake": {
      "sender": {
        "name": "John Doe",
        "address": "123 Main St, Los Angeles, CA 90001"
      },
      "recipient": {
        "name": "Jane Smith",
        "address": "456 Oak Ave, Los Angeles, CA 90002"
      },
      "details": {
        "amount_owed": "5000.00",
        "deadline_date": "2026-03-01",
        "incident_description": "Unpaid invoice for services rendered"
      },
      "jurisdiction": "CA"
    }
  }'
```

### Integration Test

```typescript
describe('n8n Integration', () => {
  it('should generate letter via n8n workflow', async () => {
    const request: N8nLetterRequest = {
      letter_id: 'test-letter-123',
      user_id: 'test-user-456',
      letter_type: 'demand-letter',
      intake: {
        sender: { name: 'Test Sender', address: '123 Test St, CA 90001' },
        recipient: { name: 'Test Recipient', address: '456 Test Ave, CA 90002' },
        details: { amount_owed: '1000.00' },
        jurisdiction: 'CA'
      }
    }
    
    const result = await generateLetterViaN8n(request)
    
    expect(result.success).toBe(true)
    expect(result.letter_id).toBe('test-letter-123')
    expect(result.status).toBe('pending_review')
    expect(result.ai_draft_content).toBeDefined()
  })
})
```
