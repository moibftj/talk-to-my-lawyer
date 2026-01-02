import { getAdminCSRFToken } from '@/lib/api/admin-action-handler'

export async function GET() {
  return getAdminCSRFToken()
}
