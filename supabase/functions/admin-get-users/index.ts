import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const adminId = await verifySuperuser(req.headers.get('Authorization'), supabase)

    const { data: users, error } = await supabase
      .from('admin_users_overview')
      .select('*')
      .order('signup_date', { ascending: false })

    if (error) throw error

    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminId,
      action: 'view_users',
      created_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ users }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }
})
