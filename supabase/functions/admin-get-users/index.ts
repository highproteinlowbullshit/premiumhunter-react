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
    const adminId = await verifySuperuser(req.headers.get('Authorization'), supabase)

    // Fetch app-level data from the view and auth emails in parallel.
    // auth.users.email is not reliably exposed through public views — use the
    // admin auth API instead, which always returns emails via service role.
    const [viewResult, authResult] = await Promise.all([
      supabase
        .from('admin_users_overview')
        .select('*')
        .order('signup_date', { ascending: false }),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
    ])

    if (viewResult.error) throw viewResult.error
    if (authResult.error) throw authResult.error

    // Build a lookup map: user_id → email from the auth API
    const emailMap = new Map<string, string>()
    for (const u of authResult.data.users) {
      if (u.email) emailMap.set(u.id, u.email)
    }

    // Merge: prefer email from auth API over whatever the view returned
    const users = (viewResult.data ?? []).map((row: any) => ({
      ...row,
      email: emailMap.get(row.user_id) ?? row.email ?? null,
    }))

    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminId,
      action: 'view_users',
      created_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ users }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
