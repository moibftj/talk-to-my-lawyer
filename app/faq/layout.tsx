import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Talk-to-my-Lawyer",
  description: "Common questions about our legal letter service. Learn about pricing, attorney review process, turnaround times, and more.",
}

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
