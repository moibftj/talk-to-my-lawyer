import type { Metadata } from "next"
// TODO: Re-enable once Vercel fixes recursion issue with Analytics
// import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const DEFAULT_APP_URL = 'https://www.talk-to-my-lawyer.com'

const APP_URL = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).toString()
  } catch (error) {
    console.error('[metadata] Invalid NEXT_PUBLIC_APP_URL, falling back to default', error)
    return DEFAULT_APP_URL
  }
})()
const LOGO_URL = '/talk-to-my-lawyer-logo.jpg'

export const metadata: Metadata = {
  title: "Talk-To-My-Lawyer - Professional Legal Letters",
  description: "Professional legal letter generation with attorney review. Get demand letters, cease and desist notices, and more.",
  generator: 'v0.app',
  metadataBase: new URL(APP_URL),
  icons: {
    icon: [
      { url: LOGO_URL, type: 'image/jpeg' },
    ],
    apple: [
      { url: LOGO_URL, type: 'image/jpeg' },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={LOGO_URL} type="image/jpeg" />
        <link rel="apple-touch-icon" href={LOGO_URL} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        {/* <Analytics /> */}
      </body>
    </html>
  )
}
