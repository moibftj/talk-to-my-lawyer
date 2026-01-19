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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  User,
  Users,
  Shield,
  PenTool,
  Gift,
  LogOut,
  FileText,
  Scale,
  CheckCircle,
  Download,
  Send,
  Home,
  AlertCircle,
  Sparkles,
  Briefcase,
  ArrowRight,
  Play,
  ChevronRight,
  Building,
  Star,
  Phone,
  Mail,
  Zap,
  Clock,
} from "lucide-react";
import jsPDF from "jspdf";
import Link from "next/link";
import PricingSection from "@/components/ui/pricing-section";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useSpring,
} from "motion/react";
import { useRef } from "react";
import {
  DEFAULT_LOGO_ALT,
  DEFAULT_LOGO_SRC,
  LETTER_TYPES,
  SUBSCRIPTION_PLANS,
} from "@/lib/constants";
import type { Profile } from "@/lib/database.types";

// Use subset of Profile fields for UI
type UIProfile = Pick<Profile, "id" | "full_name" | "role" | "email">;

const InclusiveOrbit = () => (
  <div
    className="absolute inset-0 flex items-center justify-center pointer-events-none"
    aria-hidden
  >
    <motion.div
      className="aurora-orbit"
      initial={{ rotate: -18, opacity: 0.35 }}
      animate={{ rotate: 342, opacity: [0.35, 0.55, 0.35] }}
      transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
    />
    <motion.div
      className="aurora-orbit aurora-orbit--inner"
      initial={{ rotate: 12, opacity: 0.4 }}
      animate={{ rotate: -348, opacity: [0.4, 0.6, 0.4] }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: "linear",
        delay: 1.2,
      }}
    />
  </div>
);

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UIProfile | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
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
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll(".scroll-reveal");
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [user]);

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
    toast.success("Logged out successfully");
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
      router.push("/dashboard/admin/letters");
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
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-sky-50/40 to-blue-50/30 text-gray-900 grid-pattern">
        {/* Navigation Header */}
        <nav
          className={`glass-card backdrop-blur-lg border-b border-sky-200/60 sticky top-0 z-50 transition-all duration-300 ${
            isScrolled
              ? "bg-white/95 shadow-lg shadow-sky-100/50"
              : "bg-white/80"
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center h-32 py-4 gap-8">
              {/* Left Navigation */}
              <div className="hidden md:flex items-center space-x-4">
                <Button
                  variant="ghost"
                  onClick={() => scrollToSection("features")}
                  className="nav-item text-gray-700 hover:text-[#199df4] transition-colors duration-200"
                >
                  Features
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => scrollToSection("pricing")}
                  className="nav-item text-gray-700 hover:text-[#199df4] transition-colors duration-200"
                >
                  Pricing
                </Button>
                <Link href="/how-it-works">
                  <Button
                    variant="ghost"
                    className="nav-item text-gray-700 hover:text-[#199df4] transition-colors duration-200"
                  >
                    How It Works
                  </Button>
                </Link>
              </div>
              
              {/* Center Logo */}
              <Link href="/" className="flex items-center justify-center flex-shrink-0">
                <Image
                  src={DEFAULT_LOGO_SRC}
                  alt={DEFAULT_LOGO_ALT}
                  width={160}
                  height={160}
                  className="h-40 w-40 rounded-full logo-badge"
                  priority
                />
              </Link>
              
              {/* Right Navigation */}
              <div className="hidden md:flex items-center space-x-4">
                <Link href="/membership">
                  <Button
                    variant="ghost"
                    className="nav-item text-gray-700 hover:text-[#199df4] transition-colors duration-200"
                  >
                    Membership
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    variant="ghost"
                    className="nav-item text-gray-700 hover:text-[#199df4] transition-colors duration-200"
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
                    <motion.span
                      className="flex items-center"
                      whileHover={{ x: 3 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      Get Started
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </motion.span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section with Professional Animations */}
        <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          {/* Enhanced Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Large morphing gradient orb */}
            <motion.div
              className="absolute w-200 h-200 rounded-full opacity-25 blur-3xl morphing-bg"
              style={{
                background:
                  "radial-gradient(circle, #199df4 0%, #0d8ae0 40%, #0066cc 100%)",
                top: "-20%",
                left: "-10%",
              }}
              animate={{
                x: [0, 150, -100, 0],
                y: [0, -100, 150, 0],
              }}
              transition={{
                duration: 40,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Secondary orb with different timing */}
            <motion.div
              className="absolute w-150 h-150 rounded-full opacity-20 blur-3xl morphing-bg"
              style={{
                background:
                  "radial-gradient(circle, #199df4 0%, #4facfe 50%, #00f2fe 100%)",
                top: "40%",
                right: "-10%",
              }}
              animate={{
                x: [0, -200, 100, 0],
                y: [0, 150, -100, 0],
              }}
              transition={{
                duration: 35,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 5,
              }}
            />

            {/* Subtle decorative elements */}
            <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-xl" />
            <div className="absolute top-40 right-20 w-40 h-40 bg-blue-500/5 rounded-full blur-xl" />
            <div className="absolute bottom-20 left-1/4 w-36 h-36 bg-blue-400/5 rounded-full blur-xl" />
          </div>

          <InclusiveOrbit />

          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-30">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width="60" height="60" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3Cpattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"%3E%3Cpath d="M 60 0 L 0 0 0 60" fill="none" stroke="%23e2e8f0" stroke-width="0.5"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width="100%25" height="100%25" fill="url(%23grid)" /%3E%3C/svg%3E")`,
              }}
            />
          </div>

          <div className="max-w-7xl mx-auto text-center relative z-10">
            {/* Main hero heading with staggered animation */}
            <motion.div
              className="text-center mb-16"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.2,
                    delayChildren: 0.3,
                  },
                },
              }}
            >
              <motion.h1
                className="text-5xl md:text-7xl font-bold mb-4"
                style={{
                  background:
                    "linear-gradient(135deg, #0a2540 0%, #199df4 35%, #00d4ff 65%, #0a2540 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
                variants={{
                  hidden: { opacity: 0, y: 30, filter: "blur(10px)" },
                  visible: {
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    transition: {
                      duration: 0.8,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    },
                  },
                }}
              >
                Get Professional Lawyer-Drafted Letters For:
              </motion.h1>

              {/* Highlighted Service Types - Clickable Buttons */}
              <motion.div
                className="flex flex-wrap justify-center gap-3 mb-8"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.3,
                    },
                  },
                }}
              >
                {[
                  "Breach of Contract",
                  "Demand for Payment",
                  "Cease and Desist",
                  "Pre-Litigation Settlement",
                  "Debt Collection",
                  "And more",
                ].map((service, index) => (
                  <Link href="/auth/signup" key={service}>
                    <motion.span
                      className="inline-flex items-center px-4 py-2 rounded-full bg-linear-to-r from-sky-100 to-blue-100 border border-[#199df4]/30 text-[#0d8ae0] font-medium text-sm cursor-pointer hover:shadow-md hover:scale-105 transition-all"
                      variants={{
                        hidden: { opacity: 0, scale: 0.8 },
                        visible: {
                          opacity: 1,
                          scale: 1,
                          transition: {
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                          },
                        },
                      }}
                      whileHover={{ scale: 1.05 }}
                    >
                      {service}
                    </motion.span>
                  </Link>
                ))}
              </motion.div>

              <motion.p
                className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: 0.6,
                      delay: 0.5,
                    },
                  },
                }}
              >
                Resolve conflicts quickly and affordably — only{" "}
                <span className="text-[#199df4] font-bold">$50 per letter</span>
                .
              </motion.p>
            </motion.div>

            {/* CTA Buttons with enhanced animations */}
            <motion.div
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.2,
                    delayChildren: 0.6,
                  },
                },
              }}
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0, scale: 0.8, y: 30 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: {
                      type: "spring",
                      stiffness: 120,
                      damping: 14,
                    },
                  },
                }}
              >
                <Link href="/auth/signup">
                  <Button
                    variant="running_border"
                    className="px-12 py-5 text-lg font-semibold rounded-xl glow-enhanced gpu-accelerated cta-aurora"
                  >
                    <motion.div
                      className="flex items-center"
                      whileHover={{ x: 5 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      <Play className="h-5 w-5 mr-3" />
                      Get Started Now
                      <Sparkles className="h-5 w-5 ml-3 text-shimmer" />
                    </motion.div>
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                variants={{
                  hidden: { opacity: 0, scale: 0.8, y: 30 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: {
                      type: "spring",
                      stiffness: 120,
                      damping: 14,
                      delay: 0.1,
                    },
                  },
                }}
              >
                <Link href="/faq">
                  <Button
                    variant="outline"
                    className="px-12 py-5 text-lg font-semibold rounded-xl border-2 border-[#199df4]/30 text-[#199df4] bg-white/80 backdrop-blur-sm hover:bg-sky-50 hover:border-[#199df4]/50 hover:shadow-xl transition-all duration-300 group ripple magnetic-btn cta-aurora"
                  >
                    <motion.div
                      className="flex items-center"
                      whileHover={{ x: 5 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      <motion.div
                        whileHover={{ rotate: 15 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <FileText className="h-5 w-5 mr-3" />
                      </motion.div>
                      View FAQs
                      <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </motion.div>
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            {/* Feature highlights with staggered animation */}
            <motion.div
              className="flex flex-wrap justify-center gap-8 text-sm text-gray-600"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1,
                    delayChildren: 0.9,
                  },
                },
              }}
            >
              {[
                {
                  icon: CheckCircle,
                  text: "PDF Download",
                  color: "text-green-500",
                },
                {
                  icon: CheckCircle,
                  text: "Up to 48 hours turnaround",
                  color: "text-green-500",
                },
                {
                  icon: CheckCircle,
                  text: "Attorney approved",
                  color: "text-green-500",
                },
              ].map((item, index) => (
                <motion.div
                  key={item.text}
                  className="flex items-center gap-2"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        type: "spring",
                        stiffness: 100,
                        damping: 12,
                      },
                    },
                  }}
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.2,
                      ease: "easeInOut",
                    }}
                  >
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </motion.div>
                  {item.text}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-linear-to-r from-[#0a2540] via-[#0d3a5c] to-[#0a2540] text-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="scroll-reveal stagger-1 counter-animate">
                <div className="text-4xl font-bold mb-2 text-gradient-animated animate-pulse-scale">
                  10,000+
                </div>
                <div className="text-blue-200 transition-colors duration-200 hover:text-white">
                  Letters Delivered
                </div>
              </div>
              <div className="scroll-reveal stagger-2 counter-animate">
                <div className="text-4xl font-bold mb-2 text-gradient-animated animate-pulse-scale">
                  95%
                </div>
                <div className="text-blue-200 transition-colors duration-200 hover:text-white">
                  Success Rate
                </div>
              </div>
              <div className="scroll-reveal stagger-3 counter-animate">
                <div className="text-4xl font-bold mb-2 text-gradient-animated animate-pulse-scale">
                  50+
                </div>
                <div className="text-blue-200 transition-colors duration-200 hover:text-white">
                  Licensed Attorneys
                </div>
              </div>
              <div className="scroll-reveal stagger-4 counter-animate">
                <div className="text-4xl font-bold mb-2 text-gradient-animated animate-pulse-scale">
                  Up to 48 Hours
                </div>
                <div className="text-blue-200 transition-colors duration-200 hover:text-white">
                  Turnaround Time
                </div>
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
              <h2 className="text-4xl font-bold mb-4 shiny-text">
                Professional Legal Letters
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Custom made letters for your specific situation, sent by
                lawyer's email.
              </p>
            </div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1,
                    delayChildren: 0.2,
                  },
                },
              }}
            >
              {[
                {
                  icon: AlertCircle,
                  title: "Breach of Contract",
                  desc: "Contract violations, non-payment, failure to deliver goods or services",
                  color: "red",
                  gradient: "from-[#ff6b6b] to-[#ee5a52]",
                },
                {
                  icon: FileText,
                  title: "Demand for Payment",
                  desc: "Collect money owed to you from clients, customers, or businesses",
                  color: "blue",
                  gradient: "from-[#199df4] to-[#0d8ae0]",
                },
                {
                  icon: Shield,
                  title: "Cease and Desist",
                  desc: "Stop harassment, defamation, copyright infringement, and more",
                  color: "orange",
                  gradient: "from-[#ffa726] to-[#ff9800]",
                },
                {
                  icon: Scale,
                  title: "Pre-Litigation Settlement",
                  desc: "Settlement demands before filing a lawsuit, negotiate disputes",
                  color: "green",
                  gradient: "from-[#00c9a7] to-[#00a383]",
                },
                {
                  icon: Users,
                  title: "Debt Collection",
                  desc: "Professional debt collection letters for outstanding payments",
                  color: "blue",
                  gradient: "from-[#4facfe] to-[#199df4]",
                },
                {
                  icon: Briefcase,
                  title: "And More",
                  desc: "Contact us for any other legal letter needs you may have",
                  color: "blue",
                  gradient: "from-[#0d8ae0] to-[#0066cc]",
                },
              ].map((type, index) => (
                <motion.div
                  key={type.title}
                  variants={{
                    hidden: { opacity: 0, y: 50, scale: 0.9 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        type: "spring",
                        stiffness: 100,
                        damping: 12,
                      },
                    },
                  }}
                  whileHover={{
                    y: -10,
                    scale: 1.02,
                    transition: { duration: 0.3 },
                  }}
                >
                  <Card
                    className={`h-full glass-card card-enhanced hover:shadow-2xl transition-all duration-300 group relative overflow-hidden letter-card-enhanced gpu-accelerated`}
                  >
                    {/* Animated background gradient */}
                    <motion.div
                      className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500"
                      style={{
                        background: `linear-gradient(135deg, ${type.gradient.replace("from-", "").replace(" to-", ", ")})`,
                      }}
                      animate={{
                        scale: [1, 1.1, 1],
                      }}
                      transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />

                    {/* Shimmer effect on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden rounded-lg">
                      <motion.div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                          backgroundSize: "200% 100%",
                        }}
                        animate={{
                          backgroundPosition: ["-200% center", "200% center"],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                    </div>

                    <CardHeader className="relative z-10">
                      <motion.div
                        className={`w-14 h-14 rounded-xl bg-linear-to-br ${type.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl transition-all duration-300`}
                        whileHover={{
                          rotate: [0, -5, 5, 0],
                          scale: 1.1,
                        }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          repeatType: "reverse",
                        }}
                      >
                        <type.icon className="h-7 w-7 text-white" />
                      </motion.div>
                      <CardTitle className="text-xl font-semibold mb-2 text-gray-900 group-hover:text-[#199df4] transition-colors duration-300">
                        {type.title}
                      </CardTitle>
                      <CardDescription className="text-gray-600 leading-relaxed">
                        {type.desc}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <Link href="/auth/signup">
                        <Button
                          variant="running_border"
                          size="lg"
                          className="w-full ripple cta-aurora"
                        >
                          <motion.span
                            className="flex items-center justify-center"
                            whileHover={{ x: 5 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            Select This Type
                            <ChevronRight className="h-5 w-5 ml-2" />
                          </motion.span>
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
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
                <Card
                  key={feature.title}
                  className="glass-card card-enhanced laser-border-blue hover:shadow-xl scroll-reveal"
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-sky-100 flex items-center justify-center mb-4 card-icon">
                      <feature.icon className="h-6 w-6 text-[#199df4]" />
                    </div>
                    <CardTitle className="text-xl font-semibold mb-2 text-gradient-animated">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      {feature.desc}
                    </CardDescription>
                  </CardHeader>
                </Card>
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
                <h3 className="font-semibold mb-4 glow-text">Services</h3>
                <ul className="space-y-2 text-blue-200">
                  <li>Cease and Desist</li>
                  <li>Breach of Contract</li>
                  <li>Demand for Payment</li>
                  <li>Debt Collection</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4 glow-text">Company</h3>
                <ul className="space-y-2 text-blue-200">
                  <li>About Us</li>
                  <li>Legal Blog</li>
                  <li>Careers</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4 glow-text">Contact</h3>
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
