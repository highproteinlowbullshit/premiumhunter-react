import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSubscription } from './useSubscription'

export interface AdminUser {
  user_id: string
  email: string | null
  display_name: string | null
  country: string | null
  last_seen_at: string | null
  total_sessions: number
  positions_count: number
  is_banned: boolean
  notes: string | null
  tier: string
  status: string
  current_period_end: string | null
  trial_end: string | null
  stripe_customer_id: string | null
  signup_date: string
  manually_set_by: string | null
  manually_set_reason: string | null
}

export interface AuditLogEntry {
  id: string
  admin_user_id: string
  action: string
  target_user_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  reason: string | null
  created_at: string
}

export function useAdminData() {
  const { isSuperuser } = useSubscription()
  const queryClient = useQueryClient()

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.functions.invoke('admin-get-users', { body: {} })
      if (error) throw error
      return data.users ?? []
    },
    staleTime: 60 * 1000,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 2000,
    enabled: isSuperuser,
  })

  const auditLog = useQuery({
    queryKey: ['admin-audit-log'],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data, error } = await supabase.functions.invoke('admin-get-audit-log', { body: {} })
      if (error) throw error
      return data.logs ?? []
    },
    staleTime: 30 * 1000,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 2000,
    enabled: isSuperuser,
  })

  const changeTier = useMutation({
    mutationFn: async (params: { userId: string; newTier: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-change-tier', { body: params })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const banUser = useMutation({
    mutationFn: async (params: { userId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-ban-user', { body: params })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const addNote = useMutation({
    mutationFn: async (params: { userId: string; note: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-add-note', { body: params })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return { users, auditLog, changeTier, banUser, addNote }
}
