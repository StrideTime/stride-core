/**
 * Authentication service that handles user sync and auth operations
 */

import type { AuthProvider, AuthSession } from '@stridetime/types';
import { userRepo } from '@stridetime/db';
import { getDatabase } from '@stridetime/db';

export class AuthService {
  constructor(private provider: AuthProvider) {}

  async signIn(email: string, password: string): Promise<AuthSession> {
    const session = await this.provider.signIn({ email, password });
    await this.ensureUserExists(session.user);
    return session;
  }

  async signOut(): Promise<void> {
    await this.provider.signOut();
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    return this.provider.getCurrentSession();
  }

  async refreshSession(): Promise<AuthSession | null> {
    const session = await this.provider.refreshSession();
    if (session) {
      await this.ensureUserExists(session.user);
    }
    return session;
  }

  onAuthChange(callback: (session: AuthSession | null) => void): () => void {
    return this.provider.onAuthChange(callback);
  }

  private async ensureUserExists(authUser: any): Promise<void> {
    const db = getDatabase();
    const existingUser = await userRepo.findByEmail(db, authUser.email);

    if (!existingUser) {
      await userRepo.create(db, {
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        avatarUrl: authUser.avatarUrl,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  }
}
