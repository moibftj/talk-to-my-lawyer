import type { Metadata } from "next"
import { Toaster } from 'sonner'
import { Playfair_Display, Inter } from 'next/font/google'
import "./globals.css"

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
})

const DEFAULT_APP_URL = 'https://www.talk-to-my-lawyer.com'

const APP_URL = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).toString()
  } catch (error) {
    console.error('[metadata] Invalid NEXT_PUBLIC_APP_URL, falling back to default', error)
    return DEFAULT_APP_URL
  }
})()
const LOGO_URL = '/logo.png'

export const metadata: Metadata = {
  title: "Talk-to-my-Lawyer - Professional Legal Letters",
  description: "Professional legal letter generation with attorney approval. Get demand letters, cease and desist notices, and more.",
  generator: 'v0.app',
  metadataBase: new URL(APP_URL),
  icons: {
    icon: [
      { url: LOGO_URL, type: 'image/png' },
    ],
    apple: [
      { url: LOGO_URL, type: 'image/png' },
    ],
  },
  openGraph: {
    images: [{ url: LOGO_URL }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${playfair.variable} ${inter.variable}`}>
      <head>
        <link rel="icon" href={LOGO_URL} type="image/png" />
        <link rel="apple-touch-icon" href={LOGO_URL} />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
