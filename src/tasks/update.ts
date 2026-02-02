/**
 * Task update logic
 */

import type { Task, TaskStatus } from '@stridetime/db';

/**
 * Parameters for updating a task
 */
export interface UpdateTaskParams {
  title?: string;
  description?: string;
  progress?: number;
  status?: TaskStatus;
  estimatedMinutes?: number;
  maxMinutes?: number;
  plannedForDate?: Date | null;
  dueDate?: Date | null;
  taskTypeId?: string | null;
}

/**
 * Validate task update parameters
 *
 * @param params - Update parameters
 * @throws Error if validation fails
 */
export function validateUpdateTask(params: UpdateTaskParams): void {
  if (params.title !== undefined) {
    if (params.title.trim().length === 0) {
      throw new Error('Task title cannot be empty');
    }
    if (params.title.length > 200) {
      throw new Error('Task title must be under 200 characters');
    }
  }

  if (params.progress !== undefined) {
    if (params.progress < 0 || params.progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }
  }

  if (params.description !== undefined && params.description.length > 5000) {
    throw new Error('Description must be under 5000 characters');
  }
}

/**
 * Update a task
 *
 * @param db - Database instance
 * @param taskId - Task ID to update
 * @param params - Update parameters
 * @returns Updated task
 */
export async function updateTask(
  db: any,
  taskId: string,
  params: UpdateTaskParams
): Promise<Task> {
  validateUpdateTask(params);

  const updates: string[] = [];
  const values: any[] = [];

  if (params.title !== undefined) {
    updates.push('title = ?');
    values.push(params.title.trim());
  }

  if (params.description !== undefined) {
    updates.push('description = ?');
    values.push(params.description.trim() || null);
  }

  if (params.progress !== undefined) {
    updates.push('progress = ?');
    values.push(params.progress);

    // Auto-update status based on progress
    if (params.progress === 100 && params.status === undefined) {
      updates.push('status = ?');
      values.push('COMPLETED');
      updates.push('completed_at = ?');
      values.push(new Date().toISOString());
    }
  }

  if (params.status !== undefined) {
    updates.push('status = ?');
    values.push(params.status);

    if (params.status === 'COMPLETED') {
      updates.push('completed_at = ?');
      values.push(new Date().toISOString());
      if (params.progress === undefined) {
        updates.push('progress = ?');
        values.push(100);
      }
    }
  }

  if (params.estimatedMinutes !== undefined) {
    updates.push('estimated_minutes = ?');
    values.push(params.estimatedMinutes);
  }

  if (params.maxMinutes !== undefined) {
    updates.push('max_minutes = ?');
    values.push(params.maxMinutes);
  }

  if (params.plannedForDate !== undefined) {
    updates.push('planned_for_date = ?');
    values.push(params.plannedForDate?.toISOString() ?? null);
  }

  if (params.dueDate !== undefined) {
    updates.push('due_date = ?');
    values.push(params.dueDate?.toISOString() ?? null);
  }

  if (params.taskTypeId !== undefined) {
    updates.push('task_type_id = ?');
    values.push(params.taskTypeId);
  }

  // Always update updated_at
  updates.push('updated_at = ?');
  values.push(new Date().toISOString());

  // Add taskId for WHERE clause
  values.push(taskId);

  await db.raw(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);

  // Fetch and return updated task
  const [task] = await db.raw('SELECT * FROM tasks WHERE id = ?', [taskId]);
  return task as Task;
}

/**
 * Update task progress and recalculate parent progress if needed
 *
 * @param db - Database instance
 * @param taskId - Task ID
 * @param progress - New progress (0-100)
 */
export async function updateTaskProgress(
  db: any,
  taskId: string,
  progress: number
): Promise<Task> {
  // Update this task
  const task = await updateTask(db, taskId, { progress });

  // If this is a sub-task, update parent progress
  if (task.parent_task_id) {
    await updateParentProgress(db, task.parent_task_id);
  }

  return task;
}

/**
 * Calculate and update parent task progress based on sub-tasks
 *
 * @param db - Database instance
 * @param parentTaskId - Parent task ID
 */
export async function updateParentProgress(db: any, parentTaskId: string): Promise<void> {
  // Get all sub-tasks
  const subTasks = await db.raw(
    'SELECT progress FROM tasks WHERE parent_task_id = ? AND deleted = 0',
    [parentTaskId]
  );

  if (subTasks.length === 0) {
    return;
  }

  // Calculate average progress
  const totalProgress = subTasks.reduce((sum: number, task: Task) => sum + task.progress, 0);
  const averageProgress = Math.round(totalProgress / subTasks.length);

  // Update parent task
  await updateTask(db, parentTaskId, { progress: averageProgress });
}
