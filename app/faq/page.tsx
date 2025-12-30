'use client'

import { motion } from 'motion/react'
import { ChevronDown, FileText, Scale, Clock, Mail, Shield, CreditCard, Home, Briefcase, Building, AlertCircle, Users, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

const faqs = [
  {
    id: 'what-types',
    question: 'What types of letters can I order?',
    answer: 'We offer a comprehensive range of professional legal letters, including Cease and Desist, Breach of Contract, Demand for Payment, Pre-Litigation Settlement, Debt Collection, and more. Each letter is custom made for your specific situation.',
    icon: FileText,
  },
  {
    id: 'who-drafts',
    question: 'Who drafts the letters?',
    answer: 'Letters are drafted by licensed attorneys and are custom made for your specific situation. Every letter is attorney approved before delivery to ensure quality and legal accuracy.',
    icon: Scale,
  },
  {
    id: 'how-long',
    question: 'How long does it take?',
    answer: 'Our standard turnaround time is up to 48 hours. You will receive your completed letter via email within this timeframe.',
    icon: Clock,
  },
  {
    id: 'sent-by-lawyer',
    question: 'Are letters sent by a lawyer?',
    answer: 'Yes, letters are sent from a lawyer\'s email address on official law firm letterhead. This adds credibility and weight to your legal communication.',
    icon: Mail,
  },
  {
    id: 'subscription',
    question: 'Is this a subscription?',
    answer: 'We offer flexible options. You can purchase a single letter ($200) or become a member ($50 per letter). Members also have access to our Monthly Plan ($200/month) or Annual Plan ($19.99/month) for ongoing legal communication needs.',
    icon: CreditCard,
  },
  {
    id: 'pricing',
    question: 'How does pricing work?',
    answer: 'With Membership: $50 per letter. Single Letter (No Membership): $200 per letter. Monthly Plan: $200 per month. Annual Plan: $19.99 per month (includes 48 letters per year). All letters include PDF download, delivery from a lawyer\'s email, official letterhead, professional formatting, and attorney approval.',
    icon: Shield,
  },
  {
    id: 'tenant-disputes',
    question: 'Can you help with tenant/landlord disputes?',
    answer: 'Yes, we provide legal letters for various tenant disputes including security deposit issues, lease violations, habitability problems, and eviction notices.',
    icon: Home,
  },
  {
    id: 'employment',
    question: 'Do you handle employment-related letters?',
    answer: 'Yes, we can help with workplace harassment, wrongful termination, wage disputes, and other HR & employment-related legal letters.',
    icon: Briefcase,
  },
  {
    id: 'property',
    question: 'What about property and real estate issues?',
    answer: 'We provide legal letters for property damage claims, boundary disputes, easement issues, and other real estate-related matters.',
    icon: Building,
  },
  {
    id: 'cease-desist',
    question: 'What is a Cease and Desist letter?',
    answer: 'A Cease and Desist letter is a formal request demanding that an individual or business stop a specific illegal or harmful activity, such as harassment, defamation, copyright infringement, or trademark violation.',
    icon: AlertCircle,
  },
  {
    id: 'debt-collection',
    question: 'Can you help with debt collection?',
    answer: 'Yes, we provide professional demand letters for debt collection to help you recover money owed to you by clients, customers, or businesses.',
    icon: Users,
  },
  {
    id: 'guarantee',
    question: 'What do I get with each letter?',
    answer: 'Every letter includes: PDF download for your records, sent from a lawyer\'s email address, on lawyer\'s letterhead, professionally formatted, attorney approved content, and up to 48 hours turnaround time.',
    icon: CheckCircle,
  },
]

const iconMap: Record<string, any> = {
  FileText,
  Scale,
  Clock,
  Mail,
  Shield,
  CreditCard,
  Home,
  Briefcase,
  Building,
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
              <span className="text-xl font-bold text-gradient-animated">Talk-To-My-Lawyer</span>
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
              Find answers to common questions about our legal letter services.
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

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] rounded-2xl p-12 text-center text-white"
          >
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-blue-200 mb-8 max-w-2xl mx-auto">
              Get your professional legal letter starting at $50 with membership.
            </p>
            <Link href="/auth/signup">
              <button className="px-8 py-4 bg-white text-[#0a2540] rounded-xl font-semibold hover:bg-sky-50 transition-all inline-flex items-center group">
                Get Started Now
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2025 Talk-To-My-Lawyer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
