/**
 * Productivity scoring calculations
 * Based on BUSINESS_LOGIC.md specifications
 */

import type { Task, Difficulty } from '@stridetime/db';

/**
 * Difficulty multipliers for base points calculation
 */
export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  TRIVIAL: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 5,
  EXTREME: 8,
} as const;

/**
 * Task score breakdown
 */
export interface TaskScore {
  basePoints: number;
  efficiencyBonus: number;
  focusBonus: number;
  totalPoints: number;
}

/**
 * Context for calculating task score
 */
export interface ScoringContext {
  /**
   * Number of different task types worked on today
   */
  taskTypesWorkedToday: number;
}

/**
 * Calculate productivity points for a task
 *
 * Formula:
 * - base_points = difficulty_multiplier × (progress / 100)
 * - efficiency_bonus = +20% if (actual_time < estimated_time) and task completed
 * - focus_bonus = +10% if worked on 3+ task types today
 * - total_points = base_points × (1 + efficiency_bonus + focus_bonus)
 *
 * @param task - Task to score
 * @param context - Scoring context
 * @returns Task score breakdown
 */
export function calculateTaskScore(task: Task, context: ScoringContext): TaskScore {
  // Base points = difficulty × completion percentage
  const basePoints = DIFFICULTY_MULTIPLIERS[task.difficulty] * (task.progress / 100);

  // Efficiency bonus: 20% if completed under estimate
  let efficiencyBonus = 0;
  if (
    task.progress === 100 &&
    task.estimated_minutes &&
    task.actual_minutes < task.estimated_minutes
  ) {
    efficiencyBonus = basePoints * 0.2;
  }

  // Focus bonus: 10% if worked on 3+ task types today
  let focusBonus = 0;
  if (context.taskTypesWorkedToday >= 3) {
    focusBonus = basePoints * 0.1;
  }

  // Total points (rounded)
  const totalPoints = Math.round(basePoints + efficiencyBonus + focusBonus);

  return {
    basePoints: Math.round(basePoints * 10) / 10, // Round to 1 decimal
    efficiencyBonus: Math.round(efficiencyBonus * 10) / 10,
    focusBonus: Math.round(focusBonus * 10) / 10,
    totalPoints,
  };
}

/**
 * Calculate efficiency rating for a task
 *
 * @param task - Task to analyze
 * @returns Efficiency rating (1.0 = on-time, >1.0 = under time, <1.0 = over time)
 */
export function calculateEfficiency(task: Task): number {
  if (!task.estimated_minutes || task.actual_minutes === 0) {
    return 1.0;
  }

  return task.estimated_minutes / task.actual_minutes;
}

/**
 * Get efficiency rating label
 *
 * @param efficiency - Efficiency rating
 * @returns Human-readable label
 */
export function getEfficiencyLabel(efficiency: number): string {
  if (efficiency >= 1.5) return 'Exceptional';
  if (efficiency >= 1.2) return 'Excellent';
  if (efficiency >= 1.0) return 'Good';
  if (efficiency >= 0.8) return 'Fair';
  return 'Needs Improvement';
}

/**
 * Calculate daily productivity score
 *
 * @param completedTasks - Tasks completed today
 * @param context - Scoring context
 * @returns Total daily score
 */
export function calculateDailyScore(
  completedTasks: Task[],
  context: ScoringContext
): number {
  return completedTasks.reduce((total, task) => {
    const score = calculateTaskScore(task, context);
    return total + score.totalPoints;
  }, 0);
}

/**
 * Calculate productivity trend
 *
 * @param todayScore - Today's score
 * @param averageScore - 30-day average score
 * @returns Trend percentage (e.g., 1.25 = 125% of average)
 */
export function calculateTrend(todayScore: number, averageScore: number): number {
  if (averageScore === 0) {
    return 1.0;
  }

  return todayScore / averageScore;
}

/**
 * Get trend label
 *
 * @param trend - Trend value
 * @returns Human-readable trend description
 */
export function getTrendLabel(trend: number): string {
  const percentage = Math.round((trend - 1) * 100);

  if (percentage > 20) return `${percentage}% above your average—great focus today!`;
  if (percentage > 0) return `${percentage}% above your average`;
  if (percentage === 0) return 'Right on your average';
  if (percentage > -20) return `${Math.abs(percentage)}% below your average`;
  return `${Math.abs(percentage)}% below your average—take it easy`;
}
