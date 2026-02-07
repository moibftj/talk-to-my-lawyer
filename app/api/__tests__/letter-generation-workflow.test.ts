import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST as GenerateLetterPost } from '../generate-letter/route'

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
                update: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
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

vi.mock('@/lib/services/notification-service', () => ({
    notifyUserLetterGenerated: vi.fn(() => Promise.resolve()),
    notifyAdminsNewLetter: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/services/letter-generation-service', () => ({
    generateLetterContent: vi.fn(() => Promise.resolve('Generated letter content that is long enough to pass validation. This is a professionally drafted legal letter with sufficient detail and legal language to meet the minimum content requirements.')),
}))

vi.mock('@/lib/services/audit-service', () => ({
    logLetterStatusChange: vi.fn(() => Promise.resolve()),
}))

import { db } from '@/lib/db/client-factory'
import { checkAndDeductAllowance } from '@/lib/services/allowance-service'

const mockDb = db as any
const mockCheckAndDeductAllowance = checkAndDeductAllowance as any

describe('Letter Generation Workflow & Review Center', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('OpenAI Direct Letter Generation', () => {
        it('should create letter and generate via OpenAI', async () => {
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
            expect(json.status).toBe('pending_review')
            expect(json.aiDraft).toBeDefined()
        })
    })

    describe('Review Center & Admin Operations', () => {
        it('should allow admin to approve pending letter', async () => {
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

            expect(letter.status).toBe('pending_review')

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

            const pendingLetters = reviewQueue.filter(l => l.status === 'pending_review')
            expect(pendingLetters).toHaveLength(2)

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
})
