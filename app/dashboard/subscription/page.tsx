import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { SubscriptionCard } from '@/components/subscription-card'
import { PaymentVerifier } from '@/components/payment-verifier'
import { format } from 'date-fns'
import { Suspense } from 'react'
import SuccessMessage from '@/components/success-message'

export default async function SubscriptionPage() {
  const { profile } = await getUser()
  
  if (profile.role !== 'subscriber') {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <PaymentVerifier />
      </Suspense>
      <Suspense fallback={null}>
        <SuccessMessage />
      </Suspense>

      {isTestMode && (
        <div className="mb-6 bg-amber-500/10 border-2 border-amber-500/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-amber-800">Test Mode Active</p>
              <p className="text-sm text-amber-700">Stripe payments are simulated. No real charges will be made.</p>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold text-foreground mb-8">Subscription</h1>

      {subscription ? (
        <div className="space-y-6">
          <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-foreground/70 text-sm font-medium mb-1">Available Credits</p>
                <p className="text-4xl font-bold">{subscription.credits_remaining}</p>
                <p className="text-primary-foreground/70 text-sm mt-1">
                  {subscription.credits_remaining === 1 ? 'Letter' : 'Letters'} remaining
                </p>
              </div>
              <div className="text-right">
                <div className="bg-primary-foreground/20 rounded-full p-4">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-semibold mb-2">{subscription.plan_type?.replace(/_/g, ' ').toUpperCase() || subscription.plan}</h2>
                <p className="text-muted-foreground">Active subscription</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">${subscription.price}</div>
                <div className="text-sm text-muted-foreground">
                  {subscription.plan_type === 'one_time' ? 'one-time' : 'per year'}
                </div>
              </div>
            </div>

            {subscription.coupon_code && (
              <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  <div>
                    <span className="font-semibold text-foreground">Coupon Applied: </span>
                    <span className="font-mono text-foreground">{subscription.coupon_code}</span>
                    {subscription.discount > 0 && (
                      <span className="text-sm text-muted-foreground ml-2">
                        (${subscription.discount.toFixed(2)} discount)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subscribed</span>
                <span className="font-medium">{format(new Date(subscription.created_at), 'MMM d, yyyy')}</span>
              </div>
              {subscription.current_period_end && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Until</span>
                  <span className="font-medium">{format(new Date(subscription.current_period_end), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
          </div>

          {subscription.credits_remaining <= 1 && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">Running Low on Credits?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You have {subscription.credits_remaining} {subscription.credits_remaining === 1 ? 'letter' : 'letters'} remaining. 
                Upgrade your plan to get more credits.
              </p>
              <SubscriptionCard />
            </div>
          )}

          <div className="bg-muted border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Need Help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Contact support for questions about your subscription, credits, or billing.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-muted-foreground mb-8">Choose a subscription plan to start generating legal letters</p>
          <SubscriptionCard />
        </div>
      )}
    </DashboardLayout>
  )
}
