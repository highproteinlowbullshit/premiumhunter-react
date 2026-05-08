import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSubscription } from './useSubscription'

export interface HeartbeatEntry {
  id: number
  checked_at: string
  status: 'ok' | 'warning' | 'critical'
  snapshot_date: string | null
  tickers_covered: number | null
  tickers_expected: number
  coverage_pct: number | null
  total_runs: number | null
  failed_runs: number | null
  last_run_at: string | null
  alert_sent: boolean
  triggered_by: string
  message: string | null
  details: { issues: string[]; errorSamples: string[] } | null
}

export interface HeartbeatResult {
  status: 'ok' | 'warning' | 'critical'
  message: string
  tickers_covered: number
  tickers_expected: number
  coverage_pct: number
  latest_snapshot_date: string | null
  cron_runs_last_26h: number
  failed_runs: number
  alert_sent: boolean
}

export function useHeartbeatLog() {
  const { isSuperuser } = useSubscription()
  const queryClient = useQueryClient()

  const log = useQuery({
    queryKey: ['heartbeat-log'],
    queryFn: async (): Promise<HeartbeatEntry[]> => {
      const { data, error } = await supabase
        .from('heartbeat_log')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
    staleTime: 30 * 1000,
    refetchOnMount: true,
    enabled: isSuperuser,
  })

  const runCheck = useMutation({
    mutationFn: async (forceAlert = false): Promise<HeartbeatResult> => {
      const { data, error } = await supabase.functions.invoke('heartbeat-monitor', {
        body: { force_alert: forceAlert },
      })
      if (error) throw error
      return data as HeartbeatResult
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['heartbeat-log'] }),
  })

  return { log, runCheck }
}
