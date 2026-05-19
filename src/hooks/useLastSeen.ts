import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useLastSeen() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    try {
      const lastUpdate = localStorage.getItem('ph_last_seen_update')
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      if (lastUpdate && parseInt(lastUpdate) > fiveMinutesAgo) return
    } catch {
      // storage unavailable — proceed anyway
    }

    supabase.from('user_profiles').upsert(
      { user_id: user.id, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    ).then(({ error }) => {
      if (error) return
      try {
        localStorage.setItem('ph_last_seen_update', Date.now().toString())
      } catch {
        // storage unavailable
      }
    })
  }, [user])
}
