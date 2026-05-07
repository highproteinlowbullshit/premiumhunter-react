import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Tier, TIER_ORDER, FeatureKey, hasAccess } from '../lib/featureConfig'

export type { Tier }

export interface SubscriptionData {
  tier: Tier
  status: string
  accessUntil: string | null
}

export function useSubscription() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async (): Promise<SubscriptionData> => {
      if (!user) return { tier: 'free', status: 'free', accessUntil: null }
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier, status, access_until')
        .eq('user_id', user.id)
        .single()
      if (error || !data) return { tier: 'free', status: 'free', accessUntil: null }

      let effectiveTier = data.tier as Tier
      if (
        data.access_until &&
        new Date(data.access_until) < new Date() &&
        effectiveTier !== 'superuser'
      ) {
        effectiveTier = 'free'
      }

      return {
        tier: effectiveTier,
        status: data.status,
        accessUntil: data.access_until ?? null,
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!user,
  })

  const tier = data?.tier ?? 'free'

  return {
    subscription: data,
    tier,
    isLoading,
    isFree:      tier === 'free',
    isPro:       tier === 'pro' || tier === 'superuser',
    isSuperuser: tier === 'superuser',
    can: (feature: FeatureKey): boolean => {
      if (tier === 'superuser') return true
      return hasAccess(tier, feature)
    },
    hasTier: (required: Tier): boolean => {
      if (tier === 'superuser') return true
      return TIER_ORDER[tier] >= TIER_ORDER[required]
    },
    canAccess: (required: Tier): boolean => {
      if (tier === 'superuser') return true
      return TIER_ORDER[tier] >= TIER_ORDER[required]
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] }),
  }
}
