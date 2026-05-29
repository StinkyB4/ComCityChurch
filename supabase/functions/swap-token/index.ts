/**
 * SWAP-TOKEN EDGE FUNCTION
 * POST: create a 7-day swap contact token
 * GET:  validate token and return roster contact data
 *
 * Note: swap.html reads directly from Supabase (no auth required
 * because swap_tokens has RLS disabled and token is the secret).
 * This edge function is only needed if you want server-side token
 * creation with additional validation. The JS client can also
 * INSERT directly via the anon key.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  if (req.method === 'POST') {
    /* Create token */
    const { date, role, person_name } = await req.json();
    if (!date || !role || !person_name) {
      return new Response(JSON.stringify({ error: 'date, role, and person_name are required' }), { status: 400, headers: CORS });
    }
    const token = crypto.randomUUID().replace(/-/g, '');
    const expires = new Date(); expires.setDate(expires.getDate() + 7);
    const { error } = await sb.from('swap_tokens').insert({ token, date, role, person_name, expires_at: expires.toISOString() });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
    return new Response(JSON.stringify({ token }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  if (req.method === 'GET') {
    /* Validate token + return roster */
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: CORS });

    const { data: tokenRow } = await sb.from('swap_tokens').select('*').eq('token', token).single();
    if (!tokenRow) return new Response(JSON.stringify({ error: 'Token not found' }), { status: 404, headers: CORS });
    if (new Date(tokenRow.expires_at) < new Date()) return new Response(JSON.stringify({ error: 'Token expired' }), { status: 410, headers: CORS });

    const { data: roster } = await sb.from('schedule_rosters').select('*').eq('date', tokenRow.date).single();
    return new Response(JSON.stringify({ tokenRow, roster }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
});
