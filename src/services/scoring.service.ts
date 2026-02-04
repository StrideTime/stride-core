/**
 * Scoring Service
 * Productivity scoring calculations using repository pattern
 * Based on BUSINESS_LOGIC.md specifications
 */

import type { StrideDatabase, TaskRepository, TimeEntryRepository, DailySummaryRepository } from '@stridetime/db';
import {
  taskRepo as defaultTaskRepo,
  timeEntryRepo as defaultTimeEntryRepo,
  dailySummaryRepo as defaultDailySummaryRepo
} from '@stridetime/db';
import type { Task, TaskDifficulty } from '@stridetime/types';

/**
 * Difficulty multipliers for base points calculation
 */
export const DIFFICULTY_MULTIPLIERS: Record<TaskDifficulty, number> = {
  TRIVIAL: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 5,
  EXTREME: 8,
} as const;

/**
 * Task score breakdown
 */
export type TaskScore = {
  basePoints: number;
  efficiencyBonus: number;
  focusBonus: number;
  totalPoints: number;
}

/**
 * Context for calculating task score
 */
export type ScoringContext = {
  /**
   * Number of different task types worked on today
   */
  taskTypesWorkedToday: number;
}

/**
 * Scoring Service for business logic
 */
export class ScoringService {
  constructor(
    private taskRepo: TaskRepository = defaultTaskRepo,
    private timeEntryRepo: TimeEntryRepository = defaultTimeEntryRepo,
    private dailySummaryRepo: DailySummaryRepository = defaultDailySummaryRepo
  ) {}

  /**
   * Calculate productivity points for a task
   *
   * Formula:
   * - base_points = difficulty_multiplier × (progress / 100)
   * - efficiency_bonus = +20% if (actual_time < estimated_time) and task completed
   * - focus_bonus = +10% if worked on 3+ task types today
   * - total_points = base_points × (1 + efficiency_bonus + focus_bonus)
   */
  calculateTaskScore(task: Task, context: ScoringContext): TaskScore {
    // Base points = difficulty × completion percentage
    const basePoints = DIFFICULTY_MULTIPLIERS[task.difficulty] * (task.progress / 100);

    // Efficiency bonus: 20% if completed under estimate
    let efficiencyBonus = 0;
    if (
      task.progress === 100 &&
      task.estimatedMinutes &&
      task.actualMinutes < task.estimatedMinutes
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
   * @returns Efficiency rating (1.0 = on-time, >1.0 = under time, <1.0 = over time)
   */
  calculateEfficiency(task: Task): number {
    if (!task.estimatedMinutes || task.actualMinutes === 0) {
      return 1.0;
    }

    return task.estimatedMinutes / task.actualMinutes;
  }

  /**
   * Get efficiency rating label
   */
  getEfficiencyLabel(efficiency: number): string {
    if (efficiency >= 1.5) return 'Exceptional';
    if (efficiency >= 1.2) return 'Excellent';
    if (efficiency >= 1.0) return 'Good';
    if (efficiency >= 0.8) return 'Fair';
    return 'Needs Improvement';
  }

  /**
   * Calculate daily productivity score
   */
  calculateDailyScore(completedTasks: Task[], context: ScoringContext): number {
    return completedTasks.reduce((total, task) => {
      const score = this.calculateTaskScore(task, context);
      return total + score.totalPoints;
    }, 0);
  }

  /**
   * Calculate productivity trend
   *
   * @returns Trend percentage (e.g., 1.25 = 125% of average)
   */
  calculateTrend(todayScore: number, averageScore: number): number {
    if (averageScore === 0) {
      return 1.0;
    }

    return todayScore / averageScore;
  }

  /**
   * Get trend label
   */
  getTrendLabel(trend: number): string {
    const percentage = Math.round((trend - 1) * 100);

    if (percentage > 20) return `${percentage}% above your average—great focus today!`;
    if (percentage > 0) return `${percentage}% above your average`;
    if (percentage === 0) return 'Right on your average';
    if (percentage > -20) return `${Math.abs(percentage)}% below your average`;
    return `${Math.abs(percentage)}% below your average—take it easy`;
  }

  /**
   * Get the number of unique task types worked on today
   */
  async getTaskTypesWorkedToday(db: StrideDatabase, userId: string, date: string): Promise<number> {
    // Get time entries for today
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;
    const entries = await this.timeEntryRepo.findByDateRange(db, userId, startOfDay, endOfDay);

    // Get unique task IDs
    const taskIds = [...new Set(entries.map((e) => e.taskId))];

    // Get tasks and their types
    const tasks = await Promise.all(taskIds.map((id) => this.taskRepo.findById(db, id)));
    const taskTypeIds = tasks
      .filter((t): t is Task => t !== null && t.taskTypeId !== null)
      .map((t) => t.taskTypeId);

    // Return count of unique task types
    return new Set(taskTypeIds).size;
  }

  /**
   * Calculate daily summary for a user on a specific date
   */
  async calculateDailySummary(
    db: StrideDatabase,
    userId: string,
    date: string
  ): Promise<{
    tasksCompleted: number;
    tasksWorkedOn: number;
    totalPoints: number;
    focusMinutes: number;
    efficiencyRating: number;
  }> {
    // Get time entries for the day
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;
    const entries = await this.timeEntryRepo.findByDateRange(db, userId, startOfDay, endOfDay);

    // Get unique tasks worked on
    const taskIds = [...new Set(entries.map((e) => e.taskId))];
    const tasks = (await Promise.all(taskIds.map((id) => this.taskRepo.findById(db, id)))).filter(
      (t): t is Task => t !== null
    );

    // Count completed tasks
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

    // Calculate total focus minutes
    const focusMinutes = entries.reduce((total, entry) => {
      if (!entry.endedAt) return total;
      const start = new Date(entry.startedAt).getTime();
      const end = new Date(entry.endedAt).getTime();
      return total + Math.floor((end - start) / 60000);
    }, 0);

    // Calculate scoring context
    const taskTypesWorkedToday = await this.getTaskTypesWorkedToday(db, userId, date);
    const context: ScoringContext = { taskTypesWorkedToday };

    // Calculate total points
    const totalPoints = this.calculateDailyScore(completedTasks, context);

    // Calculate average efficiency rating
    const tasksWithEstimates = tasks.filter(
      (t) => t.estimatedMinutes && t.actualMinutes > 0
    );
    const efficiencyRating =
      tasksWithEstimates.length > 0
        ? tasksWithEstimates.reduce((sum, t) => sum + this.calculateEfficiency(t), 0) /
          tasksWithEstimates.length
        : 1.0;

    return {
      tasksCompleted: completedTasks.length,
      tasksWorkedOn: tasks.length,
      totalPoints,
      focusMinutes,
      efficiencyRating: Math.round(efficiencyRating * 100) / 100, // Round to 2 decimals
    };
  }

  /**
   * Save daily summary to database
   */
  async saveDailySummary(
    db: StrideDatabase,
    userId: string,
    date: string,
    standoutMoment?: string | null
  ): Promise<void> {
    const summary = await this.calculateDailySummary(db, userId, date);

    await this.dailySummaryRepo.upsert(db, {
      userId,
      date,
      tasksCompleted: summary.tasksCompleted,
      tasksWorkedOn: summary.tasksWorkedOn,
      totalPoints: summary.totalPoints,
      focusMinutes: summary.focusMinutes,
      efficiencyRating: summary.efficiencyRating,
      standoutMoment: standoutMoment || null,
    });
  }

  /**
   * Get user's 30-day average score
   */
  async getAverageScore(db: StrideDatabase, userId: string, days: number = 30): Promise<number> {
    return this.dailySummaryRepo.calculateAveragePoints(db, userId, days);
  }
}

/**
 * Singleton instance for convenient access
 */
export const scoringService = new ScoringService();
