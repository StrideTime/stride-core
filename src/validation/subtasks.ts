/**
 * Sub-task validation and utilities
 */

import type { Task } from '@stridetime/types';

/**
 * Maximum nesting level for sub-tasks
 */
export const MAX_SUBTASK_DEPTH = 2;

/**
 * Check if a task can have sub-tasks
 * Rule: Max 2 levels (Task → Sub-task only, no deeper)
 *
 * @param task - Task to check
 * @param allTasks - All tasks in database
 * @returns True if task can have sub-tasks
 */
export function canHaveSubtasks(task: Task): boolean {
  // If task has no parent, it's level 1, can have sub-tasks
  if (!task.parentTaskId) {
    return true;
  }

  // If task has a parent, it's level 2, cannot have sub-tasks
  return false;
}

/**
 * Get sub-task depth/level
 *
 * @param task - Task to check
 * @returns Depth level (1 = root task, 2 = sub-task)
 */
export function getSubtaskDepth(task: Task): number {
  if (!task.parentTaskId) {
    return 1;
  }

  return 2; // Has parent, so depth is 2
}

/**
 * Validate sub-task creation
 *
 * @param parentTask - Parent task
 * @throws Error if validation fails
 */
export function validateSubtaskCreation(parentTask: Task): void {
  if (!canHaveSubtasks(parentTask)) {
    throw new Error('Cannot create sub-task: maximum nesting depth (2 levels) reached');
  }

  if (parentTask.status === 'ARCHIVED') {
    throw new Error('Cannot create sub-task for archived task');
  }
}

/**
 * Calculate parent progress from sub-tasks
 *
 * @param subTasks - Sub-tasks of a parent
 * @returns Average progress (0-100)
 */
export function calculateParentProgress(subTasks: Task[]): number {
  if (subTasks.length === 0) {
    return 0;
  }

  const totalProgress = subTasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(totalProgress / subTasks.length);
}

/**
 * Check if parent task can be marked complete
 * Rule: Parent can only be 100% if all sub-tasks are 100%
 *
 * @param subTasks - Sub-tasks of a parent
 * @returns True if all sub-tasks are complete
 */
export function canCompleteParent(subTasks: Task[]): boolean {
  if (subTasks.length === 0) {
    return true;
  }

  return subTasks.every(task => task.progress === 100);
}

/**
 * Get incomplete sub-tasks
 *
 * @param subTasks - Sub-tasks of a parent
 * @returns Sub-tasks that are not 100% complete
 */
export function getIncompleteSubtasks(subTasks: Task[]): Task[] {
  return subTasks.filter(task => task.progress < 100);
}
