import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CURRENT_DISCLAIMER_VERSION } from '../lib/disclaimer'

export function useDisclaimer() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['disclaimer', user?.id],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('disclaimer_acceptance')
        .select('disclaimer_version, accepted_at')
        .eq('user_id', user.id)
        .single()
      if (error || !data) return null
      return data
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  })

  const hasAccepted =
    !!data &&
    data.disclaimer_version === CURRENT_DISCLAIMER_VERSION

  const needsReAcceptance =
    !!data &&
    data.disclaimer_version !== CURRENT_DISCLAIMER_VERSION

  const accept = useMutation({
    mutationFn: async (typedConfirmation: string) => {
      const { error } = await supabase
        .from('disclaimer_acceptance')
        .upsert({
          user_id: user!.id,
          disclaimer_version: CURRENT_DISCLAIMER_VERSION,
          accepted_at: new Date().toISOString(),
          user_agent: navigator.userAgent,
          typed_confirmation: typedConfirmation,
        }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disclaimer', user?.id] })
    },
  })

  return {
    hasAccepted,
    needsReAcceptance,
    isLoading,
    accept: accept.mutate,
    isAccepting: accept.isPending,
    error: accept.error,
  }
}
