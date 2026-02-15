'use client'

import type { ButtonHTMLAttributes } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

type AnimatedButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  glow?: boolean
}

export function AnimatedButton({
  className,
  children,
  glow = true,
  ...props
}: AnimatedButtonProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -1 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24, mass: 0.6 }}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-5 py-2.5',
        'bg-[#199df4] text-white font-semibold',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#199df4] focus-visible:ring-offset-2',
        glow && 'shadow-[0_6px_24px_rgba(25,157,244,0.28)] hover:shadow-[0_10px_28px_rgba(25,157,244,0.35)]',
        'transition-shadow duration-200',
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}
