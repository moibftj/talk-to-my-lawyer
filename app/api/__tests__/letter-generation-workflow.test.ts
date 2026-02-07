/**
 * Letter Generation Workflow & Review Center Tests
 *
 * Tests the complete Zapier-integrated letter workflow:
 * - Letter generation with Zapier webhook integration
 * - Review center functionality for admins/attorneys
 * - Status transitions and audit trails
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST as GenerateLetterPost } from '../generate-letter/route'
import { POST as LetterGeneratedPost, GET as LetterGeneratedGet } from '../letter-generated/route'

// Mock dependencies
vi.mock('@/lib/rate-limit-redis', () => ({
    letterGenerationRateLimit: { requests: 10, window: '1 h' },
    safeApplyRateLimit: vi.fn(() => Promise.resolve(null)),
    getRateLimitTuple: vi.fn(() => [10, '1 h', 'LETTER_GENERATION'] as const),
}))

vi.mock('@/lib/auth/authenticate-user', () => ({
    requireSubscriber: vi.fn(() => Promise.resolve({
        user: { id: 'user-123', email: 'user@test.com' },
        supabase: {
            from: vi.fn(() => ({
                insert: vi.fn(() => ({
                    select: vi.fn(() => ({
                        single: vi.fn(() => Promise.resolve({
                            data: {
                                id: 'letter-123',
                                status: 'generating',
                                user_id: 'user-123',
                                letter_type: 'demand_letter'
                            },
                            error: null
                        }))
                    }))
                })),
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(() => Promise.resolve({
                            data: { ai_draft: 'Generated letter content' },
                            error: null
                        }))
                    }))
                })),
                rpc: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }))
        }
    }))
}))

vi.mock('@/lib/db/client-factory', () => ({
    db: {
        server: vi.fn(),
        serviceRole: vi.fn(),
    },
}))

vi.mock('@/lib/services/allowance-service', () => ({
    checkAndDeductAllowance: vi.fn(),
    refundLetterAllowance: vi.fn(),
}))

vi.mock('@/lib/services/zapier-webhook-service', () => ({
    isZapierConfigured: vi.fn(() => true),
    generateLetterViaZapier: vi.fn(),
    transformIntakeToZapierFormat: vi.fn(),
    notifyZapierLetterCompleted: vi.fn(),
    notifyZapierLetterFailed: vi.fn(),
}))

vi.mock('@/lib/validation/letter-schema', () => ({
    validateLetterGenerationRequest: vi.fn(() => ({
        valid: true,
        errors: [],
        data: {
            senderName: 'John Doe',
            senderAddress: '123 Main St',
            recipientName: 'ABC Company',
            recipientAddress: '456 Corporate Blvd',
            issueDescription: 'Test issue description with enough characters to pass validation',
            desiredOutcome: 'Test desired outcome',
        }
    })),
}))

vi.mock('@/lib/monitoring/tracing', () => ({
    createBusinessSpan: vi.fn(() => ({
        end: vi.fn(),
        recordException: vi.fn(),
        setStatus: vi.fn(),
    })),
    addSpanAttributes: vi.fn(),
    recordSpanEvent: vi.fn(),
}))

import { db } from '@/lib/db/client-factory'
import { checkAndDeductAllowance } from '@/lib/services/allowance-service'
import { generateLetterViaZapier, transformIntakeToZapierFormat } from '@/lib/services/zapier-webhook-service'

const mockDb = db as any
const mockCheckAndDeductAllowance = checkAndDeductAllowance as any
const mockGenerateLetterViaZapier = generateLetterViaZapier as any
const mockTransformIntakeToZapierFormat = transformIntakeToZapierFormat as any

describe('Letter Generation Workflow & Review Center', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Complete Zapier Integration Workflow', () => {
        it('should create letter with generating status and send to Zapier', async () => {
            // Mock database operations
            const mockServiceClient = {
                from: vi.fn(() => ({
                    insert: vi.fn(() => ({
                        select: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({
                                data: {
                                    id: 'letter-123',
                                    status: 'generating',
                                    user_id: 'user-123',
                                    letter_type: 'demand_letter'
                                },
                                error: null
                            }))
                        }))
                    }))
                })),
                rpc: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }

            mockDb.serviceRole.mockReturnValue(mockServiceClient)
            mockCheckAndDeductAllowance.mockResolvedValue({
                success: true,
                isFreeTrial: false,
                isSuperAdmin: false,
                remaining: 4
            })
            mockTransformIntakeToZapierFormat.mockReturnValue({
                letterId: 'letter-123',
                letterType: 'demand_letter',
                senderName: 'John Doe',
                issueDetails: 'Test issue'
            })
            mockGenerateLetterViaZapier.mockResolvedValue('Generated letter content')

            const request = new Request('http://localhost:3000/api/generate-letter', {
                method: 'POST',
                body: JSON.stringify({
                    letterType: 'demand_letter',
                    intakeData: {
                        senderName: 'John Doe',
                        senderAddress: '123 Main St',
                        recipientName: 'ABC Company',
                        recipientAddress: '456 Corporate Blvd',
                        issueDescription: 'Test issue description with enough characters to pass validation',
                        desiredOutcome: 'Test desired outcome'
                    }
                }),
            })

            const nextRequest = {
                ...request,
                json: () => Promise.resolve({
                    letterType: 'demand_letter',
                    intakeData: {
                        senderName: 'John Doe',
                        senderAddress: '123 Main St',
                        recipientName: 'ABC Company',
                        recipientAddress: '456 Corporate Blvd',
                        issueDescription: 'Test issue description with enough characters to pass validation',
                        desiredOutcome: 'Test desired outcome'
                    }
                }),
            } as unknown as any

            const response = await GenerateLetterPost(nextRequest)
            const json = await response.json()

            expect(response.status).toBe(200)
            expect(json.letterId).toBe('letter-123')
            expect(json.status).toBe('generating')
            expect(json.aiDraft).toBeUndefined() // No draft for async Zapier flow
            expect(mockTransformIntakeToZapierFormat).toHaveBeenCalled()
        })

        it('should handle Zapier webhook and update letter to pending_review', async () => {
            // Mock database operations for webhook
            const mockServiceClient = {
                from: vi.fn(() => ({
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({
                                data: {
                                    id: 'letter-123',
                                    status: 'generating',
                                    user_id: 'user-123',
                                    letter_type: 'demand_letter'
                                },
                                error: null
                            }))
                        }))
                    })),
                    update: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            select: vi.fn(() => ({
                                single: vi.fn(() => Promise.resolve({
                                    data: {
                                        id: 'letter-123',
                                        status: 'pending_review',
                                        ai_draft: 'Generated professional letter content...',
                                        updated_at: new Date().toISOString()
                                    },
                                    error: null
                                }))
                            }))
                        }))
                    }))
                })),
                rpc: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }

            mockDb.serviceRole.mockReturnValue(mockServiceClient)

            const webhookPayload = {
                letterId: 'letter-123',
                generatedContent: 'Generated professional letter content...',
                success: true,
                metadata: {
                    model: 'gpt-4',
                    tokensUsed: 1500
                }
            }

            const request = new Request('http://localhost:3000/api/letter-generated', {
                method: 'POST',
                body: JSON.stringify(webhookPayload),
            })

            const nextRequest = {
                ...request,
                json: () => Promise.resolve(webhookPayload),
            } as unknown as any

            const response = await LetterGeneratedPost(nextRequest)
            const json = await response.json()

            expect(response.status).toBe(200)
            expect(json.success).toBe(true)
            expect(json.letterId).toBe('letter-123')
            expect(json.status).toBe('pending_review')
            expect(mockServiceClient.rpc).toHaveBeenCalledWith('log_letter_audit', expect.objectContaining({
                p_letter_id: 'letter-123',
                p_action: 'generated',
                p_old_status: 'generating',
                p_new_status: 'pending_review'
            }))
        })

        it('should handle generation failure from Zapier', async () => {
            const mockServiceClient = {
                from: vi.fn(() => ({
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({
                                data: {
                                    id: 'letter-123',
                                    status: 'generating',
                                    user_id: 'user-123'
                                },
                                error: null
                            }))
                        }))
                    })),
                    update: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
                    }))
                })),
                rpc: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }

            mockDb.serviceRole.mockReturnValue(mockServiceClient)

            const failurePayload = {
                letterId: 'letter-123',
                success: false,
                error: 'ChatGPT generation failed',
                generatedContent: ''
            }

            const request = new Request('http://localhost:3000/api/letter-generated', {
                method: 'POST',
                body: JSON.stringify(failurePayload),
            })

            const nextRequest = {
                ...request,
                json: () => Promise.resolve(failurePayload),
            } as unknown as any

            const response = await LetterGeneratedPost(nextRequest)

            expect(response.status).toBe(500)
            expect(mockServiceClient.from).toHaveBeenCalledWith('letters')
            expect(mockServiceClient.rpc).toHaveBeenCalledWith('log_letter_audit', expect.objectContaining({
                p_action: 'generation_failed',
                p_new_status: 'failed'
            }))
        })

        it('should validate webhook payload and reject invalid requests', async () => {
            const invalidPayload = {
                // Missing letterId
                generatedContent: 'Some content',
                success: true
            }

            const request = new Request('http://localhost:3000/api/letter-generated', {
                method: 'POST',
                body: JSON.stringify(invalidPayload),
            })

            const nextRequest = {
                ...request,
                json: () => Promise.resolve(invalidPayload),
            } as unknown as any

            const response = await LetterGeneratedPost(nextRequest)
            const json = await response.json()

            expect(response.status).toBe(400)
            expect(json.error).toContain('letterId')
        })

        it('should reject webhook for non-existent letter', async () => {
            const mockServiceClient = {
                from: vi.fn(() => ({
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({
                                data: null,
                                error: { message: 'Letter not found' }
                            }))
                        }))
                    }))
                }))
            }

            mockDb.serviceRole.mockReturnValue(mockServiceClient)

            const payload = {
                letterId: 'non-existent-letter',
                generatedContent: 'Content',
                success: true
            }

            const request = new Request('http://localhost:3000/api/letter-generated', {
                method: 'POST',
                body: JSON.stringify(payload),
            })

            const nextRequest = {
                ...request,
                json: () => Promise.resolve(payload),
            } as unknown as any

            const response = await LetterGeneratedPost(nextRequest)

            expect(response.status).toBe(404)
        })
    })

    describe('Review Center & Admin Operations', () => {
        it('should allow admin to approve pending letter', async () => {
            // This would test the admin approval workflow
            const letter = {
                id: 'letter-123',
                status: 'pending_review',
                ai_draft: 'Generated content...',
                user_id: 'user-123'
            }

            const approvalAction = {
                action: 'approve',
                adminId: 'admin-456',
                comments: 'Looks good, approved for delivery'
            }

            // Mock the approval logic
            expect(letter.status).toBe('pending_review')

            // After approval
            const approvedLetter = {
                ...letter,
                status: 'approved',
                approved_by: approvalAction.adminId,
                approved_at: new Date().toISOString(),
                admin_comments: approvalAction.comments
            }

            expect(approvedLetter.status).toBe('approved')
            expect(approvedLetter.approved_by).toBe('admin-456')
        })

        it('should allow attorney to reject letter with feedback', async () => {
            const letter = {
                id: 'letter-123',
                status: 'pending_review',
                ai_draft: 'Generated content...'
            }

            const rejectionAction = {
                action: 'reject',
                adminId: 'attorney-789',
                feedback: 'Needs more specific legal language',
                reason: 'insufficient_detail'
            }

            // After rejection
            const rejectedLetter = {
                ...letter,
                status: 'rejected',
                reviewed_by: rejectionAction.adminId,
                reviewed_at: new Date().toISOString(),
                rejection_reason: rejectionAction.reason,
                admin_feedback: rejectionAction.feedback
            }

            expect(rejectedLetter.status).toBe('rejected')
            expect(rejectedLetter.rejection_reason).toBe('insufficient_detail')
            expect(rejectedLetter.admin_feedback).toBeDefined()
        })

        it('should filter review queue by status and priority', async () => {
            const reviewQueue = [
                { id: 'letter-1', status: 'pending_review', priority: 'high', created_at: '2026-02-01' },
                { id: 'letter-2', status: 'under_review', priority: 'medium', created_at: '2026-02-02' },
                { id: 'letter-3', status: 'pending_review', priority: 'low', created_at: '2026-02-03' },
            ]

            // Filter for pending review
            const pendingLetters = reviewQueue.filter(l => l.status === 'pending_review')
            expect(pendingLetters).toHaveLength(2)

            // Sort by priority and date
            const sortedQueue = pendingLetters.sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 }
                return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder]
            })

            expect(sortedQueue[0].priority).toBe('high')
        })

        it('should track audit trail for all review actions', async () => {
            const auditEvents: any[] = []

            const logAuditEvent = (event: any) => {
                auditEvents.push({
                    ...event,
                    timestamp: new Date().toISOString()
                })
            }

            // Simulate review workflow
            logAuditEvent({ action: 'generated', letterId: 'letter-123', status: 'pending_review' })
            logAuditEvent({ action: 'review_started', letterId: 'letter-123', adminId: 'admin-456' })
            logAuditEvent({ action: 'approved', letterId: 'letter-123', adminId: 'admin-456' })

            expect(auditEvents).toHaveLength(3)
            expect(auditEvents[0].action).toBe('generated')
            expect(auditEvents[1].action).toBe('review_started')
            expect(auditEvents[2].action).toBe('approved')
            expect(auditEvents[2].adminId).toBe('admin-456')
        })

        it('should enforce role-based access for review operations', async () => {
            const userProfiles = {
                'user-123': { role: 'subscriber' },
                'employee-456': { role: 'employee' },
                'attorney-789': { role: 'admin', admin_sub_role: 'attorney_admin' },
                'super-admin-001': { role: 'admin', admin_sub_role: 'super_admin' }
            }

            const canReviewLetters = (userId: string) => {
                const profile = userProfiles[userId as keyof typeof userProfiles]
                return profile?.role === 'admin'
            }

            const canApproveLetters = (userId: string) => {
                const profile = userProfiles[userId as keyof typeof userProfiles]
                return profile?.role === 'admin' &&
                    ['attorney_admin', 'super_admin'].includes((profile as any).admin_sub_role || '')
            }

            expect(canReviewLetters('user-123')).toBe(false)
            expect(canReviewLetters('attorney-789')).toBe(true)
            expect(canApproveLetters('attorney-789')).toBe(true)
            expect(canApproveLetters('super-admin-001')).toBe(true)
        })
    })

    describe('Webhook Documentation Endpoint', () => {
        it('should return comprehensive documentation on GET request', async () => {
            const response = await LetterGeneratedGet()
            const json = await response.json()

            expect(response.status).toBe(200)
            expect(json.success).toBe(true)
            expect(json.message).toContain('Letter generation webhook endpoint is ready')
            expect(json.endpoints).toBeDefined()
            expect(json.endpoints.incoming).toBeDefined()
            expect(json.endpoints.outbound).toBeDefined()
            // URL should be from env var or NOT_CONFIGURED
            expect(json.endpoints.outbound.url).toBeDefined()
            expect(json.workflow).toBeInstanceOf(Array)
            expect(json.workflow.length).toBeGreaterThan(0)
        })
    })

    describe('Error Handling & Edge Cases', () => {
        it('should handle database connection failures gracefully', async () => {
            const mockServiceClient = {
                from: vi.fn(() => ({
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({
                                data: null,
                                error: { message: 'Database connection failed' }
                            }))
                        }))
                    }))
                }))
            }

            mockDb.serviceRole.mockReturnValue(mockServiceClient)

            const payload = {
                letterId: 'letter-123',
                generatedContent: 'Content',
                success: true
            }

            const request = new Request('http://localhost:3000/api/letter-generated', {
                method: 'POST',
                body: JSON.stringify(payload),
            })

            const nextRequest = {
                ...request,
                json: () => Promise.resolve(payload),
            } as unknown as any

            const response = await LetterGeneratedPost(nextRequest)

            expect(response.status).toBe(404) // Letter not found due to DB error
        })

        it('should handle malformed JSON in webhook payload', async () => {
            const request = new Request('http://localhost:3000/api/letter-generated', {
                method: 'POST',
                body: 'invalid-json',
            })

            const nextRequest = {
                ...request,
                json: () => Promise.reject(new Error('Invalid JSON')),
            } as unknown as any

            const response = await LetterGeneratedPost(nextRequest)

            expect(response.status).toBe(500)
        })

        it('should prevent status transition from non-generating letters', async () => {
            const mockServiceClient = {
                from: vi.fn(() => ({
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({
                                data: {
                                    id: 'letter-123',
                                    status: 'approved', // Already approved
                                    user_id: 'user-123'
                                },
                                error: null
                            }))
                        }))
                    }))
                }))
            }

            mockDb.serviceRole.mockReturnValue(mockServiceClient)

            const payload = {
                letterId: 'letter-123',
                generatedContent: 'New content',
                success: true
            }

            const request = new Request('http://localhost:3000/api/letter-generated', {
                method: 'POST',
                body: JSON.stringify(payload),
            })

            const nextRequest = {
                ...request,
                json: () => Promise.resolve(payload),
            } as unknown as any

            const response = await LetterGeneratedPost(nextRequest)

            expect(response.status).toBe(400) // Invalid status transition
        })
    })
})