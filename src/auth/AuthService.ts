/**
 * Authentication service that handles user sync and auth operations
 */

import type {
  AuthProvider,
  AuthSession,
  AuthEventType,
  OAuthProvider,
} from '@stridetime/types';
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

  async signUp(
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string }
  ): Promise<AuthSession> {
    const session = await this.provider.signUp({ email, password }, metadata);
    await this.ensureUserExists(session.user);
    return session;
  }

  async signInWithOAuth(provider: OAuthProvider): Promise<void> {
    // OAuth redirects to provider, user will be created on callback via onAuthChange
    await this.provider.signInWithOAuth(provider);
  }

  onAuthChange(
    callback: (session: AuthSession | null, event: AuthEventType) => void,
  ): () => void {
    return this.provider.onAuthChange(callback);
  }

  async resetPassword(
    email: string,
    options?: { redirectTo?: string },
  ): Promise<void> {
    const { error } = await this.provider.resetPasswordForEmail(email, options);
    if (error) {
      throw new Error('Failed to send reset email');
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    console.log('AuthService.updatePassword called with:', newPassword.length, 'characters');
    const { error } = await this.provider.updateUser({
      password: newPassword,
    });

    console.log('Provider updateUser result:', { error });

    if (error) {
      console.error('Password update failed:', error);
      throw new Error(`Failed to update password: ${error.message || 'Unknown error'}`);
    }
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
