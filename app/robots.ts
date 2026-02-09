import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/*',
          '/secure-admin-gateway/*',
          '/attorney-portal/*',
          '/api/*',
          '/auth/callback',
        ],
      },
    ],
    sitemap: 'https://www.talk-to-my-lawyer.com/sitemap.xml',
  }
}
