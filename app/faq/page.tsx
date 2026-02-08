'use client'

import Image from 'next/image'
import { ChevronDown, FileText } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'
import { ALL_FAQS } from '@/lib/data/faq-data'

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-sky-50/40 to-blue-50/30">
      {/* Navigation Header */}
      <nav className="glass-card backdrop-blur-lg border-b border-sky-200/60 sticky top-0 z-50 bg-white/95 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-32 py-4">
            <Link href="/" className="flex items-center justify-center">
              <Image
                src={DEFAULT_LOGO_SRC}
                alt={DEFAULT_LOGO_ALT}
                width={160}
                height={160}
                className="h-40 w-40 rounded-full logo-badge"
                priority
              />
            </Link>
            <Link href="/auth/signup">
              <button className="px-6 py-2 bg-linear-to-r from-[#199df4] to-[#0d8ae0] text-white rounded-lg font-medium hover:shadow-lg transition-all">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-gray-600">
            Information about our legal letter services.
          </p>
        </div>
      </section>

      {/* FAQ Items */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {ALL_FAQS.map((faq, index) => {
            const Icon = faq.icon || FileText
            const isOpen = openId === faq.id
            return (
              <div
                key={faq.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <button
                  onClick={() => toggle(faq.id)}
                  className="w-full px-6 py-5 flex items-start gap-4 text-left hover:bg-sky-50/50 transition-colors"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#199df4]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 pr-8">{faq.question}</h3>
                  </div>
                  <div
                    className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="px-6 pb-5 pl-20">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>



      {/* Footer */}
      <footer className="bg-linear-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2025 Talk-to-my-Lawyer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
