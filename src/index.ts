/**
 * @stridetime/core
 * Business logic for Stride - task management, scoring, and productivity calculations
 */

// Services (new repository-based pattern) - PRIMARY API
export * from './services';

// Auth
export { AuthService } from './auth/AuthService';
export { createAuthService } from './auth/createAuthService';

// Validation utilities
export * from './validation';

// Planning utilities
export * from './planning';

// Database functions (re-exported from @stridetime/db)
export {
  initDatabase,
  getDatabase,
  closeDatabase,
  isDatabaseInitialized,
  type StrideDatabase,
  type DatabaseConfig,
  type LocalDatabaseConfig,
  type SyncDatabaseConfig,
} from '@stridetime/db';

// Repositories (re-exported from @stridetime/db for client use)
// Note: Services should be preferred when available
export {
  projectRepo,
  workspaceRepo,
  type ProjectRepository,
  type WorkspaceRepository,
} from '@stridetime/db';

// Re-export enums from @stridetime/types

