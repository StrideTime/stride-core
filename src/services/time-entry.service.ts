/**
 * TimeEntry Service
 * Business logic for time tracking using repository pattern
 */

import type { StrideDatabase } from '@stridetime/db';
import { timeEntryRepo, taskRepo } from '@stridetime/db';
import type { TimeEntry } from '@stridetime/types';

/**
 * Parameters for starting a time entry
 */
export interface StartTimeEntryParams {
  taskId: string;
  userId: string;
  startedAt?: string;
}

/**
 * TimeEntry Service for business logic
 */
export class TimeEntryService {
  /**
   * Start a new time entry (start timer)
   */
  async start(db: StrideDatabase, params: StartTimeEntryParams): Promise<TimeEntry> {
    // Check if user already has an active timer
    const activeEntry = await timeEntryRepo.findActive(db, params.userId);
    if (activeEntry) {
      throw new Error('User already has an active time entry. Stop the current timer first.');
    }

    // Verify task exists
    const task = await taskRepo.findById(db, params.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Create time entry
    const entry = await timeEntryRepo.create(db, {
      taskId: params.taskId,
      userId: params.userId,
      startedAt: params.startedAt || new Date().toISOString(),
      endedAt: null,
    });

    return entry;
  }

  /**
   * Stop a time entry (end timer)
   */
  async stop(db: StrideDatabase, entryId: string, endedAt?: string): Promise<TimeEntry> {
    const entry = await timeEntryRepo.findById(db, entryId);
    if (!entry) {
      throw new Error('Time entry not found');
    }

    if (entry.endedAt) {
      throw new Error('Time entry is already stopped');
    }

    const stopped = await timeEntryRepo.stop(db, entryId, endedAt || new Date().toISOString());

    // Update task actual minutes
    const totalMinutes = await timeEntryRepo.calculateTotalMinutes(db, entry.taskId);
    await taskRepo.update(db, entry.taskId, { actualMinutes: totalMinutes });

    return stopped;
  }

  /**
   * Stop the active time entry for a user
   */
  async stopActive(db: StrideDatabase, userId: string, endedAt?: string): Promise<TimeEntry | null> {
    const activeEntry = await timeEntryRepo.findActive(db, userId);
    if (!activeEntry) {
      return null;
    }

    return this.stop(db, activeEntry.id, endedAt);
  }

  /**
   * Get active time entry for a user
   */
  async findActive(db: StrideDatabase, userId: string): Promise<TimeEntry | null> {
    return timeEntryRepo.findActive(db, userId);
  }

  /**
   * Get time entry by ID
   */
  async findById(db: StrideDatabase, entryId: string): Promise<TimeEntry | null> {
    return timeEntryRepo.findById(db, entryId);
  }

  /**
   * Get all time entries for a task
   */
  async findByTask(db: StrideDatabase, taskId: string): Promise<TimeEntry[]> {
    return timeEntryRepo.findByTaskId(db, taskId);
  }

  /**
   * Get all time entries for a user
   */
  async findByUser(db: StrideDatabase, userId: string): Promise<TimeEntry[]> {
    return timeEntryRepo.findByUserId(db, userId);
  }

  /**
   * Get time entries within a date range
   */
  async findByDateRange(
    db: StrideDatabase,
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeEntry[]> {
    return timeEntryRepo.findByDateRange(db, userId, startDate, endDate);
  }

  /**
   * Calculate total minutes tracked for a task
   */
  async calculateTotalMinutes(db: StrideDatabase, taskId: string): Promise<number> {
    return timeEntryRepo.calculateTotalMinutes(db, taskId);
  }

  /**
   * Delete a time entry
   */
  async delete(db: StrideDatabase, entryId: string): Promise<void> {
    const entry = await timeEntryRepo.findById(db, entryId);
    if (!entry) {
      throw new Error('Time entry not found');
    }

    await timeEntryRepo.delete(db, entryId);

    // Recalculate task actual minutes
    const totalMinutes = await timeEntryRepo.calculateTotalMinutes(db, entry.taskId);
    await taskRepo.update(db, entry.taskId, { actualMinutes: totalMinutes });
  }
}

/**
 * Singleton instance for convenient access
 */
export const timeEntryService = new TimeEntryService();
