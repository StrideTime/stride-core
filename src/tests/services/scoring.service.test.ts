/**
 * Unit tests for ScoringService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoringService, DIFFICULTY_MULTIPLIERS } from '../../services/scoring.service';
import {
  createMockTask,
  createMockTimeEntry,
  createMockDatabase,
  createMockCompletedTask,
} from '@stridetime/test-utils';
import type { ScoringContext } from '../../services/scoring.service';

// Mock the repositories - inline to avoid hoisting issues
vi.mock('@stridetime/db', () => ({
  taskRepo: {
    findById: vi.fn(),
    findByUser: vi.fn(),
  },
  timeEntryRepo: {
    findByDateRange: vi.fn(),
  },
  dailySummaryRepo: {
    upsert: vi.fn(),
    calculateAveragePoints: vi.fn(),
  },
}));

describe('ScoringService', () => {
  let scoringService: ScoringService;
  let mockDb: any;

  beforeEach(() => {
    scoringService = new ScoringService();
    mockDb = createMockDatabase();
    vi.clearAllMocks();
  });

  describe('calculateTaskScore', () => {
    it('should calculate base points correctly for different difficulties', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 0 };

      // TRIVIAL: 1 point at 100%
      const trivialTask = createMockTask({ difficulty: 'TRIVIAL', progress: 100, actualMinutes: 60 });
      const trivialScore = scoringService.calculateTaskScore(trivialTask, context);
      expect(trivialScore.basePoints).toBe(1);
      expect(trivialScore.totalPoints).toBe(1);

      // EASY: 2 points at 100%
      const easyTask = createMockTask({ difficulty: 'EASY', progress: 100, actualMinutes: 60 });
      const easyScore = scoringService.calculateTaskScore(easyTask, context);
      expect(easyScore.basePoints).toBe(2);
      expect(easyScore.totalPoints).toBe(2);

      // MEDIUM: 3 points at 100%
      const mediumTask = createMockTask({ difficulty: 'MEDIUM', progress: 100, actualMinutes: 60 });
      const mediumScore = scoringService.calculateTaskScore(mediumTask, context);
      expect(mediumScore.basePoints).toBe(3);
      expect(mediumScore.totalPoints).toBe(3);

      // HARD: 5 points at 100%
      const hardTask = createMockTask({ difficulty: 'HARD', progress: 100, actualMinutes: 60 });
      const hardScore = scoringService.calculateTaskScore(hardTask, context);
      expect(hardScore.basePoints).toBe(5);
      expect(hardScore.totalPoints).toBe(5);

      // EXTREME: 8 points at 100%
      const extremeTask = createMockTask({ difficulty: 'EXTREME', progress: 100, actualMinutes: 60 });
      const extremeScore = scoringService.calculateTaskScore(extremeTask, context);
      expect(extremeScore.basePoints).toBe(8);
      expect(extremeScore.totalPoints).toBe(8);
    });

    it('should scale points by progress percentage', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 0 };

      // 50% progress on HARD (5 points) = 2.5 points
      const task = createMockTask({ difficulty: 'HARD', progress: 50 });
      const score = scoringService.calculateTaskScore(task, context);
      expect(score.basePoints).toBe(2.5);
      expect(score.totalPoints).toBe(3); // Rounded
    });

    it('should award 20% efficiency bonus when completed under estimate', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 0 };

      const task = createMockCompletedTask({
        difficulty: 'MEDIUM',
        estimatedMinutes: 60,
        actualMinutes: 45, // Completed in 45 minutes vs 60 estimated
      });

      const score = scoringService.calculateTaskScore(task, context);

      expect(score.basePoints).toBe(3);
      expect(score.efficiencyBonus).toBe(0.6); // 20% of 3
      expect(score.totalPoints).toBe(4); // 3 + 0.6 rounded
    });

    it('should NOT award efficiency bonus when over estimate', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 0 };

      const task = createMockCompletedTask({
        difficulty: 'MEDIUM',
        estimatedMinutes: 60,
        actualMinutes: 90, // Took longer than estimated
      });

      const score = scoringService.calculateTaskScore(task, context);

      expect(score.efficiencyBonus).toBe(0);
    });

    it('should NOT award efficiency bonus for incomplete tasks', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 0 };

      const task = createMockTask({
        difficulty: 'MEDIUM',
        progress: 80, // Not complete
        estimatedMinutes: 60,
        actualMinutes: 40,
      });

      const score = scoringService.calculateTaskScore(task, context);

      expect(score.efficiencyBonus).toBe(0);
    });

    it('should award 10% focus bonus when worked on 3+ task types', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 3 };

      const task = createMockCompletedTask({ difficulty: 'MEDIUM' });
      const score = scoringService.calculateTaskScore(task, context);

      expect(score.basePoints).toBe(3);
      expect(score.focusBonus).toBe(0.3); // 10% of 3
      expect(score.totalPoints).toBe(3); // 3 + 0.3 rounded
    });

    it('should NOT award focus bonus when worked on less than 3 task types', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 2 };

      const task = createMockCompletedTask({ difficulty: 'MEDIUM' });
      const score = scoringService.calculateTaskScore(task, context);

      expect(score.focusBonus).toBe(0);
    });

    it('should combine all bonuses when applicable', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 3 };

      const task = createMockCompletedTask({
        difficulty: 'HARD', // 5 base points
        estimatedMinutes: 60,
        actualMinutes: 45,
      });

      const score = scoringService.calculateTaskScore(task, context);

      expect(score.basePoints).toBe(5);
      expect(score.efficiencyBonus).toBe(1); // 20% of 5
      expect(score.focusBonus).toBe(0.5); // 10% of 5
      expect(score.totalPoints).toBe(7); // 5 + 1 + 0.5 rounded
    });
  });

  describe('calculateEfficiency', () => {
    it('should return 1.0 when no estimate', () => {
      const task = createMockTask({ estimatedMinutes: null, actualMinutes: 45 });
      const efficiency = scoringService.calculateEfficiency(task);
      expect(efficiency).toBe(1.0);
    });

    it('should return 1.0 when no actual time', () => {
      const task = createMockTask({ estimatedMinutes: 60, actualMinutes: 0 });
      const efficiency = scoringService.calculateEfficiency(task);
      expect(efficiency).toBe(1.0);
    });

    it('should calculate efficiency correctly when under time', () => {
      const task = createMockTask({ estimatedMinutes: 60, actualMinutes: 45 });
      const efficiency = scoringService.calculateEfficiency(task);
      expect(efficiency).toBeCloseTo(1.33, 2); // 60/45 = 1.33
    });

    it('should calculate efficiency correctly when over time', () => {
      const task = createMockTask({ estimatedMinutes: 60, actualMinutes: 90 });
      const efficiency = scoringService.calculateEfficiency(task);
      expect(efficiency).toBeCloseTo(0.67, 2); // 60/90 = 0.67
    });
  });

  describe('getEfficiencyLabel', () => {
    it('should return correct labels for efficiency ranges', () => {
      expect(scoringService.getEfficiencyLabel(1.6)).toBe('Exceptional');
      expect(scoringService.getEfficiencyLabel(1.5)).toBe('Exceptional');
      expect(scoringService.getEfficiencyLabel(1.3)).toBe('Excellent');
      expect(scoringService.getEfficiencyLabel(1.2)).toBe('Excellent');
      expect(scoringService.getEfficiencyLabel(1.1)).toBe('Good');
      expect(scoringService.getEfficiencyLabel(1.0)).toBe('Good');
      expect(scoringService.getEfficiencyLabel(0.9)).toBe('Fair');
      expect(scoringService.getEfficiencyLabel(0.8)).toBe('Fair');
      expect(scoringService.getEfficiencyLabel(0.7)).toBe('Needs Improvement');
      expect(scoringService.getEfficiencyLabel(0.5)).toBe('Needs Improvement');
    });
  });

  describe('calculateDailyScore', () => {
    it('should sum scores from multiple completed tasks', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 0 };
      const tasks = [
        createMockCompletedTask({ difficulty: 'EASY' }), // 2 points
        createMockCompletedTask({ difficulty: 'MEDIUM' }), // 3 points
        createMockCompletedTask({ difficulty: 'HARD' }), // 5 points
      ];

      const totalScore = scoringService.calculateDailyScore(tasks, context);
      expect(totalScore).toBe(10); // 2 + 3 + 5
    });

    it('should return 0 for empty task list', () => {
      const context: ScoringContext = { taskTypesWorkedToday: 0 };
      const totalScore = scoringService.calculateDailyScore([], context);
      expect(totalScore).toBe(0);
    });
  });

  describe('calculateTrend', () => {
    it('should return 1.0 when average is 0', () => {
      const trend = scoringService.calculateTrend(10, 0);
      expect(trend).toBe(1.0);
    });

    it('should calculate trend correctly when above average', () => {
      const trend = scoringService.calculateTrend(15, 10);
      expect(trend).toBe(1.5); // 150% of average
    });

    it('should calculate trend correctly when below average', () => {
      const trend = scoringService.calculateTrend(5, 10);
      expect(trend).toBe(0.5); // 50% of average
    });

    it('should return 1.0 when equal to average', () => {
      const trend = scoringService.calculateTrend(10, 10);
      expect(trend).toBe(1.0);
    });
  });

  describe('getTrendLabel', () => {
    it('should return encouraging message when significantly above average', () => {
      const label = scoringService.getTrendLabel(1.3); // 30% above
      expect(label).toContain('30% above your average');
      expect(label).toContain('great focus today');
    });

    it('should return positive message when slightly above average', () => {
      const label = scoringService.getTrendLabel(1.1); // 10% above
      expect(label).toBe('10% above your average');
    });

    it('should return neutral message when on average', () => {
      const label = scoringService.getTrendLabel(1.0);
      expect(label).toBe('Right on your average');
    });

    it('should return supportive message when slightly below average', () => {
      const label = scoringService.getTrendLabel(0.9); // 10% below
      expect(label).toBe('10% below your average');
    });

    it('should return encouraging rest message when significantly below', () => {
      const label = scoringService.getTrendLabel(0.7); // 30% below
      expect(label).toContain('30% below your average');
      expect(label).toContain('take it easy');
    });
  });

  describe('DIFFICULTY_MULTIPLIERS', () => {
    it('should have correct multipliers for all difficulty levels', () => {
      expect(DIFFICULTY_MULTIPLIERS.TRIVIAL).toBe(1);
      expect(DIFFICULTY_MULTIPLIERS.EASY).toBe(2);
      expect(DIFFICULTY_MULTIPLIERS.MEDIUM).toBe(3);
      expect(DIFFICULTY_MULTIPLIERS.HARD).toBe(5);
      expect(DIFFICULTY_MULTIPLIERS.EXTREME).toBe(8);
    });
  });
});
