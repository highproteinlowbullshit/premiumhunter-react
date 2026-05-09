import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifySuperuser(authHeader: string | null, supabase: ReturnType<typeof createClient>): Promise<string> {
  if (!authHeader) throw new Error('No auth header')
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error('Invalid token')
  const { data: sub } = await supabase.from('subscriptions').select('tier').eq('user_id', user.id).single()
  if (sub?.tier !== 'superuser') throw new Error('Superuser access required')
  return user.id
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    await verifySuperuser(req.headers.get('Authorization'), supabase)

    const { page = 1, pageSize = 50, action, target_user_id, start_time, end_time } = await req.json()

    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })

    if (action) {
      query = query.eq('action', action)
    }
    if (target_user_id) {
      query = query.eq('target_user_id', target_user_id)
    }
    if (start_time) {
      query = query.gte('created_at', start_time)
    }
    if (end_time) {
      query = query.lte('created_at', end_time)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data: logs, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    return new Response(JSON.stringify({ logs, totalCount: count }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
