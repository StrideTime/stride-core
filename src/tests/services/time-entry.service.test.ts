/**
 * Unit tests for TimeEntryService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeEntryService } from '../../services/time-entry.service';
import type { StartTimeEntryParams } from '../../services/time-entry.service';
import {
  createMockTimeEntry,
  createMockActiveTimeEntry,
  createMockCompletedTimeEntry,
  createMockTask,
  createMockDatabase,
} from '@stridetime/test-utils';

// Create hoisted mocks
const { mockTimeEntryRepo, mockTaskRepo } = vi.hoisted(() => {
  const timeEntryRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findActive: vi.fn(),
    findByTaskId: vi.fn(),
    findByUserId: vi.fn(),
    findByDateRange: vi.fn(),
    stop: vi.fn(),
    delete: vi.fn(),
    calculateTotalMinutes: vi.fn(),
  };

  const taskRepo = {
    findById: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findByProjectId: vi.fn(),
    findByUserId: vi.fn(),
    findByStatus: vi.fn(),
    findCompleted: vi.fn(),
    findByPlannedDate: vi.fn(),
    findByParentId: vi.fn(),
  };

  return { mockTimeEntryRepo: timeEntryRepo, mockTaskRepo: taskRepo };
});

// Mock the module using hoisted variables
vi.mock('@stridetime/db', () => ({
  timeEntryRepo: mockTimeEntryRepo,
  taskRepo: mockTaskRepo,
  TimeEntryRepository: vi.fn(),
  TaskRepository: vi.fn(),
}));

describe('TimeEntryService', () => {
  let timeEntryService: TimeEntryService;
  let mockDb: any;

  beforeEach(() => {
    timeEntryService = new TimeEntryService(mockTimeEntryRepo, mockTaskRepo);
    mockDb = createMockDatabase();
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should start a new time entry', async () => {
      const params: StartTimeEntryParams = {
        taskId: 'task-123',
        userId: 'user-123',
      };

      const mockTask = createMockTask({ id: 'task-123' });
      const mockEntry = createMockActiveTimeEntry({ taskId: 'task-123', userId: 'user-123' });

      mockTimeEntryRepo.findActive.mockResolvedValue(null);
      mockTaskRepo.findById.mockResolvedValue(mockTask);
      mockTimeEntryRepo.create.mockResolvedValue(mockEntry);

      const result = await timeEntryService.start(mockDb, params);

      expect(mockTimeEntryRepo.findActive).toHaveBeenCalledWith(mockDb, 'user-123');
      expect(mockTaskRepo.findById).toHaveBeenCalledWith(mockDb, 'task-123');
      expect(mockTimeEntryRepo.create).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          taskId: 'task-123',
          userId: 'user-123',
          endedAt: null,
        })
      );
      expect(result).toEqual(mockEntry);
    });

    it('should use custom startedAt when provided', async () => {
      const customTime = '2026-02-03T10:00:00.000Z';
      const params: StartTimeEntryParams = {
        taskId: 'task-123',
        userId: 'user-123',
        startedAt: customTime,
      };

      mockTimeEntryRepo.findActive.mockResolvedValue(null);
      mockTaskRepo.findById.mockResolvedValue(createMockTask());
      mockTimeEntryRepo.create.mockResolvedValue(createMockTimeEntry());

      await timeEntryService.start(mockDb, params);

      expect(mockTimeEntryRepo.create).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          startedAt: customTime,
        })
      );
    });

    it('should throw error when user already has active time entry', async () => {
      const params: StartTimeEntryParams = {
        taskId: 'task-123',
        userId: 'user-123',
      };

      const activeEntry = createMockActiveTimeEntry({ userId: 'user-123' });
      mockTimeEntryRepo.findActive.mockResolvedValue(activeEntry);

      await expect(timeEntryService.start(mockDb, params)).rejects.toThrow(
        'User already has an active time entry'
      );
    });

    it('should throw error when task does not exist', async () => {
      const params: StartTimeEntryParams = {
        taskId: 'nonexistent-task',
        userId: 'user-123',
      };

      mockTimeEntryRepo.findActive.mockResolvedValue(null);
      mockTaskRepo.findById.mockResolvedValue(null);

      await expect(timeEntryService.start(mockDb, params)).rejects.toThrow('Task not found');
    });
  });

  describe('stop', () => {
    it('should stop a time entry', async () => {
      const activeEntry = createMockActiveTimeEntry({ id: 'entry-123', taskId: 'task-123' });
      const stoppedEntry = createMockCompletedTimeEntry(60, { id: 'entry-123', taskId: 'task-123' });

      mockTimeEntryRepo.findById.mockResolvedValue(activeEntry);
      mockTimeEntryRepo.stop.mockResolvedValue(stoppedEntry);
      mockTimeEntryRepo.calculateTotalMinutes.mockResolvedValue(60);
      mockTaskRepo.update.mockResolvedValue(createMockTask());

      const result = await timeEntryService.stop(mockDb, 'entry-123');

      expect(mockTimeEntryRepo.findById).toHaveBeenCalledWith(mockDb, 'entry-123');
      expect(mockTimeEntryRepo.stop).toHaveBeenCalledWith(mockDb, 'entry-123', expect.any(String));
      expect(mockTimeEntryRepo.calculateTotalMinutes).toHaveBeenCalledWith(mockDb, 'task-123');
      expect(mockTaskRepo.update).toHaveBeenCalledWith(mockDb, 'task-123', { actualMinutes: 60 });
      expect(result).toEqual(stoppedEntry);
    });

    it('should use custom endedAt when provided', async () => {
      const customTime = '2026-02-03T11:00:00.000Z';
      const activeEntry = createMockActiveTimeEntry();

      mockTimeEntryRepo.findById.mockResolvedValue(activeEntry);
      mockTimeEntryRepo.stop.mockResolvedValue(createMockCompletedTimeEntry());
      mockTimeEntryRepo.calculateTotalMinutes.mockResolvedValue(60);
      mockTaskRepo.update.mockResolvedValue(createMockTask());

      await timeEntryService.stop(mockDb, 'entry-123', customTime);

      expect(mockTimeEntryRepo.stop).toHaveBeenCalledWith(mockDb, 'entry-123', customTime);
    });

    it('should throw error when time entry not found', async () => {
      mockTimeEntryRepo.findById.mockResolvedValue(null);

      await expect(timeEntryService.stop(mockDb, 'nonexistent')).rejects.toThrow(
        'Time entry not found'
      );
    });

    it('should throw error when time entry is already stopped', async () => {
      const stoppedEntry = createMockCompletedTimeEntry();
      mockTimeEntryRepo.findById.mockResolvedValue(stoppedEntry);

      await expect(timeEntryService.stop(mockDb, 'entry-123')).rejects.toThrow(
        'Time entry is already stopped'
      );
    });
  });

  describe('stopActive', () => {
    it('should stop the active time entry for a user', async () => {
      const activeEntry = createMockActiveTimeEntry({ id: 'entry-123', userId: 'user-123', taskId: 'task-123' });
      const stoppedEntry = createMockCompletedTimeEntry(60, { id: 'entry-123' });

      mockTimeEntryRepo.findActive.mockResolvedValue(activeEntry);
      mockTimeEntryRepo.findById.mockResolvedValue(activeEntry);
      mockTimeEntryRepo.stop.mockResolvedValue(stoppedEntry);
      mockTimeEntryRepo.calculateTotalMinutes.mockResolvedValue(60);
      mockTaskRepo.update.mockResolvedValue(createMockTask());

      const result = await timeEntryService.stopActive(mockDb, 'user-123');

      expect(mockTimeEntryRepo.findActive).toHaveBeenCalledWith(mockDb, 'user-123');
      expect(mockTimeEntryRepo.stop).toHaveBeenCalled();
      expect(result).toEqual(stoppedEntry);
    });

    it('should return null when user has no active time entry', async () => {
      mockTimeEntryRepo.findActive.mockResolvedValue(null);

      const result = await timeEntryService.stopActive(mockDb, 'user-123');

      expect(result).toBeNull();
      expect(mockTimeEntryRepo.stop).not.toHaveBeenCalled();
    });

    it('should use custom endedAt when provided', async () => {
      const customTime = '2026-02-03T12:00:00.000Z';
      const activeEntry = createMockActiveTimeEntry({ taskId: 'task-123' });

      mockTimeEntryRepo.findActive.mockResolvedValue(activeEntry);
      mockTimeEntryRepo.findById.mockResolvedValue(activeEntry);
      mockTimeEntryRepo.stop.mockResolvedValue(createMockCompletedTimeEntry());
      mockTimeEntryRepo.calculateTotalMinutes.mockResolvedValue(60);
      mockTaskRepo.update.mockResolvedValue(createMockTask());

      await timeEntryService.stopActive(mockDb, 'user-123', customTime);

      expect(mockTimeEntryRepo.stop).toHaveBeenCalledWith(mockDb, activeEntry.id, customTime);
    });
  });

  describe('findActive', () => {
    it('should return active time entry for user', async () => {
      const activeEntry = createMockActiveTimeEntry({ userId: 'user-123' });
      mockTimeEntryRepo.findActive.mockResolvedValue(activeEntry);

      const result = await timeEntryService.findActive(mockDb, 'user-123');

      expect(mockTimeEntryRepo.findActive).toHaveBeenCalledWith(mockDb, 'user-123');
      expect(result).toEqual(activeEntry);
    });

    it('should return null when no active entry', async () => {
      mockTimeEntryRepo.findActive.mockResolvedValue(null);

      const result = await timeEntryService.findActive(mockDb, 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return time entry by ID', async () => {
      const entry = createMockTimeEntry({ id: 'entry-123' });
      mockTimeEntryRepo.findById.mockResolvedValue(entry);

      const result = await timeEntryService.findById(mockDb, 'entry-123');

      expect(mockTimeEntryRepo.findById).toHaveBeenCalledWith(mockDb, 'entry-123');
      expect(result).toEqual(entry);
    });

    it('should return null when entry not found', async () => {
      mockTimeEntryRepo.findById.mockResolvedValue(null);

      const result = await timeEntryService.findById(mockDb, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByTask', () => {
    it('should return all time entries for a task', async () => {
      const entries = [
        createMockTimeEntry({ taskId: 'task-123' }),
        createMockCompletedTimeEntry(60, { taskId: 'task-123' }),
      ];
      mockTimeEntryRepo.findByTaskId.mockResolvedValue(entries);

      const result = await timeEntryService.findByTask(mockDb, 'task-123');

      expect(mockTimeEntryRepo.findByTaskId).toHaveBeenCalledWith(mockDb, 'task-123');
      expect(result).toEqual(entries);
    });
  });

  describe('findByUser', () => {
    it('should return all time entries for a user', async () => {
      const entries = [
        createMockTimeEntry({ userId: 'user-123' }),
        createMockCompletedTimeEntry(60, { userId: 'user-123' }),
      ];
      mockTimeEntryRepo.findByUserId.mockResolvedValue(entries);

      const result = await timeEntryService.findByUser(mockDb, 'user-123');

      expect(mockTimeEntryRepo.findByUserId).toHaveBeenCalledWith(mockDb, 'user-123');
      expect(result).toEqual(entries);
    });
  });

  describe('findByDateRange', () => {
    it('should return time entries within date range', async () => {
      const startDate = '2026-02-01';
      const endDate = '2026-02-28';
      const entries = [
        createMockTimeEntry({ userId: 'user-123' }),
        createMockCompletedTimeEntry(60, { userId: 'user-123' }),
      ];
      mockTimeEntryRepo.findByDateRange.mockResolvedValue(entries);

      const result = await timeEntryService.findByDateRange(mockDb, 'user-123', startDate, endDate);

      expect(mockTimeEntryRepo.findByDateRange).toHaveBeenCalledWith(
        mockDb,
        'user-123',
        startDate,
        endDate
      );
      expect(result).toEqual(entries);
    });
  });

  describe('calculateTotalMinutes', () => {
    it('should calculate total minutes for a task', async () => {
      mockTimeEntryRepo.calculateTotalMinutes.mockResolvedValue(180);

      const result = await timeEntryService.calculateTotalMinutes(mockDb, 'task-123');

      expect(mockTimeEntryRepo.calculateTotalMinutes).toHaveBeenCalledWith(mockDb, 'task-123');
      expect(result).toBe(180);
    });
  });

  describe('delete', () => {
    it('should delete a time entry and recalculate task minutes', async () => {
      const entry = createMockTimeEntry({ id: 'entry-123', taskId: 'task-123' });

      mockTimeEntryRepo.findById.mockResolvedValue(entry);
      mockTimeEntryRepo.delete.mockResolvedValue(undefined);
      mockTimeEntryRepo.calculateTotalMinutes.mockResolvedValue(120);
      mockTaskRepo.update.mockResolvedValue(createMockTask());

      await timeEntryService.delete(mockDb, 'entry-123');

      expect(mockTimeEntryRepo.findById).toHaveBeenCalledWith(mockDb, 'entry-123');
      expect(mockTimeEntryRepo.delete).toHaveBeenCalledWith(mockDb, 'entry-123');
      expect(mockTimeEntryRepo.calculateTotalMinutes).toHaveBeenCalledWith(mockDb, 'task-123');
      expect(mockTaskRepo.update).toHaveBeenCalledWith(mockDb, 'task-123', { actualMinutes: 120 });
    });

    it('should throw error when time entry not found', async () => {
      mockTimeEntryRepo.findById.mockResolvedValue(null);

      await expect(timeEntryService.delete(mockDb, 'nonexistent')).rejects.toThrow(
        'Time entry not found'
      );
    });
  });
});
