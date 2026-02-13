import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  Shield,
  FileText,
  Scale,
  CheckCircle,
  ArrowRight,
  Play,
  ChevronRight,
  Phone,
  Mail,
  Zap,
  Briefcase,
  AlertCircle,
  Gavel,
  Clock,
  Award,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PricingSection from "@/components/ui/pricing-section";
import HomepageNav from "@/components/home/homepage-nav";
import AuthRedirect from "@/components/home/auth-redirect";
import ScrollRevealWrapper from "@/components/home/scroll-reveal-wrapper";
import TestimonialsSection from "@/components/home/testimonials-section";
import FAQSection from "@/components/home/faq-section";

export const metadata: Metadata = {
  title: "Talk-to-my-Lawyer | Professional Legal Letters Drafted by Attorneys",
  description: "Get professional, attorney-reviewed legal letters in 24 hours. Demand letters, cease & desist, breach of contract notices starting at $50. Powered by AI, reviewed by real lawyers.",
  keywords: ["legal letters", "demand letter", "cease and desist", "attorney reviewed", "legal document", "breach of contract letter", "legal notice"],
  openGraph: {
    title: "Talk-to-my-Lawyer | Professional Legal Letters Drafted by Attorneys",
    description: "Get professional, attorney-reviewed legal letters in 24 hours. Demand letters, cease & desist, breach of contract notices starting at $50. Powered by AI, reviewed by real lawyers.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LegalService",
  name: "Talk-to-my-Lawyer",
  description: "Professional legal letter generation with attorney approval. Get demand letters, cease and desist notices, and more.",
  provider: {
    "@type": "Organization",
    name: "Talk-to-my-Lawyer",
    url: "https://www.talk-to-my-lawyer.com",
  },
  areaServed: "US",
  priceRange: "$50 - $200",
};

export default function Page() {
  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-legal-gold/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AuthRedirect />
      <ScrollRevealWrapper />

      <HomepageNav />

      {/* Hero Section */}
      <section className="relative pt-32 pb-40 px-6 lg:px-12 overflow-hidden bg-slate-50">
        {/* Subtle Background Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-l from-sky-50/50 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-legal-gold/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="text-left animate-fade-in">
              <Badge className="bg-legal-gold/10 text-legal-gold border-legal-gold/20 mb-6 px-4 py-1.5 text-sm font-semibold tracking-wide uppercase">
                Attorney-Reviewed Legal Letters
              </Badge>
              
              <h1 className="legal-heading-xl mb-8">
                Professional <span className="text-legal-gold italic">Legal Authority</span> at Your Fingertips.
              </h1>
              
              <p className="legal-body-lg mb-10 max-w-xl">
                Resolve disputes, collect payments, and protect your rights with attorney-drafted letters. Professional results in under 48 hours, starting at <span className="text-legal-navy font-bold">$50</span>.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link href="/auth/signup">
                  <Button className="btn-premium h-14 px-8 text-lg shadow-xl shadow-legal-navy/10">
                    Get Started Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button variant="outline" className="h-14 px-8 text-lg border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all">
                    How It Works
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-legal-gold" />
                  <span>Licensed Attorneys</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-legal-gold" />
                  <span>48h Turnaround</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-legal-gold" />
                  <span>PDF Delivery</span>
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block animate-fade-in-up animation-delay-200">
              <div className="relative z-10 bg-white p-8 rounded-2xl shadow-2xl border border-slate-100">
                <div className="absolute -top-6 -right-6 bg-legal-gold text-white p-4 rounded-xl shadow-lg animate-bounce duration-[3000ms]">
                  <Award className="h-8 w-8" />
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                    <div className="h-12 w-12 rounded-full bg-sky-50 flex items-center justify-center">
                      <Gavel className="h-6 w-6 text-legal-navy" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Demand for Payment</h3>
                      <p className="text-sm text-slate-500">Drafted by Senior Counsel</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-legal-gold w-3/4" />
                    </div>
                    <div className="h-2 w-5/6 bg-slate-100 rounded-full" />
                    <div className="h-2 w-4/6 bg-slate-100 rounded-full" />
                  </div>

                  <div className="pt-4 flex justify-between items-center">
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                          <Image src={`https://i.pravatar.cc/150?u=${i}`} alt="User" width={32} height={32} />
                        </div>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">10k+ Letters Sent</span>
                  </div>
                </div>
              </div>
              
              {/* Decorative Elements */}
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-sky-100 rounded-full blur-3xl opacity-50 -z-10" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border border-slate-100 rounded-full -z-20" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-legal-navy text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            {[
              { label: "Letters Delivered", value: "10,000+" },
              { label: "Success Rate", value: "95%" },
              { label: "Licensed Attorneys", value: "50+" },
              { label: "Avg. Turnaround", value: "24-48h" },
            ].map((stat, i) => (
              <div key={i} className="reveal-on-scroll" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="text-4xl md:text-5xl font-serif font-bold text-legal-gold mb-2">{stat.value}</div>
                <div className="text-sky-200/70 font-medium uppercase tracking-widest text-xs">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Letter Types Section */}
      <section id="letter-types" className="section-padding bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <Badge className="bg-sky-50 text-legal-navy border-sky-100 mb-4 px-4 py-1">
              Our Expertise
            </Badge>
            <h2 className="legal-heading-lg mb-6">
              Specialized Legal Correspondence
            </h2>
            <p className="legal-body-lg max-w-2xl mx-auto">
              Select from our most requested letter types, each meticulously reviewed by licensed attorneys to ensure maximum legal impact.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: AlertCircle,
                title: "Breach of Contract",
                desc: "Formal notice for contract violations, non-payment, or failure to deliver services.",
                color: "bg-red-50 text-red-600",
              },
              {
                icon: FileText,
                title: "Demand for Payment",
                desc: "Professional collection letters to recover funds from clients or businesses.",
                color: "bg-sky-50 text-sky-600",
              },
              {
                icon: Shield,
                title: "Cease and Desist",
                desc: "Immediate notice to stop harassment, defamation, or copyright infringement.",
                color: "bg-amber-50 text-amber-600",
              },
              {
                icon: Scale,
                title: "Pre-Litigation Settlement",
                desc: "Strategic settlement demands to resolve disputes before filing a lawsuit.",
                color: "bg-emerald-50 text-emerald-600",
              },
              {
                icon: Users,
                title: "Debt Collection",
                desc: "Authoritative letters for outstanding payments and debt recovery.",
                color: "bg-indigo-50 text-indigo-600",
              },
              {
                icon: Briefcase,
                title: "Custom Legal Notice",
                desc: "Bespoke legal correspondence tailored to your unique professional needs.",
                color: "bg-slate-50 text-slate-600",
              },
            ].map((type, index) => (
              <div
                key={type.title}
                className="reveal-on-scroll"
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                <Card className="legal-card h-full group">
                  <CardHeader>
                    <div className={`w-14 h-14 rounded-xl ${type.color} flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                      <type.icon className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-2xl mb-3">{type.title}</CardTitle>
                    <CardDescription className="text-slate-500 text-base leading-relaxed">
                      {type.desc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href="/auth/signup" className="inline-flex items-center text-sm font-bold text-legal-navy hover:text-legal-gold transition-colors group/link">
                      Start Draft
                      <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                    </Link>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section-padding bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="space-y-12">
                {[
                  {
                    step: "01",
                    title: "Submit Your Details",
                    desc: "Provide the facts of your situation through our secure, intuitive form. Our AI assistant helps you capture all necessary legal details.",
                  },
                  {
                    step: "02",
                    title: "Attorney Review",
                    desc: "A licensed attorney reviews your draft, ensuring legal accuracy, proper jurisdiction, and maximum professional impact.",
                  },
                  {
                    step: "03",
                    title: "Instant Delivery",
                    desc: "Receive your finalized, attorney-approved letter as a professional PDF, ready to be sent via email or certified mail.",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-8 reveal-on-scroll" style={{ transitionDelay: `${i * 150}ms` }}>
                    <div className="text-4xl font-serif font-black text-legal-gold/20 leading-none">{item.step}</div>
                    <div>
                      <h3 className="text-2xl font-bold mb-3 text-legal-navy">{item.title}</h3>
                      <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="order-1 lg:order-2">
              <Badge className="bg-legal-gold/10 text-legal-gold border-legal-gold/20 mb-6">The Process</Badge>
              <h2 className="legal-heading-lg mb-8">Seamless Legal Solutions.</h2>
              <p className="legal-body-lg mb-10">
                We've combined advanced AI with human legal expertise to provide a service that is faster than a traditional firm and more reliable than a generic template.
              </p>
              <div className="p-8 bg-white rounded-2xl shadow-xl border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-bl-full -z-10" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="font-bold text-slate-800">Secure & Confidential</span>
                </div>
                <p className="text-slate-500 text-sm italic">
                  "Your data is protected by bank-grade encryption and strict attorney-client confidentiality protocols."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PricingSection />
      <TestimonialsSection />
      <FAQSection />

      {/* CTA Section */}
      <section className="section-padding bg-legal-navy text-white text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="legal-heading-lg text-white mb-8">Ready to Resolve Your Dispute?</h2>
          <p className="text-xl text-sky-100/80 mb-12 max-w-2xl mx-auto">
            Join thousands of individuals and businesses who have successfully resolved their legal issues with our professional letters.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/auth/signup">
              <Button className="btn-premium h-16 px-12 text-xl bg-legal-gold hover:bg-legal-gold/90 text-white border-none shadow-2xl shadow-legal-gold/20">
                Get Started Now
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="h-16 px-12 text-xl border-white/20 text-white hover:bg-white/10 transition-all">
                Contact Support
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-20 px-6 lg:px-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
            <div className="col-span-1 lg:col-span-1">
              <Link href="/" className="flex items-center gap-3 mb-8">
                <Image
                  src="/logo.png"
                  alt="Talk-to-my-Lawyer"
                  width={40}
                  height={40}
                  className="rounded-full logo-badge"
                />
                <span className="text-xl font-serif font-bold text-white tracking-tight">Talk-to-my-Lawyer</span>
              </Link>
              <p className="text-sm leading-relaxed mb-8">
                Professional legal letter generation powered by AI and perfected by licensed attorneys. Affordable, fast, and authoritative.
              </p>
              <div className="flex gap-4">
                {/* Social icons could go here */}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-xs">Services</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/auth/signup" className="hover:text-legal-gold transition-colors">Breach of Contract</Link></li>
                <li><Link href="/auth/signup" className="hover:text-legal-gold transition-colors">Demand for Payment</Link></li>
                <li><Link href="/auth/signup" className="hover:text-legal-gold transition-colors">Cease and Desist</Link></li>
                <li><Link href="/auth/signup" className="hover:text-legal-gold transition-colors">Settlement Demands</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-xs">Company</h4>
              <ul className="space-y-4 text-sm">
                <li><Link href="/about" className="hover:text-legal-gold transition-colors">About Us</Link></li>
                <li><Link href="/faq" className="hover:text-legal-gold transition-colors">FAQs</Link></li>
                <li><Link href="/contact" className="hover:text-legal-gold transition-colors">Contact</Link></li>
                <li><Link href="/dashboard/commissions" className="hover:text-legal-gold transition-colors">Affiliate Program</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-xs">Contact</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-legal-gold" />
                  <span>support@talk-to-my-lawyer.com</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-legal-gold" />
                  <span>1-800-LEGAL-AI</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-xs uppercase tracking-widest font-medium">
            <p>© {new Date().getFullYear()} Talk-to-my-Lawyer. All rights reserved.</p>
            <div className="flex gap-8">
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/disclaimer" className="hover:text-white transition-colors">Legal Disclaimer</Link>
            </div>
          </div>
          
          <div className="mt-12 p-6 bg-white/5 rounded-xl border border-white/5 text-[10px] leading-relaxed text-center max-w-4xl mx-auto">
            <span className="text-legal-gold font-bold uppercase mr-2">Disclaimer:</span>
            Talk-to-my-Lawyer is a technology platform that facilitates legal document preparation. We are not a law firm and do not provide legal advice. Use of this site does not create an attorney-client relationship. All letters are reviewed by independent licensed attorneys.
          </div>
        </div>
      </footer>
    </div>
  );
}
