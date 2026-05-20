import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

class AuthError extends Error { status = 401 }
class ForbiddenError extends Error { status = 403 }
class InputError extends Error { status = 400 }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new AuthError('No auth header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !adminUser) throw new AuthError('Invalid token')

    const { data: adminSub } = await supabase
      .from('subscriptions').select('tier').eq('user_id', adminUser.id).single()
    if (adminSub?.tier !== 'superuser') throw new ForbiddenError('Superuser required')

    const { targetUserId, tier, reason, accessUntil } = await req.json()
    if (!targetUserId || !tier) throw new InputError('targetUserId and tier required')
    if (!['free', 'pro', 'premium'].includes(tier)) throw new InputError(`Invalid tier: ${tier}`)

    const { data: oldSub } = await supabase
      .from('subscriptions').select('tier').eq('user_id', targetUserId).single()

    const newStatus = tier === 'free' ? 'free' : 'active'

    const { error: upsertError } = await supabase.from('subscriptions').upsert({
      user_id: targetUserId,
      tier,
      status: newStatus,
      manually_set_by: adminUser.id,
      manually_set_at: new Date().toISOString(),
      manually_set_reason: reason ?? 'Granted by admin',
      access_until: accessUntil ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (upsertError) throw Object.assign(new Error(upsertError.message), { status: 500 })

    const { error: auditError } = await supabase.from('admin_audit_log').insert({
      admin_user_id: adminUser.id,
      action: 'tier_change',
      target_user_id: targetUserId,
      old_value: { tier: oldSub?.tier ?? 'free' },
      new_value: { tier },
      reason: reason ?? 'Granted by admin',
      created_at: new Date().toISOString(),
    })
    if (auditError) console.error('Audit log failed:', auditError.message)

    return new Response(JSON.stringify({ success: true, tier }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const e = err as Error & { status?: number }
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.status ?? 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
