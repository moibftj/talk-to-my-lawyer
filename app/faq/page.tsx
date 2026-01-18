'use client'

import { motion } from 'motion/react'
import { ChevronDown, FileText, Scale, Clock, Mail, Shield, CreditCard, AlertCircle, Users, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'


const faqs = [
  {
    id: 'what-types',
    question: 'What types of letters do you provide?',
    answer: 'Breach of Contract, Demand for Payment, Cease and Desist, Pre-Litigation Settlement, Debt Collection, and more. Each letter is custom made for your specific situation.',
    icon: FileText,
  },
  {
    id: 'who-drafts',
    question: 'Who drafts the letters?',
    answer: 'Letters are drafted by licensed attorneys and are custom made for your specific situation.',
    icon: Scale,
  },
  {
    id: 'attorney-approved',
    question: 'Are the letters attorney approved?',
    answer: 'Yes, every letter is attorney approved before delivery to ensure quality and legal accuracy.',
    icon: CheckCircle,
  },
  {
    id: 'how-long',
    question: 'How long does it take?',
    answer: 'Up to 48 hours turnaround. You will receive your completed letter via email within this timeframe.',
    icon: Clock,
  },
  {
    id: 'pricing',
    question: 'How much does it cost?',
    answer: 'Single Letter: $200. With Membership: $50 per letter (Monthly: $200/month, Annual: $2,000/year for 48 letters at ≈$41.67/letter).',
    icon: CreditCard,
  },
  {
    id: 'delivery',
    question: 'How are letters delivered?',
    answer: 'Letters are delivered via email from a lawyer\'s email address.',
    icon: Mail,
  },
  {
    id: 'pdf-download',
    question: 'Can I download a PDF?',
    answer: 'Yes, every letter includes a PDF download for your records.',
    icon: FileText,
  },
  {
    id: 'lawyer-email',
    question: 'Are letters sent from a lawyer\'s email?',
    answer: 'Yes, all letters are sent from a lawyer\'s email address on official law firm letterhead.',
    icon: Shield,
  },
  {
    id: 'membership',
    question: 'Do I need a membership?',
    answer: 'No. You can purchase a single letter for $200 without membership. Membership provides better pricing at $50 per letter.',
    icon: Users,
  },
  {
    id: 'letters-needed',
    question: 'How many letters do disputes usually require?',
    answer: 'Most disputes require 4-10 letters as rebuttals and counteroffers are normal parts of the dispute resolution process.',
    icon: AlertCircle,
  },
]

const iconMap: Record<string, any> = {
  FileText,
  Scale,
  Clock,
  Mail,
  Shield,
  CreditCard,
  AlertCircle,
  Users,
  CheckCircle,
}

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-blue-50/30">
      {/* Navigation Header */}
      <nav className="glass-card backdrop-blur-lg border-b border-sky-200/60 sticky top-0 z-50 bg-white/95 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-3">
              <Scale className="h-8 w-8 text-[#199df4]" />
              <span className="text-xl font-bold text-gradient-animated">TalkToMyLawyer.com</span>
            </Link>
            <Link href="/auth/signup">
              <button className="px-6 py-2 bg-gradient-to-r from-[#199df4] to-[#0d8ae0] text-white rounded-lg font-medium hover:shadow-lg transition-all">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-gray-600">
              Information about our legal letter services.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ Items */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {faqs.map((faq, index) => {
            const Icon = iconMap[faq.icon.name] || FileText
            return (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => toggle(faq.id)}
                  className="w-full px-6 py-5 flex items-start gap-4 text-left hover:bg-sky-50/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#199df4]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 pr-8">{faq.question}</h3>
                  </div>
                  <motion.div
                    animate={{ rotate: openId === faq.id ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </motion.div>
                </button>
                <motion.div
                  initial={false}
                  animate={{
                    height: openId === faq.id ? 'auto' : 0,
                    opacity: openId === faq.id ? 1 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-5 pl-20">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </div>
      </section>



      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2025 TalkToMyLawyer.com. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
