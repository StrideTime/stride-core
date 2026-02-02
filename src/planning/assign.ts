/**
 * Planning and task assignment utilities
 */

import type { Task } from '@stridetime/types';

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
  if (task.dueDate) {
    const dueDate = new Date(task.dueDate);
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
  if (task.maxMinutes && task.actualMinutes) {
    const timeRemaining = task.maxMinutes - task.actualMinutes;
    const percentRemaining = timeRemaining / task.maxMinutes;

    if (percentRemaining <= 0.2) score += 20; // <20% time left
    else if (percentRemaining <= 0.5) score += 10; // <50% time left
  }

  return score;
}

/**
 * Sort tasks by priority score (highest first)
 *
 * @param tasks - Tasks to sort
 * @param today - Today's date (defaults to now)
 * @returns Sorted tasks
 */
export function sortByPriority(tasks: Task[], today: Date = new Date()): Task[] {
  return [...tasks].sort((a, b) => {
    return calculatePriority(b, today) - calculatePriority(a, today);
  });
}

/**
 * Get high priority tasks (score >= 30)
 *
 * @param tasks - Tasks to filter
 * @param today - Today's date (defaults to now)
 * @returns High priority tasks
 */
export function getHighPriorityTasks(tasks: Task[], today: Date = new Date()): Task[] {
  return tasks.filter((task) => calculatePriority(task, today) >= 30);
}
