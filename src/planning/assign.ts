/**
 * Planning and task assignment logic
 */

import type { Task } from '@stridetime/db';

/**
 * Assign a task to a specific day
 *
 * @param db - Database instance
 * @param taskId - Task ID
 * @param date - Date to assign (YYYY-MM-DD)
 * @returns Updated task
 */
export async function assignToDay(db: any, taskId: string, date: string): Promise<Task> {
  const now = new Date().toISOString();

  await db.raw(
    `UPDATE tasks
     SET planned_for_date = ?,
         status = CASE WHEN status = 'BACKLOG' THEN 'PLANNED' ELSE status END,
         updated_at = ?
     WHERE id = ?`,
    [date, now, taskId]
  );

  const [task] = await db.raw('SELECT * FROM tasks WHERE id = ?', [taskId]);
  return task as Task;
}

/**
 * Unassign a task from its planned date
 *
 * @param db - Database instance
 * @param taskId - Task ID
 * @returns Updated task
 */
export async function unassignTask(db: any, taskId: string): Promise<Task> {
  const now = new Date().toISOString();

  await db.raw(
    `UPDATE tasks
     SET planned_for_date = NULL,
         status = CASE WHEN status = 'PLANNED' THEN 'BACKLOG' ELSE status END,
         updated_at = ?
     WHERE id = ?`,
    [now, taskId]
  );

  const [task] = await db.raw('SELECT * FROM tasks WHERE id = ?', [taskId]);
  return task as Task;
}

/**
 * Reschedule a task to a different day
 *
 * @param db - Database instance
 * @param taskId - Task ID
 * @param newDate - New date (YYYY-MM-DD)
 * @returns Updated task
 */
export async function rescheduleTask(db: any, taskId: string, newDate: string): Promise<Task> {
  return assignToDay(db, taskId, newDate);
}

/**
 * Get tasks planned for a specific day
 *
 * @param db - Database instance
 * @param userId - User ID
 * @param date - Date (YYYY-MM-DD)
 * @returns Tasks for that day
 */
export async function getTasksForDay(db: any, userId: string, date: string): Promise<Task[]> {
  const tasks = await db.raw(
    `SELECT * FROM tasks
     WHERE user_id = ?
       AND planned_for_date = ?
       AND deleted = 0
     ORDER BY created_at ASC`,
    [userId, date]
  );

  return tasks as Task[];
}

/**
 * Get ongoing tasks (tasks that lapsed past their planned date)
 *
 * @param db - Database instance
 * @param userId - User ID
 * @param today - Today's date (YYYY-MM-DD)
 * @returns Ongoing tasks
 */
export async function getOngoingTasks(db: any, userId: string, today: string): Promise<Task[]> {
  const tasks = await db.raw(
    `SELECT * FROM tasks
     WHERE user_id = ?
       AND planned_for_date < ?
       AND status != 'COMPLETED'
       AND status != 'ARCHIVED'
       AND deleted = 0
     ORDER BY planned_for_date DESC`,
    [userId, today]
  );

  return tasks as Task[];
}

/**
 * Get backlog tasks (not planned for any day)
 *
 * @param db - Database instance
 * @param userId - User ID
 * @returns Backlog tasks
 */
export async function getBacklogTasks(db: any, userId: string): Promise<Task[]> {
  const tasks = await db.raw(
    `SELECT * FROM tasks
     WHERE user_id = ?
       AND planned_for_date IS NULL
       AND status = 'BACKLOG'
       AND deleted = 0
     ORDER BY created_at DESC`,
    [userId]
  );

  return tasks as Task[];
}

/**
 * Calculate task priority score
 * Used for suggesting which tasks to work on
 *
 * Weighted factors:
 * - Due date urgency (40%)
 * - Near completion (30%)
 * - Time constraint (20%)
 * - Neglect (10%)
 *
 * @param task - Task to score
 * @param today - Today's date
 * @returns Priority score (higher = more urgent)
 */
export function calculatePriority(task: Task, today: Date): number {
  let score = 0;

  // Due date urgency (40%)
  if (task.due_date) {
    const dueDate = new Date(task.due_date);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue <= 0) score += 40; // Overdue
    else if (daysUntilDue === 1) score += 35; // Due today/tomorrow
    else if (daysUntilDue <= 7) score += 25; // Due this week
    else if (daysUntilDue <= 30) score += 10; // Due this month
  }

  // Near completion (30%)
  if (task.progress >= 80) score += 30;
  else if (task.progress >= 50) score += 15;

  // Time constraint (20%)
  if (task.max_minutes && task.actual_minutes) {
    const timeRemaining = task.max_minutes - task.actual_minutes;
    const percentRemaining = timeRemaining / task.max_minutes;

    if (percentRemaining <= 0.2) score += 20; // <20% time left
    else if (percentRemaining <= 0.5) score += 10; // <50% time left
  }

  // Neglect (10%)
  if (task.updated_at) {
    const lastUpdated = new Date(task.updated_at);
    const daysSinceUpdate = Math.ceil((today.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate >= 7) score += 10; // Not touched in 7+ days
    else if (daysSinceUpdate >= 3) score += 5; // Not touched in 3+ days
  }

  return score;
}
