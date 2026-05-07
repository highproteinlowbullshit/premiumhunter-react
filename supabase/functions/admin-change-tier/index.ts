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
    const { userId, newTier, reason } = await req.json()

    if (!userId || !newTier) throw new Error('userId and newTier required')
    const validTiers = ['free', 'pro', 'premium', 'superuser']
    if (!validTiers.includes(newTier)) throw new Error(`Invalid tier: ${newTier}`)

    const { data: oldSub } = await supabase
      .from('subscriptions').select('tier, status').eq('user_id', userId).single()

    const newStatus = newTier === 'free' ? 'free' : newTier === 'superuser' ? 'superuser' : 'active'

    await supabase.from('subscriptions').upsert({
      user_id: userId,
      tier: newTier,
      status: newStatus,
      manually_set_by: adminId,
      manually_set_at: new Date().toISOString(),
      manually_set_reason: reason ?? 'Manual tier change by admin',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminId,
      action: 'tier_change',
      target_user_id: userId,
      old_value: { tier: oldSub?.tier, status: oldSub?.status },
      new_value: { tier: newTier, status: newStatus },
      reason: reason ?? 'Manual tier change',
      created_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ success: true, newTier }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
