/**
 * Database queries for role-based permissions
 */

import type { Role, UserSubscription, UserRoleInfo } from '@stridetime/db';

/**
 * Get user's current role and subscription
 */
export async function getUserRole(db: any, userId: string): Promise<UserRoleInfo | null> {
  const results = await db.raw(
    `SELECT
      r.*,
      s.id as subscription_id,
      s.user_id,
      s.role_id,
      s.status,
      s.price_cents,
      s.currency,
      s.billing_period,
      s.stripe_customer_id,
      s.stripe_subscription_id,
      s.stripe_price_id,
      s.started_at,
      s.current_period_start,
      s.current_period_end,
      s.canceled_at,
      s.trial_ends_at,
      s.is_grandfathered,
      s.grandfathered_reason,
      s.created_at as subscription_created_at,
      s.updated_at as subscription_updated_at
     FROM user_subscriptions s
     JOIN roles r ON s.role_id = r.id
     WHERE s.user_id = ?
     LIMIT 1`,
    [userId]
  );

  if (results.length === 0) {
    return null;
  }

  const row = results[0];

  // Parse role
  const role: Role = {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    cloud_sync: Boolean(row.cloud_sync),
    mobile_app: Boolean(row.mobile_app),
    team_workspaces: Boolean(row.team_workspaces),
    export_reports: Boolean(row.export_reports),
    api_access: Boolean(row.api_access),
    sso: Boolean(row.sso),
    audit_logs: Boolean(row.audit_logs),
    custom_integrations: Boolean(row.custom_integrations),
    priority_support: Boolean(row.priority_support),
    max_workspaces: row.max_workspaces,
    max_projects: row.max_projects,
    max_team_members: row.max_team_members,
    max_api_calls_per_day: row.max_api_calls_per_day,
    max_storage_mb: row.max_storage_mb,
    is_active: Boolean(row.is_active),
    is_legacy: Boolean(row.is_legacy),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  // Parse subscription
  const subscription: UserSubscription = {
    id: row.subscription_id,
    user_id: row.user_id,
    role_id: row.role_id,
    status: row.status,
    price_cents: row.price_cents,
    currency: row.currency,
    billing_period: row.billing_period,
    stripe_customer_id: row.stripe_customer_id,
    stripe_subscription_id: row.stripe_subscription_id,
    stripe_price_id: row.stripe_price_id,
    started_at: row.started_at,
    current_period_start: row.current_period_start,
    current_period_end: row.current_period_end,
    canceled_at: row.canceled_at,
    trial_ends_at: row.trial_ends_at,
    is_grandfathered: Boolean(row.is_grandfathered),
    grandfathered_reason: row.grandfathered_reason,
    created_at: row.subscription_created_at,
    updated_at: row.subscription_updated_at,
  };

  return { role, subscription };
}

/**
 * Get all active (purchasable) roles
 */
export async function getActiveRoles(db: any): Promise<Role[]> {
  const results = await db.raw(
    `SELECT * FROM roles WHERE is_active = 1 ORDER BY
     CASE name
       WHEN 'FREE' THEN 1
       WHEN 'PRO' THEN 2
       WHEN 'TEAM' THEN 3
       WHEN 'ENTERPRISE' THEN 4
       ELSE 99
     END`
  );

  return results.map((row: any) => ({
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    cloud_sync: Boolean(row.cloud_sync),
    mobile_app: Boolean(row.mobile_app),
    team_workspaces: Boolean(row.team_workspaces),
    export_reports: Boolean(row.export_reports),
    api_access: Boolean(row.api_access),
    sso: Boolean(row.sso),
    audit_logs: Boolean(row.audit_logs),
    custom_integrations: Boolean(row.custom_integrations),
    priority_support: Boolean(row.priority_support),
    max_workspaces: row.max_workspaces,
    max_projects: row.max_projects,
    max_team_members: row.max_team_members,
    max_api_calls_per_day: row.max_api_calls_per_day,
    max_storage_mb: row.max_storage_mb,
    is_active: Boolean(row.is_active),
    is_legacy: Boolean(row.is_legacy),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Get role by ID
 */
export async function getRoleById(db: any, roleId: string): Promise<Role | null> {
  const results = await db.raw(`SELECT * FROM roles WHERE id = ? LIMIT 1`, [roleId]);

  if (results.length === 0) {
    return null;
  }

  const row = results[0];
  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    cloud_sync: Boolean(row.cloud_sync),
    mobile_app: Boolean(row.mobile_app),
    team_workspaces: Boolean(row.team_workspaces),
    export_reports: Boolean(row.export_reports),
    api_access: Boolean(row.api_access),
    sso: Boolean(row.sso),
    audit_logs: Boolean(row.audit_logs),
    custom_integrations: Boolean(row.custom_integrations),
    priority_support: Boolean(row.priority_support),
    max_workspaces: row.max_workspaces,
    max_projects: row.max_projects,
    max_team_members: row.max_team_members,
    max_api_calls_per_day: row.max_api_calls_per_day,
    max_storage_mb: row.max_storage_mb,
    is_active: Boolean(row.is_active),
    is_legacy: Boolean(row.is_legacy),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Create initial subscription for new user (Free tier)
 */
export async function createFreeSubscription(db: any, userId: string): Promise<UserSubscription> {
  const subscriptionId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.raw(
    `INSERT INTO user_subscriptions (
      id, user_id, role_id, status, price_cents, currency,
      billing_period, started_at, created_at, updated_at, is_grandfathered
    ) VALUES (?, ?, 'role_free', 'active', 0, 'USD', 'monthly', ?, ?, ?, 0)`,
    [subscriptionId, userId, now, now, now]
  );

  const [subscription] = await db.raw(
    `SELECT * FROM user_subscriptions WHERE id = ?`,
    [subscriptionId]
  );

  return {
    id: subscription.id,
    user_id: subscription.user_id,
    role_id: subscription.role_id,
    status: subscription.status,
    price_cents: subscription.price_cents,
    currency: subscription.currency,
    billing_period: subscription.billing_period,
    stripe_customer_id: subscription.stripe_customer_id,
    stripe_subscription_id: subscription.stripe_subscription_id,
    stripe_price_id: subscription.stripe_price_id,
    started_at: subscription.started_at,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    canceled_at: subscription.canceled_at,
    trial_ends_at: subscription.trial_ends_at,
    is_grandfathered: Boolean(subscription.is_grandfathered),
    grandfathered_reason: subscription.grandfathered_reason,
    created_at: subscription.created_at,
    updated_at: subscription.updated_at,
  };
}

/**
 * Record subscription change in history
 */
export async function recordSubscriptionChange(
  db: any,
  userId: string,
  oldRoleId: string | null,
  newRoleId: string,
  oldPriceCents: number | null,
  newPriceCents: number,
  reason: string
): Promise<void> {
  const historyId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.raw(
    `INSERT INTO subscription_history (
      id, user_id, old_role_id, new_role_id,
      old_price_cents, new_price_cents, reason, changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [historyId, userId, oldRoleId, newRoleId, oldPriceCents, newPriceCents, reason, now]
  );
}
