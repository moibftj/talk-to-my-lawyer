import { FileText, Scale, Clock, Mail, Shield, CreditCard, AlertCircle, Users, CheckCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface FAQItem {
  id: string
  question: string
  answer: string
}

export interface FAQItemWithIcon extends FAQItem {
  icon: LucideIcon
}

export const TOP_FAQS: FAQItem[] = [
  {
    id: 'what-types',
    question: 'What types of letters do you provide?',
    answer: 'Breach of Contract, Demand for Payment, Cease and Desist, Pre-Litigation Settlement, Debt Collection, and more. Each letter is custom made for your specific situation.',
  },
  {
    id: 'pricing',
    question: 'How much does it cost?',
    answer: 'Single Letter: $200. With Membership: $50 per letter (Monthly: $200/month, Annual: $2,000/year for 48 letters at ≈$41.67/letter).',
  },
  {
    id: 'how-long',
    question: 'How long does it take?',
    answer: 'Up to 48 hours turnaround. You will receive your completed letter via email within this timeframe.',
  },
  {
    id: 'attorney-approved',
    question: 'Are the letters attorney approved?',
    answer: 'Yes, every letter is attorney approved before delivery to ensure quality and legal accuracy.',
  },
  {
    id: 'delivery',
    question: 'How are letters delivered?',
    answer: 'Letters are delivered via email from a lawyer\'s email address and include a PDF download.',
  },
]

export const ALL_FAQS: FAQItemWithIcon[] = [
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
