'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { Scale, Phone, Mail, Clock, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export default function ContactPage() {
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
                width={128}
                height={128}
                className="h-32 w-32 rounded-full logo-badge"
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

      {/* Back Navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link href="/" className="inline-flex items-center text-[#199df4] hover:text-[#0d8ae0] transition-colors">
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Home
        </Link>
      </div>

      {/* Header */}
      <section className="pt-12 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Talk to Someone First
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Have questions before getting started? We are here to help you understand how our service works.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Phone Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center mx-auto mb-6">
                <Phone className="w-8 h-8 text-[#199df4]" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Call Us</h2>
              <p className="text-gray-600 mb-6">
                Speak directly with our team to discuss your situation and learn how we can help.
              </p>
              <div className="bg-sky-50 rounded-lg p-4 mb-4">
                <p className="text-2xl font-bold text-[#199df4]">800-110-0012</p>
                <p className="text-sm text-gray-500 mt-1">Coming Soon</p>
              </div>
              <div className="flex items-center justify-center text-gray-500 text-sm">
                <Clock className="w-4 h-4 mr-2" />
                <span>Mon-Fri: 9am - 6pm EST</span>
              </div>
            </motion.div>

            {/* Email Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-[#199df4]" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Email Us</h2>
              <p className="text-gray-600 mb-6">
                Send us your questions and we will respond within one business day.
              </p>
              <div className="bg-sky-50 rounded-lg p-4 mb-4">
                <a href="mailto:support@talktomylawyer.com" className="text-xl font-bold text-[#199df4] hover:underline">
                  support@talktomylawyer.com
                </a>
              </div>
              <p className="text-gray-500 text-sm">
                We typically respond within 24 hours
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What We Can Help With */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-8"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">What We Can Help You With</h2>
            <ul className="space-y-4 text-gray-600">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-[#199df4] rounded-full mt-2 mr-3 shrink-0"></span>
                <span>Understanding which type of letter is right for your situation</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-[#199df4] rounded-full mt-2 mr-3 shrink-0"></span>
                <span>Learning how the letter drafting and approval process works</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-[#199df4] rounded-full mt-2 mr-3 shrink-0"></span>
                <span>Choosing between single letters and membership</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-[#199df4] rounded-full mt-2 mr-3 shrink-0"></span>
                <span>Questions about pricing, delivery, and turnaround times</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-[#199df4] rounded-full mt-2 mr-3 shrink-0"></span>
                <span>Technical support with your account</span>
              </li>
            </ul>
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
            className="bg-linear-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] rounded-2xl p-12 text-center text-white"
          >
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-blue-200 mb-8 max-w-2xl mx-auto">
              Create your account and submit your first letter request today.
            </p>
            <Link href="/auth/signup">
              <button className="px-8 py-4 bg-white text-[#0a2540] rounded-xl font-semibold hover:bg-sky-50 transition-all">
                Get Started Now
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-linear-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2025 TalkToMyLawyer.com. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
