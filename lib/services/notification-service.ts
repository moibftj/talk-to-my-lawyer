/**
 * Notification Service
 *
 * Centralizes all email notification logic for the application
 */

import { queueTemplateEmail } from '@/lib/email/service'
import { getAdminEmails, getAdminEmailsWithRoles } from '@/lib/admin/letter-actions'
import { getAppUrl } from '@/lib/config'

/**
 * Notify admins about a new letter pending review
 *
 * Sends role-appropriate links:
 * - Super admins get links to /secure-admin-gateway/review/{id}
 * - Attorney admins get links to /attorney-portal/review/{id}
 *
 * @param letterId - ID of the letter
 * @param letterTitle - Title of the letter
 * @param letterType - Type of letter
 */
export async function notifyAdminsNewLetter(
  letterId: string,
  letterTitle: string,
  letterType: string
): Promise<void> {
  const adminsWithRoles = await getAdminEmailsWithRoles()

  if (adminsWithRoles.length === 0) {
    console.warn('[NotificationService] No admin emails configured')
    return
  }

  const siteUrl = getAppUrl()

  const superAdminEmails = adminsWithRoles
    .filter(a => a.subRole === 'super_admin')
    .map(a => a.email)

  const attorneyAdminEmails = adminsWithRoles
    .filter(a => a.subRole === 'attorney_admin')
    .map(a => a.email)

  try {
    const promises: Promise<unknown>[] = []

    if (superAdminEmails.length > 0) {
      promises.push(
        queueTemplateEmail('admin-alert', superAdminEmails, {
          alertMessage: `New letter "${letterTitle}" requires review. Letter type: ${letterType}`,
          actionUrl: `${siteUrl}/secure-admin-gateway/review/${letterId}`,
          pendingReviews: 1,
        })
      )
    }

    if (attorneyAdminEmails.length > 0) {
      promises.push(
        queueTemplateEmail('admin-alert', attorneyAdminEmails, {
          alertMessage: `New letter "${letterTitle}" requires review. Letter type: ${letterType}`,
          actionUrl: `${siteUrl}/attorney-portal/review/${letterId}`,
          pendingReviews: 1,
        })
      )
    }

    await Promise.all(promises)
    console.log('[NotificationService] Admin notifications queued for letter:', letterId,
      `(${superAdminEmails.length} super admins, ${attorneyAdminEmails.length} attorney admins)`)
  } catch (error) {
    console.error('[NotificationService] Failed to queue admin notification:', error)
  }
}

/**
 * Notify user about letter approval
 *
 * @param userEmail - User's email address
 * @param userName - User's name
 * @param letterTitle - Title of the approved letter
 * @param letterId - ID of the letter
 */
export async function notifyUserLetterApproved(
  userEmail: string,
  userName: string,
  letterTitle: string,
  letterId: string
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('letter-approved', userEmail, {
      userName,
      letterTitle,
      letterLink: `${siteUrl}/dashboard/letters/${letterId}`,
    })
    console.log('[NotificationService] Approval notification queued for user:', userEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue approval notification:', error)
  }
}

/**
 * Notify user about letter rejection
 *
 * @param userEmail - User's email address
 * @param userName - User's name
 * @param letterTitle - Title of the rejected letter
 * @param rejectionReason - Reason for rejection
 * @param letterId - ID of the letter
 */
export async function notifyUserLetterRejected(
  userEmail: string,
  userName: string,
  letterTitle: string,
  rejectionReason: string,
  letterId: string
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('letter-rejected', userEmail, {
      userName,
      letterTitle,
      rejectionReason,
      letterLink: `${siteUrl}/dashboard/letters/${letterId}`,
    })
    console.log('[NotificationService] Rejection notification queued for user:', userEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue rejection notification:', error)
  }
}

/**
 * Notify user when letter is generated
 *
 * @param userEmail - User's email address
 * @param userName - User's name
 * @param letterTitle - Title of the letter
 * @param letterId - ID of the letter
 */
export async function notifyUserLetterGenerated(
  userEmail: string,
  userName: string,
  letterTitle: string,
  letterId: string
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('letter-generated', userEmail, {
      userName,
      letterTitle,
      letterLink: `${siteUrl}/dashboard/letters/${letterId}`,
    })
    console.log('[NotificationService] Generation notification queued for user:', userEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue generation notification:', error)
  }
}

/**
 * Notify user when letter is under review
 *
 * @param userEmail - User's email address
 * @param userName - User's name
 * @param letterTitle - Title of the letter
 * @param letterId - ID of the letter
 */
export async function notifyUserLetterUnderReview(
  userEmail: string,
  userName: string,
  letterTitle: string,
  letterId: string
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('letter-under-review', userEmail, {
      userName,
      letterTitle,
      letterLink: `${siteUrl}/dashboard/letters/${letterId}`,
    })
    console.log('[NotificationService] Review notification queued for user:', userEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue review notification:', error)
  }
}

export async function notifyAttorneyLetterAssigned(
  attorneyEmail: string,
  attorneyName: string,
  letterTitle: string,
  letterId: string,
  letterType: string
): Promise<void> {
  const siteUrl = getAppUrl()

  try {
    await queueTemplateEmail('admin-alert', attorneyEmail, {
      alertMessage: `You have been assigned a new letter for review: "${letterTitle}" (${letterType}). Please review it at your earliest convenience.`,
      actionUrl: `${siteUrl}/attorney-portal/review/${letterId}`,
      pendingReviews: 1,
    })
    console.log('[NotificationService] Assignment notification queued for attorney:', attorneyEmail)
  } catch (error) {
    console.error('[NotificationService] Failed to queue assignment notification:', error)
  }
}
