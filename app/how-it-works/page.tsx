'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { Scale, ClipboardList, PenTool, CheckCircle, Mail, FileDown, ArrowRight, Home } from 'lucide-react'
import Link from 'next/link'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

const steps = [
  {
    number: 1,
    title: 'Submit Your Dispute',
    description: 'Tell us about your situation. Provide the details of your dispute, including relevant parties, dates, and what resolution you are seeking.',
    icon: ClipboardList,
  },
  {
    number: 2,
    title: 'Attorney Drafts Your Letter',
    description: 'A licensed attorney reviews your information and drafts a professional legal letter tailored to your specific situation.',
    icon: PenTool,
  },
  {
    number: 3,
    title: 'Attorney Approved',
    description: 'Your letter is attorney approved to ensure it meets professional legal standards and effectively communicates your position.',
    icon: CheckCircle,
  },
  {
    number: 4,
    title: 'Letter Delivered via Email',
    description: 'Your letter is sent directly to the recipient from a lawyer\'s email address on official law firm letterhead, adding credibility to your communication.',
    icon: Mail,
  },
  {
    number: 5,
    title: 'Receive Your PDF',
    description: 'You receive a PDF copy of your letter for your records. Keep it for documentation and future reference.',
    icon: FileDown,
  },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-blue-50/30">
      {/* Navigation Header */}
      <nav className="glass-card backdrop-blur-lg border-b border-sky-200/60 sticky top-0 z-50 bg-white/95 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-32 py-4">
            <Link href="/" className="flex items-center justify-center">
              <Image
                src={DEFAULT_LOGO_SRC}
                alt={DEFAULT_LOGO_ALT}
                width={128}
                height={128}
                className="h-32 w-32 rounded-full logo-badge"
                priority
              />
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center text-gray-600 hover:text-[#199df4] transition-colors">
                <Home className="w-4 h-4 mr-1" />
                Home
              </Link>
              <Link href="/auth/signup">
                <button className="px-6 py-2 bg-gradient-to-r from-[#199df4] to-[#0d8ae0] text-white rounded-lg font-medium hover:shadow-lg transition-all">
                  Get Started
                </button>
              </Link>
            </div>
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
              How It Works
            </h1>
            <p className="text-xl text-gray-600">
              Get a professional legal letter in 5 simple steps. Up to 48 hours turnaround.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="px-6 py-6 flex items-start gap-5">
                  {/* Step Number */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-[#199df4] to-[#0d8ae0] flex items-center justify-center text-white font-bold text-xl shadow-md">
                    {step.number}
                  </div>
                  
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-sky-100 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#199df4]" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
                
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="flex justify-start pl-10">
                    <div className="w-0.5 h-6 bg-gradient-to-b from-[#199df4] to-sky-200 -mt-1"></div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Benefits Summary */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-8"
          >
            <h2 className="text-2xl font-bold text-center mb-8">What You Get</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#199df4] flex-shrink-0" />
                <span className="text-gray-700">Letter drafted by licensed attorney</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#199df4] flex-shrink-0" />
                <span className="text-gray-700">Attorney approved content</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#199df4] flex-shrink-0" />
                <span className="text-gray-700">Sent from lawyer&apos;s email address</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#199df4] flex-shrink-0" />
                <span className="text-gray-700">Official law firm letterhead</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#199df4] flex-shrink-0" />
                <span className="text-gray-700">PDF download for your records</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[#199df4] flex-shrink-0" />
                <span className="text-gray-700">Up to 48 hours turnaround</span>
              </div>
            </div>
          </motion.div>
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
          <p>&copy; 2025 TalkToMyLawyer.com. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
