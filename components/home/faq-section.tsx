'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TOP_FAQS } from '@/lib/data/faq-data'

export default function FAQSection() {
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id)
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <Badge className="bg-sky-100 text-[#199df4] mb-4">
            Common Questions
          </Badge>
          <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Quick answers to the most common questions about our services.
          </p>
        </div>

        <div className="space-y-4">
          {TOP_FAQS.map((faq, index) => {
            const isOpen = openId === faq.id
            return (
              <div
                key={faq.id}
                className="reveal-on-scroll bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                style={{ transitionDelay: `${index * 60}ms` }}
              >
                <button
                  onClick={() => toggle(faq.id)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-sky-50/50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 pr-8">{faq.question}</h3>
                  <div
                    className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="px-6 pb-5">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 text-[#199df4] font-semibold hover:text-[#0d8ae0] transition-colors group"
          >
            View All FAQs
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  )
}
