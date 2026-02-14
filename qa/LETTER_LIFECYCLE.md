# Part 5 & 6 — Letter Lifecycle + Review Center

## Part 5: Letter Lifecycle (Core Product)

### Letter Types

| Letter Type | Description |
|-------------|-------------|
| Breach of Contract | Contract violation demand |
| Demand for Payment | Payment collection letter |
| Cease and Desist | Stop unwanted behavior |
| Pre-Litigation Settlement | Settlement offer before lawsuit |
| Debt Collection | Formal debt collection notice |

### Letter Status Flow

```
draft → generating → pending_review → under_review → approved → completed
                                                  ↘ rejected → (resubmit) → pending_review
                   ↘ failed
```

### Status Definitions

| Status | Description |
|--------|-------------|
| `draft` | Initial state, user filling form |
| `generating` | AI is generating content |
| `pending_review` | Awaiting attorney review |
| `under_review` | Attorney has claimed for review |
| `approved` | Attorney approved |
| `completed` | Finalized and delivered |
| `rejected` | Needs revision |
| `failed` | Generation failed |

### Test Scenarios for Each Letter Type

#### Test Flow Template (Repeat for Each Letter Type)

**Step 1: Start Letter**
1. Login as subscriber with active subscription
2. Navigate to `/dashboard/letters/new`
3. Select letter type
4. Fill required fields
5. **Verify**: Form validation works for required fields

**Step 2: Submit Letter**
1. Submit the form
2. **Verify**: Entitlement check happens BEFORE generation
3. **Verify**: Status changes to `generating`
4. Wait for AI generation
5. **Verify**: Status changes to `pending_review` or `completed`

**Step 3: Verify Letter Created**
1. Check letter appears in `/dashboard/letters`
2. **Verify**: Correct metadata (title, type, timestamp)
3. **Verify**: Status is correct

**Step 4: Delivery Mechanism**
1. Access the letter
2. **Verify**: PDF download works
3. **Verify**: Letter content is accessible
4. **Verify**: Email notification sent (if configured)

**Step 5: History List**
1. Navigate to `/dashboard/letters`
2. **Verify**: Letter appears with correct metadata
3. **Verify**: Timestamp is accurate
4. **Verify**: Status badge is correct

### Edge Case Tests

#### Edge 5.1: Refresh Mid-Process
1. Start letter generation
2. Refresh page during `generating` status
3. **Verify**: No double charge
4. **Verify**: Letter state is preserved
5. **Verify**: Can resume or view result

#### Edge 5.2: Long Text + Special Characters
1. Create letter with:
   - Very long descriptions (5000+ characters)
   - Special characters: `<script>`, `'`, `"`, `&`, `日本語`
   - Unicode emojis: 🔥📧
2. Submit letter
3. **Verify**: No crash
4. **Verify**: Output renders correctly
5. **Verify**: No XSS vulnerabilities

#### Edge 5.3: Concurrent Letter Generation
1. Open two browser tabs
2. Start letter generation in both simultaneously
3. **Verify**: Both letters created correctly
4. **Verify**: No race conditions
5. **Verify**: Correct billing for both

#### Edge 5.4: N8N Workflow Failure (Resilience Test)
1. Temporarily disable n8n or provide invalid `N8N_WEBHOOK_URL`
2. Submit a letter request
3. **Verify**: Application catches the error and triggers OpenAI fallback
4. **Verify**: Letter is still generated successfully
5. **Verify**: Status becomes `pending_review`
6. **Verify**: Database `generation_metadata` shows `method: 'openai_fallback'`
7. **Verify**: No credit refund (since generation succeeded)

### Ask/Verify Questions

**Q: Where are letters stored?**
A: 
- **Database**: `letters` table stores metadata and content
- **File Storage**: PDF files stored in Supabase Storage
- **Access Control**: RLS policies ensure users can only access their own letters

**Q: Can someone guess a letter ID and download another user's letter?**
A: No. Access is protected by:
1. RLS policy: `user_id = auth.uid()`
2. API route checks: Ownership verification before serving
3. Signed URLs: PDF downloads use time-limited signed URLs

---

## Part 6: Review Center (Attorney Admin + Super Admin)

### Access Requirements

| Role | Review Center Access | Actions |
|------|---------------------|---------|
| `subscriber` | ❌ No | N/A |
| `employee` | ❌ No | N/A |
| `attorney_admin` | ✅ Yes | Review, Approve, Reject, Edit |
| `super_admin` | ✅ Yes | All attorney_admin actions + System controls |

### Review Center Routes

| Route | Description |
|-------|-------------|
| `/attorney-portal/review` | Attorney portal review queue |
| `/attorney-portal/review/[id]` | Review specific letter |
| `/secure-admin-gateway/review` | Admin review center |
| `/secure-admin-gateway/review/[id]` | Admin review specific letter |

### Test Scenarios

#### Test 6.1: Submit Letter for Review
1. Login as subscriber
2. Create and submit a letter
3. **Verify**: Letter status is `pending_review`
4. **Verify**: Letter appears in review queue

#### Test 6.2: Attorney Admin Review
1. Login as `test-attorney@example.com` (attorney_admin)
2. Navigate to Review Center
3. **Verify**: Review Center is visible
4. Open the submitted letter
5. **Verify**: Can view letter content
6. **Verify**: Can perform actions:
   - Claim for review (`under_review`)
   - Approve (`approved`)
   - Reject with reason (`rejected`)
   - Edit content

#### Test 6.3: Super Admin Review
1. Login as `test-superadmin@example.com` (super_admin)
2. Navigate to Review Center
3. **Verify**: Same Review Center visibility as attorney_admin
4. **Verify**: Same action set available
5. **Verify**: Additional system controls accessible

#### Test 6.4: Status Reflection to Subscriber
1. Attorney approves/rejects letter
2. Login as subscriber
3. **Verify**: Status change reflected in dashboard
4. **Verify**: Notification sent (email)
5. **Verify**: Rejection reason visible if rejected

#### Test 6.5: Audit Trail
1. Perform review actions
2. Check `letter_audit_trail` table
3. **Verify**: All actions logged with:
   - `performed_by` (admin ID)
   - `old_status` → `new_status`
   - `notes`
   - `created_at` timestamp

### Review Center Actions

| Action | Endpoint | Required Role |
|--------|----------|---------------|
| List pending letters | `GET /api/admin/letters` | `requireAdminAuth()` |
| Claim for review | `POST /api/letters/[id]/start-review` | `requireAttorneyAdminAccess()` |
| Approve letter | `POST /api/letters/[id]/approve` | `requireAttorneyAdminAccess()` |
| Reject letter | `POST /api/letters/[id]/reject` | `requireAttorneyAdminAccess()` |
| Update letter | `PATCH /api/admin/letters/[id]/update` | `requireAdminAuth()` |
| Batch operations | `POST /api/admin/letters/batch` | `requireAdminAuth()` |

### Ask/Verify Questions

**Q: List every Review Center action and role permission for each.**
A: See table above. Both `attorney_admin` and `super_admin` have identical Review Center permissions. Super Admin has additional system-wide permissions (analytics, user management, etc.).

**Q: Show the audit log for status changes.**
A: The `letter_audit_trail` table records:
```sql
SELECT 
  action,
  performed_by,
  old_status,
  new_status,
  notes,
  created_at
FROM letter_audit_trail
WHERE letter_id = '<letter_id>'
ORDER BY created_at DESC;
```

### Naming Consistency Check

**Verify**: "Super Admin" naming is unified across:
- [ ] Database (`admin_sub_role = 'super_admin'`)
- [ ] UI labels
- [ ] API responses
- [ ] Documentation

**Note**: Ensure no split naming like "super/system" in different places.
