import type { Membership, Profile } from '@eventrahq/contracts';
import type { SupabaseClient, User } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request {
      auth?: { user: User; profile: Profile; memberships: Membership[]; supabase: SupabaseClient; accessToken: string };
    }
  }
}

export {};
