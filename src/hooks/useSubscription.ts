import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Tier, FeatureKey } from '../lib/featureConfig'
import { TIER_ORDER, hasAccess } from '../lib/featureConfig'

export type { Tier }

export interface SubscriptionData {
  tier: Tier
  status: string
  accessUntil: string | null
}

export function useSubscription() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading: queryLoading } = useQuery({
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
    networkMode: 'always',
    enabled: !!user,
  })

  const isLoading = authLoading || queryLoading
  const tier = data?.tier ?? 'free'

  return {
    subscription: data,
    tier,
    isLoading,
    // Never treat the user as free-tier while the subscription is still loading —
    // this prevents free-tier gating (locked paper toggle, "Upgrade" badge, blur gates)
    // from flashing on screen before the real tier arrives.
    isFree:      isLoading ? false : tier === 'free',
    isPro:       isLoading ? false : (tier === 'pro' || tier === 'superuser'),
    isSuperuser: isLoading ? false : tier === 'superuser',
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
