'use client'

import Image from 'next/image'
import { Scale, Mail, FileText, MessageSquare, Shield, ArrowRight, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

const reasons = [
  {
    id: 'letterhead-impact',
    title: 'Emails Are Often Ignored',
    description: 'A formal letter on legal letterhead from a licensed attorney carries significantly more weight than an email or personal letter. Recipients understand that an attorney-drafted letter represents a serious legal position and demands attention.',
    icon: Mail,
  },
  {
    id: 'pre-litigation',
    title: 'The Final Step Before Litigation',
    description: 'Attorney letters serve as the formal pre-litigation step in dispute resolution. They establish a documented record of your legal position and demonstrate that you are prepared to pursue further legal action if necessary.',
    icon: Scale,
  },
  {
    id: 'multiple-letters',
    title: 'Most Disputes Require Multiple Letters',
    description: 'Dispute resolution is rarely a single-letter process. Most civil disputes require 4-10 letters to reach resolution. This includes initial demands, follow-up communications, responses to counterarguments, and final settlement correspondence.',
    icon: FileText,
  },
  {
    id: 'rebuttals',
    title: 'Rebuttals and Counteroffers Are Normal',
    description: 'When the other party responds to your letter, they will often dispute your claims, offer less than demanded, or raise new issues. Effective dispute resolution requires the ability to respond with attorney-approved rebuttals and counteroffers.',
    icon: MessageSquare,
  },
  {
    id: 'ongoing-disputes',
    title: 'Membership for Ongoing Disputes',
    description: 'If you are in an active dispute that requires multiple rounds of correspondence, membership provides the most cost-effective path to resolution. At $50 per letter versus $200 for single letters, membership makes sustained legal communication affordable.',
    icon: Shield,
  },
  {
    id: 'future-protection',
    title: 'Protection for Future Disputes',
    description: 'Life presents unexpected legal situations—neighbor disputes, contractor issues, debt collection, employment matters. Membership ensures you have immediate access to attorney-approved legal letters whenever a new situation arises.',
    icon: Shield,
  },
]

export default function MembershipPage() {
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

      {/* Back Navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link href="/" className="inline-flex items-center text-[#199df4] hover:text-[#0d8ae0] transition-colors">
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Home
        </Link>
      </div>

      {/* Header */}
      <section className="pt-12 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Why Join the Membership Program
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Understanding when membership makes sense for your legal communication needs.
          </p>
        </div>
      </section>

      {/* Reasons Section */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {reasons.map((reason, index) => {
            const Icon = reason.icon
            return (
              <div
                key={reason.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-sky-100 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#199df4]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">{reason.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{reason.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Summary Card */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">The Legal Reality</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Dispute resolution is a process, not a single event. The other party will respond, negotiate, and sometimes resist.
              Having the ability to send attorney-approved letters throughout this process—without worrying about per-letter costs—allows
              you to maintain consistent legal pressure until the matter is resolved.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Membership is designed for individuals and businesses who understand that legal disputes take time and multiple
              communications to resolve properly.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-linear-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] rounded-2xl p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to Become a Member?</h2>
            <p className="text-blue-200 mb-8 max-w-2xl mx-auto">
              Join the membership program and get attorney-approved letters at $50 each.
            </p>
            <Link href="/auth/signup">
              <button className="px-8 py-4 bg-white text-[#0a2540] rounded-xl font-semibold hover:bg-sky-50 transition-all inline-flex items-center group">
                Sign Up Now
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
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
