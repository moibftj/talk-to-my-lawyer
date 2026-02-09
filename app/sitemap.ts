import { MetadataRoute } from 'next'

const DEFAULT_APP_URL = 'https://www.talk-to-my-lawyer.com'

const APP_URL = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).toString()
  } catch (error) {
    console.error('[sitemap] Invalid NEXT_PUBLIC_APP_URL, falling back to default', error)
    return DEFAULT_APP_URL
  }
})()

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${APP_URL}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${APP_URL}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${APP_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${APP_URL}/membership`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${APP_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/auth/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${APP_URL}/auth/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}
