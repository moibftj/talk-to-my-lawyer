'use client'

import { CheckCircle } from 'lucide-react'

interface Step {
  label: string
  description?: string
}

interface FormStepperProps {
  steps: Step[]
  currentStep: number
}

export function FormStepper({ steps, currentStep }: FormStepperProps) {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isFuture = index > currentStep

          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center min-w-0">
                <div className="flex items-center justify-center">
                  {isCompleted ? (
                    <CheckCircle className="w-8 h-8 text-green-500 fill-green-500 stroke-white" />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                        isCurrent
                          ? 'bg-[#199df4] border-[#199df4] text-white'
                          : 'border-gray-300 text-gray-400 bg-white'
                      }`}
                    >
                      {index + 1}
                    </div>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={`text-xs sm:text-sm transition-colors ${
                      isCurrent
                        ? 'font-bold text-[#199df4]'
                        : isCompleted
                          ? 'font-medium text-foreground'
                          : 'font-normal text-muted-foreground'
                    }`}
                  >
                    <span className="hidden xs:inline sm:inline">{step.label}</span>
                    <span className="inline xs:hidden sm:hidden">
                      {step.label.split(' ')[0]}
                    </span>
                  </p>
                  {step.description && (
                    <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 sm:mx-4 mt-[-1.5rem] transition-colors ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
