import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, requireConfiguration } from '../config/env.js';

let adminClient: SupabaseClient | undefined;

export function getAdminClient(): SupabaseClient {
  requireConfiguration('Supabase', [env.supabaseUrl, env.supabaseServiceRoleKey]);
  adminClient ??= createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return adminClient;
}

export function createUserClient(accessToken: string): SupabaseClient {
  requireConfiguration('Supabase', [env.supabaseUrl, env.supabasePublishableKey]);
  return createClient(env.supabaseUrl!, env.supabasePublishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}
