"use client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileText, CheckCheck, Scale } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const plans = [
  {
    name: "Single Letter",
    description:
      "Perfect for one-time legal needs. Get a professional letter without commitment.",
    price: 200,
    unit: "one-time",
    buttonText: "Get Started",
    features: [
      { text: "PDF download", icon: <FileText size={20} /> },
      { text: "Lawyer's letterhead", icon: <Scale size={20} /> },
      { text: "Sent from a lawyer's email", icon: <CheckCheck size={20} /> },
    ],
    includes: [
      "Every letter includes:",
      "Professional formatting",
      "Attorney approved",
      "Up to 48 hours turnaround",
    ],
  },
  {
    name: "Membership",
    description:
      "$200/month membership, then just $50 per letter. Best value for ongoing legal needs.",
    price: 50,
    unit: "per letter",
    buttonText: "Get Started",
    popular: true,
    bestValue: true,
    features: [
      { text: "PDF download", icon: <FileText size={20} /> },
      { text: "Lawyer's letterhead", icon: <Scale size={20} /> },
      { text: "Sent from a lawyer's email", icon: <CheckCheck size={20} /> },
    ],
    includes: [
      "Every letter includes:",
      "Professional formatting",
      "Attorney approved",
      "Up to 48 hours turnaround",
    ],
  },
  {
    name: "Annual Plan",
    description:
      "$2,000 one-time payment. Includes 48 letters (≈$41.67 per letter).",
    price: 2000,
    unit: "one-time",
    buttonText: "Get Started",
    features: [
      { text: "PDF download", icon: <FileText size={20} /> },
      { text: "Lawyer's letterhead", icon: <Scale size={20} /> },
      { text: "Sent from a lawyer's email", icon: <CheckCheck size={20} /> },
    ],
    includes: [
      "Every letter includes:",
      "Professional formatting",
      "Attorney approved",
      "Up to 48 hours turnaround",
    ],
  },
];

const PricingSwitch = ({ onSwitch }: { onSwitch: (value: string) => void }) => {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value: string) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className="flex justify-center">
      <div className="relative z-50 mx-auto flex w-fit rounded-full bg-neutral-50 border border-gray-200 p-1">
        <button
          onClick={() => handleSwitch("0")}
          className={`relative z-10 w-fit sm:h-12 h-10 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-all ${
            selected === "0"
              ? "text-white"
              : "text-muted-foreground hover:text-black"
          }`}
        >
          {selected === "0" && (
            <span
              className="absolute top-0 left-0 sm:h-12 h-10 w-full rounded-full border-4 shadow-sm shadow-[#199df4] border-[#199df4] bg-linear-to-t from-[#0d8ae0] via-[#199df4] to-[#4facfe] transition-all duration-300"
            />
          )}
          <span className="relative">Single Letter</span>
        </button>

        <button
          onClick={() => handleSwitch("1")}
          className={`relative z-10 w-fit sm:h-12 h-8 shrink-0 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-all ${
            selected === "1"
              ? "text-white"
              : "text-muted-foreground hover:text-black"
          }`}
        >
          {selected === "1" && (
            <span
              className="absolute top-0 left-0 sm:h-12 h-10 w-full rounded-full border-4 shadow-sm shadow-[#199df4] border-[#199df4] bg-linear-to-t from-[#0d8ae0] via-[#199df4] to-[#4facfe] transition-all duration-300"
            />
          )}
          <span className="relative flex items-center gap-2">
            Membership
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-[#0d8ae0]">
              Best Value
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default function PricingSection() {
  const [isSubscription, setIsSubscription] = useState(false);

  const togglePricingPeriod = (value: string) =>
    setIsSubscription(Number.parseInt(value) === 1);

  return (
    <div id="pricing" className="px-4 py-20 mx-auto relative bg-linear-to-br from-slate-50 via-sky-50/40 to-blue-50/30">
      <div
        className="absolute top-0 left-[10%] right-[10%] w-[80%] h-full z-0 pointer-events-none"
        style={{
          backgroundImage: `
        radial-gradient(circle at center, #199df4 0%, transparent 70%)
      `,
          opacity: 0.3,
          mixBlendMode: "multiply",
        }}
      />

      <div className="text-center mb-6 max-w-3xl mx-auto relative z-10">
        <h2 className="md:text-6xl sm:text-4xl text-3xl font-medium text-gray-900 mb-4 animate-fade-in">
          Simple, Transparent{" "}
          <span className="border border-dashed border-[#199df4] px-2 py-1 rounded-xl bg-sky-100 capitalize inline-block">
            Pricing
          </span>
        </h2>

        <p className="sm:text-base text-sm text-gray-600 sm:w-[70%] w-[80%] mx-auto animate-slide-up" style={{ animationDelay: "0.2s" }}>
          Professional legal letters custom made for your situation. Sent by lawyer's email with up to 48 hours turnaround.
        </p>
      </div>

      <div className="relative z-10 mb-8">
        <PricingSwitch onSwitch={togglePricingPeriod} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 max-w-5xl gap-4 py-6 mx-auto relative z-10">
        {plans.map((plan, index) => (
          <div
            key={plan.name}
            className="animate-slide-up"
            style={{ animationDelay: `${0.3 + index * 0.1}s` }}
          >
            <Card
              className={`relative border-neutral-200 pricing-highlight ${
                plan.popular ? "ring-2 ring-[#199df4] bg-sky-50" : "bg-white "
              }`}
            >
              <CardHeader className="text-left">
                <div className="flex justify-between">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  {plan.popular && (
                    <div className="flex gap-1">
                      <span className="bg-[#199df4] text-white px-2 py-1 rounded-full text-xs font-medium">
                        Popular
                      </span>
                      <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        Best Value
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                <div className="flex items-baseline">
                  <span className="text-4xl font-semibold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="text-gray-600 ml-1 text-sm">
                    {plan.unit || "/letter"}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <Link href="/auth/signup">
                  <button
                    className={`w-full mb-6 p-4 text-lg rounded-xl transition-all duration-300 ${
                      plan.popular
                        ? "bg-linear-to-t from-[#0d8ae0] to-[#199df4] shadow-lg shadow-[#199df4]/40 border border-[#4facfe] text-white hover:shadow-xl hover:scale-105"
                        : "bg-linear-to-t from-neutral-900 to-neutral-600 shadow-lg shadow-neutral-900 border border-neutral-700 text-white hover:shadow-xl hover:scale-105"
                    }`}
                  >
                    {plan.buttonText}
                  </button>
                </Link>
                <ul className="space-y-2 font-semibold py-5">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <span className="text-neutral-800 grid place-content-center mt-0.5 mr-3">
                        {feature.icon}
                      </span>
                      <span className="text-sm text-gray-600">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-3 pt-4 border-t border-neutral-200">
                  <h4 className="font-medium text-base text-gray-900 mb-3">
                    {plan.includes[0]}
                  </h4>
                  <ul className="space-y-2 font-semibold">
                    {plan.includes.slice(1).map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <span className="h-6 w-6 bg-sky-50 border border-[#199df4] rounded-full grid place-content-center mt-0.5 mr-3">
                          <CheckCheck className="h-4 w-4 text-[#199df4] " />
                        </span>
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
