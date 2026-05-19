import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No auth header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !adminUser) throw new Error('Invalid token')

    const { data: adminSub } = await supabase
      .from('subscriptions').select('tier').eq('user_id', adminUser.id).single()
    if (adminSub?.tier !== 'superuser') throw new Error('Superuser required')

    const { targetUserId, reason } = await req.json()
    if (!targetUserId) throw new Error('targetUserId required')
    if (targetUserId === adminUser.id) throw new Error('Cannot delete your own account')

    // Fetch email for audit log (safe: data may be null for already-deleted users)
    const { data: targetUserData } = await supabase.auth.admin.getUserById(targetUserId)
    const targetEmail = targetUserData?.user?.email ?? null

    // deleteUser cascades to all public tables via ON DELETE CASCADE
    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId)
    if (deleteError) throw deleteError

    // Write audit log after successful deletion
    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminUser.id,
      action: 'delete_user',
      target_user_id: targetUserId,
      old_value: { email: targetEmail },
      new_value: null,
      reason: reason ?? 'Deleted by admin',
      created_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
