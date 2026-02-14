"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Ban,
  FileCheck,
  Home,
  Briefcase,
  ShoppingCart,
} from "lucide-react";

export interface LetterType {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}

export const LETTER_TYPES: LetterType[] = [
  {
    value: "demand_letter",
    label: "Demand Letter",
    description: "Formal demand for payment or action",
    icon: <FileText className="w-8 h-8" />,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    value: "cease_desist",
    label: "Cease and Desist",
    description: "Stop harmful or illegal activity",
    icon: <Ban className="w-8 h-8" />,
    gradient: "from-red-500 to-pink-500",
  },
  {
    value: "contract_breach",
    label: "Contract Breach",
    description: "Notify of contract violation",
    icon: <FileCheck className="w-8 h-8" />,
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    value: "eviction_notice",
    label: "Eviction Notice",
    description: "Legal notice to vacate property",
    icon: <Home className="w-8 h-8" />,
    gradient: "from-orange-500 to-amber-500",
  },
  {
    value: "employment_dispute",
    label: "Employment Dispute",
    description: "Workplace issue resolution",
    icon: <Briefcase className="w-8 h-8" />,
    gradient: "from-green-500 to-emerald-500",
  },
  {
    value: "consumer_complaint",
    label: "Consumer Complaint",
    description: "Product or service complaint",
    icon: <ShoppingCart className="w-8 h-8" />,
    gradient: "from-teal-500 to-cyan-500",
  },
];

interface LetterTypeSelectorProps {
  onSelect: (value: string) => void;
  selectedType?: string;
}

export function LetterTypeSelector({
  onSelect,
  selectedType,
}: LetterTypeSelectorProps) {
  return (
    <div className="w-full">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-[#199df4] to-[#0d8ae0] bg-clip-text text-transparent"
      >
        Select Letter Type
      </motion.h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {LETTER_TYPES.map((type, index) => (
          <motion.button
            key={type.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(type.value)}
            className={`
              relative group overflow-hidden
              bg-white dark:bg-slate-900
              rounded-2xl shadow-lg hover:shadow-2xl
              border-2 transition-all duration-300
              p-6 text-left
              ${
                selectedType === type.value
                  ? "border-[#199df4] ring-4 ring-[#199df4]/20"
                  : "border-slate-200 dark:border-slate-700 hover:border-[#199df4]/50"
              }
            `}
          >
            {/* Gradient background on hover */}
            <div
              className={`
                absolute inset-0 bg-gradient-to-br ${type.gradient}
                opacity-0 group-hover:opacity-10 transition-opacity duration-300
              `}
            />

            {/* Icon container with gradient */}
            <motion.div
              whileHover={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
              className={`
                relative mb-4 w-16 h-16 rounded-xl
                bg-gradient-to-br ${type.gradient}
                flex items-center justify-center
                text-white shadow-lg
                group-hover:shadow-xl transition-shadow duration-300
              `}
            >
              {type.icon}
            </motion.div>

            {/* Content */}
            <div className="relative z-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-[#199df4] transition-colors duration-300">
                {type.label}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {type.description}
              </p>
            </div>

            {/* Selected indicator */}
            {selectedType === type.value && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-4 right-4 w-6 h-6 bg-[#199df4] rounded-full flex items-center justify-center"
              >
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>
            )}

            {/* Hover shine effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
