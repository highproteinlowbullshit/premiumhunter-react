import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export type Tier = 'free' | 'pro' | 'premium' | 'superuser'

export interface SubscriptionData {
  tier: Tier
  status: string
  isActive: boolean
  isTrial: boolean
  trialEnd: string | null
  periodEnd: string | null
  isCanceled: boolean
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
}

export function useSubscription() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async (): Promise<SubscriptionData> => {
      if (!user) return defaultFreeSubscription()
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (error || !data) return defaultFreeSubscription()

      const canceledButActive =
        data.status === 'canceled' &&
        data.current_period_end &&
        new Date(data.current_period_end) > new Date()

      const isActive =
        ['active', 'trialing', 'superuser'].includes(data.status) ||
        !!canceledButActive

      return {
        tier: isActive ? (data.tier as Tier) : 'free',
        status: data.status,
        isActive,
        isTrial: data.status === 'trialing',
        trialEnd: data.trial_end,
        periodEnd: data.current_period_end,
        isCanceled: data.status === 'canceled',
        cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
        stripeCustomerId: data.stripe_customer_id,
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!user,
  })

  const tier = data?.tier ?? 'free'

  const tierOrder: Record<Tier, number> = { free: 0, pro: 1, premium: 2, superuser: 3 }

  const canAccess = (requiredTier: Tier): boolean =>
    tierOrder[tier] >= tierOrder[requiredTier]

  const refreshSubscription = () =>
    queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })

  return {
    subscription: data,
    tier,
    isLoading,
    isFree: tier === 'free',
    isPro: canAccess('pro'),
    isPremium: canAccess('premium'),
    isSuperuser: tier === 'superuser',
    canAccess,
    refreshSubscription,
  }
}

function defaultFreeSubscription(): SubscriptionData {
  return {
    tier: 'free',
    status: 'free',
    isActive: true,
    isTrial: false,
    trialEnd: null,
    periodEnd: null,
    isCanceled: false,
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
  }
}
