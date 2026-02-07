"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Users,
  Shield,
  LogOut,
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
} from "lucide-react";
import Link from "next/link";
import PricingSection from "@/components/ui/pricing-section";
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from "@/lib/constants";
import type { Profile } from "@/lib/database.types";

// Use subset of Profile fields for UI
type UIProfile = Pick<Profile, "id" | "full_name" | "role" | "email">;

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UIProfile | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          entry.target.classList.add("revealed");
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll(".scroll-reveal, .reveal-on-scroll");
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUser(user);
        setProfile(profile as UIProfile);
      }
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push("/");
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // Authenticated user view - redirect to dashboard (must be before conditional rendering)
  useEffect(() => {
    if (profile?.role === "subscriber") {
      router.push("/dashboard/letters");
    } else if (profile?.role === "admin") {
      // Admins should use the dedicated admin portal
      router.push("/secure-admin-gateway/dashboard");
    } else if (profile?.role === "employee") {
      router.push("/dashboard/commissions");
    }
  }, [profile?.role, router]);

  // Show loading state while redirecting
  if (profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-40 w-40 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-sky-50/40 to-blue-50/30 text-gray-900">
        {/* Navigation Header */}
        <nav
          className={`backdrop-blur-lg border-b border-sky-200/60 sticky top-0 z-50 transition-all duration-300 ${
            isScrolled
              ? "bg-white/95 shadow-lg shadow-sky-100/50"
              : "bg-white/80"
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center h-16 py-1 gap-8">
              {/* Left Navigation */}
              <div className="hidden md:flex items-center space-x-4">
                <Button
                  variant="ghost"
                  onClick={() => scrollToSection("features")}
                  className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
                >
                  Features
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => scrollToSection("pricing")}
                  className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
                >
                  Pricing
                </Button>
                <Link href="/how-it-works">
                  <Button
                    variant="ghost"
                    className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
                  >
                    How It Works
                  </Button>
                </Link>
              </div>

              {/* Center Logo */}
              <Link
                href="/"
                className="flex items-center justify-center shrink-0"
              >
                <Image
                  src={DEFAULT_LOGO_SRC}
                  alt={DEFAULT_LOGO_ALT}
                  width={56}
                  height={56}
                  className="rounded-full"
                  style={{ width: '56px', height: '56px' }}
                  priority
                />
              </Link>

              {/* Right Navigation */}
              <div className="hidden md:flex items-center space-x-4">
                <Link href="/membership">
                  <Button
                    variant="ghost"
                    className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
                  >
                    Membership
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    variant="ghost"
                    className="nav-underline text-gray-700 hover:text-[#199df4] transition-colors duration-200"
                  >
                    Contact
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button
                    variant="ghost"
                    className="text-gray-700 hover:text-[#199df4]"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button
                    variant="running_border"
                    size="sm"
                    className="glow-enhanced cta-aurora"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section - CSS animations instead of motion */}
        <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          {/* Simple static background with subtle CSS animation */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute w-200 h-200 rounded-full opacity-20 blur-3xl bg-gradient-animated"
              style={{
                background:
                  "radial-gradient(circle, #199df4 0%, #0d8ae0 40%, #0066cc 100%)",
                top: "-20%",
                left: "-10%",
                animation: "float 40s ease-in-out infinite",
              }}
            />
            <div
              className="absolute w-150 h-150 rounded-full opacity-15 blur-3xl bg-gradient-animated"
              style={{
                background:
                  "radial-gradient(circle, #199df4 0%, #4facfe 50%, #00f2fe 100%)",
                top: "40%",
                right: "-10%",
                animation: "float 35s ease-in-out infinite reverse",
              }}
            />
          </div>

          <div className="max-w-7xl mx-auto text-center relative z-10">
            {/* Main hero heading */}
            <div className="text-center mb-16 animate-fade-in">
              <h1
                className="text-5xl md:text-7xl font-bold mb-4 animate-slide-up"
                style={{
                  background:
                    "linear-gradient(135deg, #0a2540 0%, #199df4 35%, #00d4ff 65%, #0a2540 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Get Professional Lawyer-Drafted Letters For:
              </h1>

              {/* Service Types */}
              <div
                className="flex flex-wrap justify-center gap-3 mb-8 animate-slide-up"
                style={{ animationDelay: "0.2s" }}
              >
                {[
                  "Breach of Contract",
                  "Demand for Payment",
                  "Cease and Desist",
                  "Pre-Litigation Settlement",
                  "Debt Collection",
                  "And more",
                ].map((service) => (
                  <Link href="/auth/signup" key={service}>
                    <span className="inline-flex items-center px-4 py-2 rounded-full bg-linear-to-r from-sky-100 to-blue-100 border border-[#199df4]/30 text-[#0d8ae0] font-medium text-sm cursor-pointer tag-hover">
                      {service}
                    </span>
                  </Link>
                ))}
              </div>

              <p
                className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium animate-slide-up"
                style={{ animationDelay: "0.4s" }}
              >
                Resolve conflicts quickly and affordably — only{" "}
                <span className="text-[#199df4] font-bold">$50 per letter</span>
                .
              </p>
            </div>

            {/* CTA Buttons */}
            <div
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16 animate-slide-up"
              style={{ animationDelay: "0.6s" }}
            >
              <Link href="/auth/signup">
                <Button
                  variant="running_border"
                  className="px-12 py-5 text-lg font-semibold rounded-xl glow-enhanced cta-aurora primary-pulse"
                >
                  <Play className="h-5 w-5 mr-3" />
                  Get Started Now
                </Button>
              </Link>

              <Link href="/faq">
                <Button
                  variant="outline"
                  className="px-12 py-5 text-lg font-semibold rounded-xl border-2 border-[#199df4]/30 text-[#199df4] bg-white/80 backdrop-blur-sm hover:bg-sky-50 hover:border-[#199df4]/50 hover:shadow-xl transition-all duration-300 group"
                >
                  <FileText className="h-5 w-5 mr-3" />
                  View FAQs
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-600">
              {[
                { icon: CheckCircle, text: "PDF Download" },
                { icon: CheckCircle, text: "Up to 48 hours turnaround" },
                { icon: CheckCircle, text: "Attorney approved" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2">
                  <item.icon className="h-5 w-5 text-green-500" />
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-linear-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="reveal-on-scroll stat-highlight" style={{ transitionDelay: '0ms' }}>
                <div className="text-4xl font-bold mb-2">10,000+</div>
                <div className="text-blue-200">Letters Delivered</div>
              </div>
              <div className="reveal-on-scroll stat-highlight" style={{ transitionDelay: '100ms' }}>
                <div className="text-4xl font-bold mb-2">95%</div>
                <div className="text-blue-200">Success Rate</div>
              </div>
              <div className="reveal-on-scroll stat-highlight" style={{ transitionDelay: '200ms' }}>
                <div className="text-4xl font-bold mb-2">50+</div>
                <div className="text-blue-200">Licensed Attorneys</div>
              </div>
              <div className="reveal-on-scroll stat-highlight" style={{ transitionDelay: '300ms' }}>
                <div className="text-4xl font-bold mb-2">Up to 48 Hours</div>
                <div className="text-blue-200">Turnaround Time</div>
              </div>
            </div>
          </div>
        </section>

        {/* Letter Types Section */}
        <section id="letter-types" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="bg-sky-100 text-[#199df4] mb-4">
                Most Popular
              </Badge>
              <h2 className="text-4xl font-bold mb-4">
                Professional Legal Letters
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Custom made letters for your specific situation, sent by
                lawyer's email.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: AlertCircle,
                  title: "Breach of Contract",
                  desc: "Contract violations, non-payment, failure to deliver goods or services",
                  gradient: "from-[#ff6b6b] to-[#ee5a52]",
                },
                {
                  icon: FileText,
                  title: "Demand for Payment",
                  desc: "Collect money owed to you from clients, customers, or businesses",
                  gradient: "from-[#199df4] to-[#0d8ae0]",
                },
                {
                  icon: Shield,
                  title: "Cease and Desist",
                  desc: "Stop harassment, defamation, copyright infringement, and more",
                  gradient: "from-[#ffa726] to-[#ff9800]",
                },
                {
                  icon: Scale,
                  title: "Pre-Litigation Settlement",
                  desc: "Settlement demands before filing a lawsuit, negotiate disputes",
                  gradient: "from-[#00c9a7] to-[#00a383]",
                },
                {
                  icon: Users,
                  title: "Debt Collection",
                  desc: "Professional debt collection letters for outstanding payments",
                  gradient: "from-[#4facfe] to-[#199df4]",
                },
                {
                  icon: Briefcase,
                  title: "And More",
                  desc: "Contact us for any other legal letter needs you may have",
                  gradient: "from-[#0d8ae0] to-[#0066cc]",
                },
              ].map((type, index) => (
                <div
                  key={type.title}
                  className="reveal-on-scroll"
                  style={{ transitionDelay: `${index * 80}ms` }}
                >
                  <Card className="h-full glass-card card-hover-lift group">
                    <CardHeader>
                      <div
                        className={`w-14 h-14 rounded-xl bg-linear-to-br ${type.gradient} flex items-center justify-center mb-4 shadow-lg icon-float-on-hover`}
                      >
                        <type.icon className="h-7 w-7 text-white" />
                      </div>
                      <CardTitle className="text-xl font-semibold mb-2 text-gray-900 group-hover:text-[#199df4] transition-colors duration-300">
                        {type.title}
                      </CardTitle>
                      <CardDescription className="text-gray-600 leading-relaxed">
                        {type.desc}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href="/auth/signup">
                        <Button
                          variant="running_border"
                          size="lg"
                          className="w-full cta-aurora"
                        >
                          Select This Type
                          <ChevronRight className="h-5 w-5 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <PricingSection />

        {/* Features Section */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Zap,
                  title: "Lightning Fast",
                  desc: "Professional legal letters in minutes, not hours",
                },
                {
                  icon: Users,
                  title: "Attorney Approved",
                  desc: "Every letter is approved by qualified legal professionals",
                },
                {
                  icon: Shield,
                  title: "Secure & Confidential",
                  desc: "Bank-level encryption protects your information",
                },
              ].map((feature, index) => (
                <div
                  key={feature.title}
                  className="reveal-on-scroll"
                  style={{ transitionDelay: `${index * 120}ms` }}
                >
                  <Card className="glass-card card-hover-lift group h-full">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-sky-100 flex items-center justify-center mb-4 icon-float-on-hover">
                        <feature.icon className="h-6 w-6 text-[#199df4]" />
                      </div>
                      <CardTitle className="text-xl font-semibold mb-2 group-hover:text-[#199df4] transition-colors duration-300">
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="text-gray-600">
                        {feature.desc}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-linear-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <Link href="/" className="flex items-center space-x-3 mb-4">
                  <Scale className="h-10 w-10 text-[#199df4]" />
                  <span className="text-2xl font-bold text-white">
                    TalkToMyLawyer.com
                  </span>
                </Link>
                <p className="text-sky-200 mb-4">
                  Professional legal assistance without the legal bill.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Services</h3>
                <ul className="space-y-2 text-blue-200">
                  <li className="footer-link cursor-pointer">Cease and Desist</li>
                  <li className="footer-link cursor-pointer">Breach of Contract</li>
                  <li className="footer-link cursor-pointer">Demand for Payment</li>
                  <li className="footer-link cursor-pointer">Debt Collection</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Company</h3>
                <ul className="space-y-2 text-blue-200">
                  <li className="footer-link cursor-pointer">About Us</li>
                  <li className="footer-link cursor-pointer">Legal Blog</li>
                  <li className="footer-link cursor-pointer">Careers</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Contact</h3>
                <div className="space-y-2 text-blue-200">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    support@legalletters.com
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    800-110-0012
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-blue-700 mt-12 pt-8 text-center text-blue-200">
              <p>&copy; 2025 TalkToMyLawyer.com. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return null;
}
