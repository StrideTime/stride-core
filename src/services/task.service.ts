/**
 * Task Service
 * Business logic for task management using repository pattern
 */

import type { StrideDatabase } from '@stridetime/db';
import { taskRepo, projectRepo } from '@stridetime/db';
import { Task, TaskDifficulty, TaskStatus } from '@stridetime/types';

/**
 * Parameters for creating a new task
 */
export interface CreateTaskParams {
  title: string;
  projectId: string;
  userId: string;
  difficulty?: TaskDifficulty;
  estimatedMinutes?: number;
  maxMinutes?: number;
  dueDate?: string;
  parentTaskId?: string | null;
  taskTypeId?: string | null;
  description?: string | null;
  plannedForDate?: string | null;
}

/**
 * Parameters for updating a task
 */
export interface UpdateTaskParams {
  title?: string;
  description?: string | null;
  progress?: number;
  status?: TaskStatus;
  estimatedMinutes?: number | null;
  maxMinutes?: number | null;
  plannedForDate?: string | null;
  dueDate?: string | null;
  taskTypeId?: string | null;
}

/**
 * Validation errors
 */
export class TaskValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

/**
 * Task Service for business logic
 */
export class TaskService {
  /**
   * Validate task creation parameters
   */
  validateCreateTask(params: CreateTaskParams): void {
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

    // Due date validation (if provided as ISO string)
    if (params.dueDate) {
      const dueDate = new Date(params.dueDate);
      if (dueDate < new Date()) {
        throw new TaskValidationError('dueDate', 'Due date cannot be in the past');
      }
    }

    // Description length validation
    if (params.description && params.description.length > 5000) {
      throw new TaskValidationError('description', 'Description must be under 5000 characters');
    }
  }

  /**
   * Validate task update parameters
   */
  validateUpdateTask(params: UpdateTaskParams): void {
    if (params.title !== undefined) {
      if (params.title.trim().length === 0) {
        throw new TaskValidationError('title', 'Task title cannot be empty');
      }
      if (params.title.length > 200) {
        throw new TaskValidationError('title', 'Task title must be under 200 characters');
      }
    }

    if (params.progress !== undefined) {
      if (params.progress < 0 || params.progress > 100) {
        throw new TaskValidationError('progress', 'Progress must be between 0 and 100');
      }
    }

    if (params.description !== undefined && params.description && params.description.length > 5000) {
      throw new TaskValidationError('description', 'Description must be under 5000 characters');
    }
  }

  /**
   * Create a new task
   */
  async create(db: StrideDatabase, params: CreateTaskParams): Promise<Task> {
    // Validate parameters
    this.validateCreateTask(params);

    // Verify project exists
    const project = await projectRepo.findById(db, params.projectId);
    if (!project) {
      throw new TaskValidationError('projectId', 'Project not found');
    }

    // Verify parent task exists if provided
    if (params.parentTaskId) {
      const parentTask = await taskRepo.findById(db, params.parentTaskId);
      if (!parentTask) {
        throw new TaskValidationError('parentTaskId', 'Parent task not found');
      }
    }

    // Create task
    const task = await taskRepo.create(db, {
      userId: params.userId,
      projectId: params.projectId,
      parentTaskId: params.parentTaskId || null,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      difficulty: params.difficulty || TaskDifficulty.MEDIUM,
      progress: 0,
      status: TaskStatus.BACKLOG,
      estimatedMinutes: params.estimatedMinutes || null,
      maxMinutes: params.maxMinutes || null,
      actualMinutes: 0,
      plannedForDate: params.plannedForDate || null,
      dueDate: params.dueDate || null,
      taskTypeId: params.taskTypeId || null,
      completedAt: null,
    });

    return task;
  }

  /**
   * Update a task
   */
  async update(db: StrideDatabase, taskId: string, params: UpdateTaskParams): Promise<Task> {
    // Validate parameters
    this.validateUpdateTask(params);

    // Check if task exists
    const existingTask = await taskRepo.findById(db, taskId);
    if (!existingTask) {
      throw new TaskValidationError('taskId', 'Task not found');
    }

    // Prepare updates
    const updates: Partial<Task> = {};

    if (params.title !== undefined) {
      updates.title = params.title.trim();
    }

    if (params.description !== undefined) {
      updates.description = params.description?.trim() || null;
    }

    if (params.progress !== undefined) {
      updates.progress = params.progress;

      // Auto-update status based on progress
      if (params.progress === 100 && params.status === undefined) {
        updates.status = TaskStatus.COMPLETED;
        updates.completedAt = new Date().toISOString();
      }
    }

    if (params.status !== undefined) {
      updates.status = params.status;

      if (params.status === TaskStatus.COMPLETED) {
        updates.completedAt = new Date().toISOString();
        if (params.progress === undefined) {
          updates.progress = 100;
        }
      }
    }

    if (params.estimatedMinutes !== undefined) {
      updates.estimatedMinutes = params.estimatedMinutes;
    }

    if (params.maxMinutes !== undefined) {
      updates.maxMinutes = params.maxMinutes;
    }

    if (params.plannedForDate !== undefined) {
      updates.plannedForDate = params.plannedForDate;
    }

    if (params.dueDate !== undefined) {
      updates.dueDate = params.dueDate;
    }

    if (params.taskTypeId !== undefined) {
      updates.taskTypeId = params.taskTypeId;
    }

    // Update task
    const updatedTask = await taskRepo.update(db, taskId, updates);

    // If this is a sub-task, update parent progress
    if (updatedTask.parentTaskId) {
      await this.updateParentProgress(db, updatedTask.parentTaskId);
    }

    return updatedTask;
  }

  /**
   * Update task progress and recalculate parent progress if needed
   */
  async updateProgress(db: StrideDatabase, taskId: string, progress: number): Promise<Task> {
    return this.update(db, taskId, { progress });
  }

  /**
   * Calculate and update parent task progress based on sub-tasks
   */
  async updateParentProgress(db: StrideDatabase, parentTaskId: string): Promise<void> {
    // Get all sub-tasks
    const subTasks = await taskRepo.findByParentId(db, parentTaskId);

    if (subTasks.length === 0) {
      return;
    }

    // Calculate average progress
    const totalProgress = subTasks.reduce((sum, task) => sum + task.progress, 0);
    const averageProgress = Math.round(totalProgress / subTasks.length);

    // Update parent task
    await this.update(db, parentTaskId, { progress: averageProgress });
  }

  /**
   * Delete a task (soft delete)
   */
  async delete(db: StrideDatabase, taskId: string): Promise<void> {
    const task = await taskRepo.findById(db, taskId);
    if (!task) {
      throw new TaskValidationError('taskId', 'Task not found');
    }

    await taskRepo.delete(db, taskId);

    // Update parent progress if this was a sub-task
    if (task.parentTaskId) {
      await this.updateParentProgress(db, task.parentTaskId);
    }
  }

  /**
   * Get task by ID
   */
  async findById(db: StrideDatabase, taskId: string): Promise<Task | null> {
    return taskRepo.findById(db, taskId);
  }

  /**
   * Get all tasks for a project
   */
  async findByProject(db: StrideDatabase, projectId: string): Promise<Task[]> {
    return taskRepo.findByProjectId(db, projectId);
  }

  /**
   * Get all tasks for a user
   */
  async findByUser(db: StrideDatabase, userId: string): Promise<Task[]> {
    return taskRepo.findByUserId(db, userId);
  }

  /**
   * Get tasks planned for a specific date
   */
  async findByPlannedDate(db: StrideDatabase, userId: string, date: string): Promise<Task[]> {
    return taskRepo.findByPlannedDate(db, userId, date);
  }

  /**
   * Get tasks by status
   */
  async findByStatus(db: StrideDatabase, userId: string, status: TaskStatus): Promise<Task[]> {
    return taskRepo.findByStatus(db, userId, status);
  }

  /**
   * Get completed tasks
   */
  async findCompleted(db: StrideDatabase, userId: string): Promise<Task[]> {
    return taskRepo.findCompleted(db, userId);
  }

  /**
   * Get sub-tasks for a parent task
   */
  async findSubTasks(db: StrideDatabase, parentTaskId: string): Promise<Task[]> {
    return taskRepo.findByParentId(db, parentTaskId);
  }
}

/**
 * Singleton instance for convenient access
 */
export const taskService = new TaskService();
