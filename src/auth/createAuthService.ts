/**
 * Factory function to create AuthService with Supabase provider
 */

import { SupabaseAuthProvider } from '@stridetime/db';
import { AuthService } from './AuthService';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createAuthService(
  supabaseUrl: string,
  supabaseAnonKey: string,
  supabaseClient?: SupabaseClient,
): AuthService {
  const provider = new SupabaseAuthProvider(supabaseUrl, supabaseAnonKey, supabaseClient);
  return new AuthService(provider);
}
