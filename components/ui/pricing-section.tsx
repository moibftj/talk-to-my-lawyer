"use client";

import { Check, ArrowRight, Shield, Zap, Star, Award, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useState } from "react";

const plans = [
  {
    name: "Single Letter",
    price: "$200",
    description: "Perfect for one-time legal needs",
    features: [
      "One Professional Legal Letter",
      "Attorney Review & Approval",
      "48-Hour Turnaround",
      "PDF Digital Delivery",
      "Lawyer's Letterhead",
      "Sent via Lawyer's Email",
    ],
    cta: "Get Started",
    popular: false,
    icon: Zap,
  },
  {
    name: "Membership",
    price: "$50",
    period: "/letter",
    description: "$200/mo membership fee applies",
    features: [
      "Unlimited Letter Generation",
      "Priority Attorney Review",
      "24-Hour Turnaround",
      "Direct Attorney Consultation",
      "Certified Mail Delivery",
      "Legal Strategy Session",
    ],
    cta: "Start Membership",
    popular: true,
    icon: Award,
  },
  {
    name: "Annual Plan",
    price: "$2,000",
    period: "/year",
    description: "Includes 48 letters (~$41/letter)",
    features: [
      "48 Letters Included",
      "Dedicated Legal Team",
      "API Integration",
      "Custom Letter Templates",
      "White-label Options",
      "24/7 Priority Support",
    ],
    cta: "Get Annual Plan",
    popular: false,
    icon: Shield,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="section-padding bg-slate-50 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-b from-white to-transparent" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <Badge className="bg-legal-gold/10 text-legal-gold border-legal-gold/20 mb-4 px-4 py-1">
            Transparent Pricing
          </Badge>
          <h2 className="legal-heading-lg mb-6">Invest in Your Legal Rights</h2>
          <p className="legal-body-lg max-w-2xl mx-auto">
            Choose the plan that fits your needs. From single letters to ongoing professional protection, we have you covered.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className="reveal-on-scroll"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <Card
                className={`h-full flex flex-col transition-all duration-500 border-slate-200 ${
                  plan.popular
                    ? "ring-2 ring-legal-gold shadow-2xl scale-105 z-10 bg-white"
                    : "hover:shadow-xl bg-white/80 backdrop-blur-sm"
                }`}
              >
                {plan.popular && (
                  <div className="bg-legal-gold text-white text-center py-1.5 text-xs font-bold uppercase tracking-widest">
                    Most Recommended
                  </div>
                )}
                <CardHeader className="text-center pt-10">
                  <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${plan.popular ? 'bg-legal-gold text-white' : 'bg-slate-100 text-legal-navy'}`}>
                    <plan.icon className="h-8 w-8" />
                  </div>
                  <CardTitle className="text-2xl font-serif mb-2">{plan.name}</CardTitle>
                  <CardDescription className="text-slate-500 mb-6">
                    {plan.description}
                  </CardDescription>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-serif font-black text-legal-navy">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-slate-400 font-medium">{plan.period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-grow px-8">
                  <div className="space-y-4">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <div className={`mt-1 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${plan.popular ? 'bg-legal-gold/10 text-legal-gold' : 'bg-slate-100 text-slate-400'}`}>
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                        <span className="text-sm font-medium text-slate-600">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-8 pt-0">
                  <Link href="/auth/signup" className="w-full">
                    <Button
                      className={`w-full h-14 text-lg font-bold transition-all duration-300 ${
                        plan.popular
                          ? "btn-premium shadow-lg shadow-legal-gold/20"
                          : "variant-outline border-slate-200 hover:border-legal-navy hover:bg-slate-50"
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </div>
          ))}
        </div>

        <div className="mt-20 p-8 bg-legal-navy rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-8 reveal-on-scroll">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Shield className="h-8 w-8 text-legal-gold" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">100% Satisfaction Guarantee</h3>
              <p className="text-sky-100/60 text-sm">If your letter isn't approved by an attorney, we'll refund you instantly.</p>
            </div>
          </div>
          <Link href="/terms">
            <Button variant="link" className="text-legal-gold hover:text-white p-0 h-auto font-bold">
              Read our Guarantee Policy <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
