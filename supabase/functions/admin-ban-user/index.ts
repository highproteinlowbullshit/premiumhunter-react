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

async function verifySuperuser(authHeader: string | null, supabase: ReturnType<typeof createClient>): Promise<string> {
  if (!authHeader) throw new AuthError('No auth header')
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new AuthError('Invalid token')
  const { data: sub } = await supabase.from('subscriptions').select('tier').eq('user_id', user.id).single()
  if (sub?.tier !== 'superuser') throw new ForbiddenError('Superuser access required')
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
    const { userId, reason } = await req.json()

    if (!userId || !reason) throw new InputError('userId and reason required')
    if (userId === adminId) throw new InputError('Cannot ban your own account')

    const { error: updateError, count } = await supabase.from('user_profiles').update({
      is_banned: true,
      ban_reason: reason,
      banned_at: new Date().toISOString(),
      banned_by: adminId,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    if (updateError) throw Object.assign(new Error(updateError.message), { status: 500 })
    if (count === 0) throw new InputError('User profile not found')

    const { error: auditError } = await supabase.from('admin_audit_log').insert({
      admin_user_id: adminId,
      action: 'ban_user',
      target_user_id: userId,
      new_value: { is_banned: true },
      reason,
      created_at: new Date().toISOString(),
    })
    if (auditError) console.error('Audit log failed:', auditError.message)

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const e = err as Error & { status?: number }
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.status ?? 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
