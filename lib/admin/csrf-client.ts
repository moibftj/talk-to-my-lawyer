let cachedToken: string | null = null
let cachedExpiresAt: number | null = null

export async function getAdminCsrfToken(): Promise<string> {
  const now = Date.now()

  if (cachedToken && cachedExpiresAt && now < cachedExpiresAt - 60_000) {
    return cachedToken
  }

  const response = await fetch('/api/admin/csrf', { method: 'GET' })
  const data = await response.json()

  if (!response.ok || !data?.csrfToken) {
    const message = data?.error || 'Failed to fetch CSRF token'
    throw new Error(message)
  }

  cachedToken = data.csrfToken
  cachedExpiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : now + 10 * 60 * 1000

  return cachedToken
}
