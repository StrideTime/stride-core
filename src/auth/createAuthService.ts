/**
 * Factory function to create AuthService with Supabase provider
 */

import { SupabaseAuthProvider } from '@stridetime/db';
import { AuthService } from './AuthService';

export function createAuthService(supabaseUrl: string, supabaseAnonKey: string): AuthService {
  const provider = new SupabaseAuthProvider(supabaseUrl, supabaseAnonKey);
  return new AuthService(provider);
}
