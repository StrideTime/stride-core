/**
 * @stridetime/core
 * Business logic for Stride - task management, scoring, and productivity calculations
 */

// Services (new repository-based pattern) - PRIMARY API
export * from './services';

// Validation utilities
export * from './validation';

// Planning utilities
export * from './planning';

// Re-export types from @stridetime/types for convenience
export type {
  Task,
  Project,
  Workspace,
  TimeEntry,
  TaskDifficulty,
  TaskStatus,
  User,
  TaskType,
  DailySummary,
} from '@stridetime/types';
