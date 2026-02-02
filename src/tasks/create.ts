/**
 * Task creation logic
 */

import type { Task, Difficulty, StrideDatabase } from '@stridetime/db';

/**
 * Parameters for creating a new task
 */
export interface CreateTaskParams {
  title: string;
  projectId: string;
  difficulty?: Difficulty;
  estimatedMinutes?: number;
  maxMinutes?: number;
  dueDate?: Date;
  parentTaskId?: string;
  taskTypeId?: string;
  description?: string;
  plannedForDate?: Date;
}

/**
 * Validation errors
 */
export class TaskValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

/**
 * Validate task creation parameters
 *
 * @param params - Task creation parameters
 * @throws TaskValidationError if validation fails
 */
export function validateCreateTask(params: CreateTaskParams): void {
  // Title validation
  if (!params.title || params.title.trim().length === 0) {
    throw new TaskValidationError('title', 'Task title is required');
  }

  if (params.title.length > 200) {
    throw new TaskValidationError('title', 'Task title must be under 200 characters');
  }

  // Project validation
  if (!params.projectId) {
    throw new TaskValidationError('projectId', 'Task must belong to a project');
  }

  // Time validation
  if (params.estimatedMinutes !== undefined && params.estimatedMinutes < 0) {
    throw new TaskValidationError('estimatedMinutes', 'Estimated time cannot be negative');
  }

  if (params.maxMinutes !== undefined && params.maxMinutes < 0) {
    throw new TaskValidationError('maxMinutes', 'Max time cannot be negative');
  }

  if (
    params.estimatedMinutes !== undefined &&
    params.maxMinutes !== undefined &&
    params.estimatedMinutes > params.maxMinutes
  ) {
    throw new TaskValidationError(
      'estimatedMinutes',
      'Estimated time cannot exceed max time'
    );
  }

  // Due date validation
  if (params.dueDate && params.dueDate < new Date()) {
    throw new TaskValidationError('dueDate', 'Due date cannot be in the past');
  }

  // Description length validation
  if (params.description && params.description.length > 5000) {
    throw new TaskValidationError('description', 'Description must be under 5000 characters');
  }
}

/**
 * Create a new task
 *
 * @param db - StrideDatabase instance
 * @param userId - Current user ID
 * @param params - Task creation parameters
 * @returns Created task
 */
export async function createTask(
  db: StrideDatabase,
  userId: string,
  params: CreateTaskParams
): Promise<Task> {
  // Validate parameters
  validateCreateTask(params);

  // Generate task ID
  const taskId = crypto.randomUUID();

  // Create task using Prisma-like API
  const task = await db.tasks.create({
    data: {
      id: taskId,
      user_id: userId,
      project_id: params.projectId,
      parent_task_id: params.parentTaskId || null,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      difficulty: params.difficulty || 'MEDIUM',
      progress: 0,
      status: 'BACKLOG',
      estimated_minutes: params.estimatedMinutes ?? null,
      max_minutes: params.maxMinutes ?? null,
      actual_minutes: 0,
      planned_for_date: params.plannedForDate?.toISOString().split('T')[0] ?? null,
      due_date: params.dueDate?.toISOString() ?? null,
      task_type_id: params.taskTypeId ?? null,
      completed_at: null,
      deleted: false,
    },
  });

  return task as Task;
}
