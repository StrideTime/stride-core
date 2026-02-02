/**
 * Role-based permission system
 * Uses database-driven roles for flexible grandfathering
 */

import type { Role, UserSubscription } from '@stridetime/db';

/**
 * Check if role has a specific feature
 */
export function hasFeature(role: Role, feature: keyof Role): boolean {
  const value = role[feature];

  // Handle boolean features
  if (typeof value === 'boolean') {
    return value;
  }

  // Handle numeric features (treat as boolean: 0 = false, 1 = true)
  if (typeof value === 'number' && (value === 0 || value === 1)) {
    return value === 1;
  }

  return false;
}

/**
 * Check if user can create more resources
 */
export function canCreateResource(
  role: Role,
  limitField: 'max_workspaces' | 'max_projects' | 'max_team_members',
  currentCount: number
): boolean {
  const limit = role[limitField];

  // null = unlimited
  if (limit === null) {
    return true;
  }

  return currentCount < limit;
}

/**
 * Get remaining quota for a resource
 */
export function getRemainingQuota(
  role: Role,
  limitField: 'max_workspaces' | 'max_projects' | 'max_team_members',
  currentCount: number
): number | 'unlimited' {
  const limit = role[limitField];

  if (limit === null) {
    return 'unlimited';
  }

  return Math.max(0, limit - currentCount);
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(subscription: UserSubscription): boolean {
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * Check if subscription is grandfathered
 */
export function isGrandfathered(subscription: UserSubscription): boolean {
  return subscription.is_grandfathered === true || subscription.is_grandfathered === 1;
}

/**
 * Get upgrade message based on current role
 */
export function getUpgradeMessage(role: Role, feature: string): string {
  if (role.name === 'FREE') {
    return `Upgrade to Pro to unlock ${feature}. Starting at $12/month.`;
  }

  if (role.name.startsWith('PRO')) {
    return `Upgrade to Team to unlock ${feature}. Starting at $19/user/month.`;
  }

  if (role.name === 'TEAM') {
    return `Contact us for Enterprise to unlock ${feature}.`;
  }

  return `Upgrade your plan to unlock ${feature}.`;
}

/**
 * Calculate effective monthly price (for yearly subscriptions)
 */
export function getEffectiveMonthlyPrice(subscription: UserSubscription): number {
  if (subscription.billing_period === 'yearly') {
    return Math.round(subscription.price_cents / 12);
  }

  if (subscription.billing_period === 'lifetime') {
    return 0;
  }

  return subscription.price_cents;
}

/**
 * Check if user should see "grandfathered" badge
 */
export function shouldShowGrandfatheredBadge(
  role: Role,
  subscription: UserSubscription
): boolean {
  // Show if explicitly grandfathered
  if (isGrandfathered(subscription)) {
    return true;
  }

  // Show if on legacy role
  if (role.is_legacy) {
    return true;
  }

  // Show if on lifetime plan
  if (subscription.billing_period === 'lifetime') {
    return true;
  }

  return false;
}

/**
 * Get grandfathered display text
 */
export function getGrandfatheredText(subscription: UserSubscription): string {
  if (subscription.billing_period === 'lifetime') {
    return 'Lifetime Access';
  }

  if (subscription.grandfathered_reason === 'founder') {
    return 'Founder Plan';
  }

  if (subscription.grandfathered_reason === 'early_adopter') {
    return 'Early Adopter Pricing';
  }

  return 'Legacy Plan';
}

/**
 * Check if user can upgrade to a specific role
 */
export function canUpgradeTo(currentRole: Role, targetRole: Role): boolean {
  // Can't "upgrade" to same role
  if (currentRole.id === targetRole.id) {
    return false;
  }

  // Can't upgrade to inactive roles
  if (!targetRole.is_active) {
    return false;
  }

  // Can't upgrade to legacy roles
  if (targetRole.is_legacy) {
    return false;
  }

  // Simple tier order check
  const tierOrder = ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'];
  const currentIndex = tierOrder.indexOf(currentRole.name.split('_')[0]);
  const targetIndex = tierOrder.indexOf(targetRole.name.split('_')[0]);

  return targetIndex > currentIndex;
}

/**
 * Check if user can downgrade to a specific role
 */
export function canDowngradeTo(currentRole: Role, targetRole: Role): boolean {
  // Can't "downgrade" to same role
  if (currentRole.id === targetRole.id) {
    return false;
  }

  // Can't downgrade to inactive roles
  if (!targetRole.is_active) {
    return false;
  }

  // Simple tier order check
  const tierOrder = ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'];
  const currentIndex = tierOrder.indexOf(currentRole.name.split('_')[0]);
  const targetIndex = tierOrder.indexOf(targetRole.name.split('_')[0]);

  return targetIndex < currentIndex;
}
