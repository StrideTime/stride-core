/**
 * Unit tests for TaskService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService, TaskValidationError } from '../../services/task.service';
import type { CreateTaskParams, UpdateTaskParams } from '../../services/task.service';
import { createMockTask, createMockProject, createMockDatabase } from '@stridetime/test-utils';
import { TaskDifficulty, TaskStatus } from '@stridetime/types';

// Create hoisted mocks
const { mockTaskRepo, mockProjectRepo } = vi.hoisted(() => {
  const taskRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByProjectId: vi.fn(),
    findByUserId: vi.fn(),
    findByStatus: vi.fn(),
    findCompleted: vi.fn(),
    findByPlannedDate: vi.fn(),
    findByParentId: vi.fn(),
    findSubtasks: vi.fn(),
    findRootTasks: vi.fn(),
    count: vi.fn(),
    countByProject: vi.fn(),
  };

  const projectRepo = {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByWorkspaceId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    countByWorkspace: vi.fn(),
  };

  return { mockTaskRepo: taskRepo, mockProjectRepo: projectRepo };
});

// Mock the module using hoisted variables
vi.mock('@stridetime/db', () => ({
  taskRepo: mockTaskRepo,
  projectRepo: mockProjectRepo,
  TaskRepository: vi.fn(),
  ProjectRepository: vi.fn(),
  initDatabase: vi.fn(),
  getDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  isDatabaseInitialized: vi.fn(),
  getPowerSyncDatabase: vi.fn(),
  getConnector: vi.fn(),
  connectSync: vi.fn(),
  disconnectSync: vi.fn(),
  isSyncEnabled: vi.fn(),
  getSyncStatus: vi.fn(),
  onSyncStatusChange: vi.fn(),
  SupabaseConnector: vi.fn(),
  SupabaseAuthProvider: vi.fn(),
  WorkspaceRepository: vi.fn(),
  workspaceRepo: vi.fn(),
  TimeEntryRepository: vi.fn(),
  timeEntryRepo: vi.fn(),
  UserRepository: vi.fn(),
  userRepo: vi.fn(),
  TaskTypeRepository: vi.fn(),
  taskTypeRepo: vi.fn(),
  DailySummaryRepository: vi.fn(),
  dailySummaryRepo: vi.fn(),
  generateId: vi.fn(),
  now: vi.fn(),
  today: vi.fn(),
}));

describe('TaskService', () => {
  let taskService: TaskService;
  let mockDb: any;

  beforeEach(() => {
    // Create TaskService with injected mock repositories
    taskService = new TaskService(mockTaskRepo, mockProjectRepo);
    mockDb = createMockDatabase();
    vi.clearAllMocks();
  });

  describe('validateCreateTask', () => {
    it('should pass validation with valid parameters', () => {
      const params: CreateTaskParams = {
        title: 'Valid Task',
        projectId: 'project-123',
        userId: 'user-123',
      };

      expect(() => taskService.validateCreateTask(params)).not.toThrow();
    });

    it('should throw error when title is empty', () => {
      const params: CreateTaskParams = {
        title: '',
        projectId: 'project-123',
        userId: 'user-123',
      };

      expect(() => taskService.validateCreateTask(params)).toThrow(TaskValidationError);
      expect(() => taskService.validateCreateTask(params)).toThrow('Task title is required');
    });

    it('should throw error when title is only whitespace', () => {
      const params: CreateTaskParams = {
        title: '   ',
        projectId: 'project-123',
        userId: 'user-123',
      };

      expect(() => taskService.validateCreateTask(params)).toThrow('Task title is required');
    });

    it('should throw error when title exceeds 200 characters', () => {
      const params: CreateTaskParams = {
        title: 'a'.repeat(201),
        projectId: 'project-123',
        userId: 'user-123',
      };

      expect(() => taskService.validateCreateTask(params)).toThrow(
        'Task title must be under 200 characters'
      );
    });

    it('should throw error when projectId is missing', () => {
      const params: CreateTaskParams = {
        title: 'Valid Task',
        projectId: '',
        userId: 'user-123',
      };

      expect(() => taskService.validateCreateTask(params)).toThrow('Task must belong to a project');
    });

    it('should throw error when estimatedMinutes is negative', () => {
      const params: CreateTaskParams = {
        title: 'Valid Task',
        projectId: 'project-123',
        userId: 'user-123',
        estimatedMinutes: -10,
      };

      expect(() => taskService.validateCreateTask(params)).toThrow(
        'Estimated time cannot be negative'
      );
    });

    it('should throw error when maxMinutes is negative', () => {
      const params: CreateTaskParams = {
        title: 'Valid Task',
        projectId: 'project-123',
        userId: 'user-123',
        maxMinutes: -10,
      };

      expect(() => taskService.validateCreateTask(params)).toThrow('Max time cannot be negative');
    });

    it('should throw error when estimatedMinutes exceeds maxMinutes', () => {
      const params: CreateTaskParams = {
        title: 'Valid Task',
        projectId: 'project-123',
        userId: 'user-123',
        estimatedMinutes: 120,
        maxMinutes: 60,
      };

      expect(() => taskService.validateCreateTask(params)).toThrow(
        'Estimated time cannot exceed max time'
      );
    });

    it('should throw error when description exceeds 5000 characters', () => {
      const params: CreateTaskParams = {
        title: 'Valid Task',
        projectId: 'project-123',
        userId: 'user-123',
        description: 'a'.repeat(5001),
      };

      expect(() => taskService.validateCreateTask(params)).toThrow(
        'Description must be under 5000 characters'
      );
    });
  });

  describe('validateUpdateTask', () => {
    it('should pass validation with valid parameters', () => {
      const params: UpdateTaskParams = {
        title: 'Updated Task',
        progress: 50,
      };

      expect(() => taskService.validateUpdateTask(params)).not.toThrow();
    });

    it('should throw error when title is empty string', () => {
      const params: UpdateTaskParams = {
        title: '   ',
      };

      expect(() => taskService.validateUpdateTask(params)).toThrow('Task title cannot be empty');
    });

    it('should throw error when progress is less than 0', () => {
      const params: UpdateTaskParams = {
        progress: -1,
      };

      expect(() => taskService.validateUpdateTask(params)).toThrow(
        'Progress must be between 0 and 100'
      );
    });

    it('should throw error when progress exceeds 100', () => {
      const params: UpdateTaskParams = {
        progress: 101,
      };

      expect(() => taskService.validateUpdateTask(params)).toThrow(
        'Progress must be between 0 and 100'
      );
    });

    it('should allow progress at boundaries (0 and 100)', () => {
      expect(() => taskService.validateUpdateTask({ progress: 0 })).not.toThrow();
      expect(() => taskService.validateUpdateTask({ progress: 100 })).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create a task with valid parameters', async () => {
      const params: CreateTaskParams = {
        title: 'New Task',
        projectId: 'project-123',
        userId: 'user-123',
        difficulty: TaskDifficulty.HARD,
        estimatedMinutes: 60,
      };

      const mockProject = createMockProject({ id: 'project-123' });
      const mockTask = createMockTask({
        id: 'task-456',
        title: 'New Task',
        difficulty: TaskDifficulty.HARD,
      });

      // Set up the mocks
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTaskRepo.create.mockResolvedValue(mockTask);

      const result = await taskService.create(mockDb, params);

      expect(mockProjectRepo.findById).toHaveBeenCalledWith(mockDb, 'project-123');
      expect(mockTaskRepo.create).toHaveBeenCalled();
      expect(result).toEqual(mockTask);
    });

    it('should throw error when project does not exist', async () => {
      const params: CreateTaskParams = {
        title: 'New Task',
        projectId: 'nonexistent-project',
        userId: 'user-123',
      };

      mockProjectRepo.findById.mockResolvedValue(null);

      await expect(taskService.create(mockDb, params)).rejects.toThrow('Project not found');
    });

    it('should throw error when parent task does not exist', async () => {
      const params: CreateTaskParams = {
        title: 'Sub Task',
        projectId: 'project-123',
        userId: 'user-123',
        parentTaskId: 'nonexistent-parent',
      };

      const mockProject = createMockProject({ id: 'project-123' });
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTaskRepo.findById.mockResolvedValue(null);

      await expect(taskService.create(mockDb, params)).rejects.toThrow('Parent task not found');
    });

    it('should trim title and description when creating', async () => {
      const params: CreateTaskParams = {
        title: '  Task with spaces  ',
        projectId: 'project-123',
        userId: 'user-123',
        description: '  Description with spaces  ',
      };

      const mockProject = createMockProject({ id: 'project-123' });
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTaskRepo.create.mockResolvedValue(createMockTask());

      await taskService.create(mockDb, params);

      expect(mockTaskRepo.create).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          title: 'Task with spaces',
          description: 'Description with spaces',
        })
      );
    });

    it('should set default values for optional fields', async () => {
      const params: CreateTaskParams = {
        title: 'Minimal Task',
        projectId: 'project-123',
        userId: 'user-123',
      };

      const mockProject = createMockProject({ id: 'project-123' });
      mockProjectRepo.findById.mockResolvedValue(mockProject);
      mockTaskRepo.create.mockResolvedValue(createMockTask());

      await taskService.create(mockDb, params);

      expect(mockTaskRepo.create).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          difficulty: TaskDifficulty.MEDIUM,
          progress: 0,
          status: TaskStatus.BACKLOG,
          actualMinutes: 0,
        })
      );
    });
  });

  describe('update', () => {
    it('should update a task with valid parameters', async () => {
      const mockTask = createMockTask({ id: 'task-123' });
      const updatedTask = createMockTask({ id: 'task-123', title: 'Updated Task' });

      mockTaskRepo.findById.mockResolvedValue(mockTask);
      mockTaskRepo.update.mockResolvedValue(updatedTask);

      const result = await taskService.update(mockDb, 'task-123', { title: 'Updated Task' });

      expect(mockTaskRepo.update).toHaveBeenCalledWith(
        mockDb,
        'task-123',
        expect.objectContaining({ title: 'Updated Task' })
      );
      expect(result).toEqual(updatedTask);
    });

    it('should throw error when task does not exist', async () => {
      mockTaskRepo.findById.mockResolvedValue(null);

      await expect(taskService.update(mockDb, 'nonexistent', { title: 'Updated' })).rejects.toThrow(
        'Task not found'
      );
    });

    it('should auto-complete task when progress is set to 100', async () => {
      const mockTask = createMockTask({ id: 'task-123', progress: 50 });
      const completedTask = createMockTask({
        id: 'task-123',
        progress: 100,
        status: TaskStatus.COMPLETED,
      });

      mockTaskRepo.findById.mockResolvedValue(mockTask);
      mockTaskRepo.update.mockResolvedValue(completedTask);

      await taskService.update(mockDb, 'task-123', { progress: 100 });

      expect(mockTaskRepo.update).toHaveBeenCalledWith(
        mockDb,
        'task-123',
        expect.objectContaining({
          progress: 100,
          status: TaskStatus.COMPLETED,
          completedAt: expect.any(String),
        })
      );
    });

    it('should set progress to 100 when status is set to COMPLETED', async () => {
      const mockTask = createMockTask({ id: 'task-123', progress: 50 });
      const completedTask = createMockTask({
        id: 'task-123',
        progress: 100,
        status: TaskStatus.COMPLETED,
      });

      mockTaskRepo.findById.mockResolvedValue(mockTask);
      mockTaskRepo.update.mockResolvedValue(completedTask);

      await taskService.update(mockDb, 'task-123', { status: TaskStatus.COMPLETED });

      expect(mockTaskRepo.update).toHaveBeenCalledWith(
        mockDb,
        'task-123',
        expect.objectContaining({
          status: TaskStatus.COMPLETED,
          progress: 100,
          completedAt: expect.any(String),
        })
      );
    });

    it('should update parent progress when updating a sub-task', async () => {
      const mockSubTask = createMockTask({ id: 'sub-task', parentTaskId: 'parent-task' });
      const updatedSubTask = createMockTask({
        id: 'sub-task',
        parentTaskId: 'parent-task',
        progress: 80,
      });

      mockTaskRepo.findById.mockResolvedValue(mockSubTask);
      mockTaskRepo.update.mockResolvedValue(updatedSubTask);

      // Mock updateParentProgress to avoid circular calls
      const updateParentSpy = vi
        .spyOn(taskService, 'updateParentProgress')
        .mockResolvedValue(undefined);

      await taskService.update(mockDb, 'sub-task', { progress: 80 });

      expect(updateParentSpy).toHaveBeenCalledWith(mockDb, 'parent-task');

      // Restore the original method
      updateParentSpy.mockRestore();
    });
  });

  describe('updateParentProgress', () => {
    it('should calculate and update parent progress based on sub-tasks', async () => {
      const subTasks = [
        createMockTask({ progress: 50 }),
        createMockTask({ progress: 100 }),
        createMockTask({ progress: 0 }),
      ];

      mockTaskRepo.findByParentId.mockResolvedValue(subTasks);
      mockTaskRepo.findById.mockResolvedValue(createMockTask({ id: 'parent-task' }));
      mockTaskRepo.update.mockResolvedValue(createMockTask({ progress: 50 }));

      await taskService.updateParentProgress(mockDb, 'parent-task');

      // Average: (50 + 100 + 0) / 3 = 50
      expect(mockTaskRepo.update).toHaveBeenCalledWith(mockDb, 'parent-task', { progress: 50 });
    });

    it('should do nothing when parent has no sub-tasks', async () => {
      mockTaskRepo.findByParentId.mockResolvedValue([]);

      await taskService.updateParentProgress(mockDb, 'parent-task');

      expect(mockTaskRepo.update).not.toHaveBeenCalled();
    });

    it('should round average progress to nearest integer', async () => {
      const subTasks = [
        createMockTask({ progress: 33 }),
        createMockTask({ progress: 33 }),
        createMockTask({ progress: 34 }),
      ];

      mockTaskRepo.findByParentId.mockResolvedValue(subTasks);
      mockTaskRepo.findById.mockResolvedValue(createMockTask({ id: 'parent-task' }));
      mockTaskRepo.update.mockResolvedValue(createMockTask({ progress: 33 }));

      await taskService.updateParentProgress(mockDb, 'parent-task');

      // Average: (33 + 33 + 34) / 3 = 33.33 → rounds to 33
      expect(mockTaskRepo.update).toHaveBeenCalledWith(mockDb, 'parent-task', { progress: 33 });
    });
  });

  describe('delete', () => {
    it('should delete a task', async () => {
      const mockTask = createMockTask({ id: 'task-123', parentTaskId: null });

      mockTaskRepo.findById.mockResolvedValue(mockTask);
      mockTaskRepo.delete.mockResolvedValue(undefined);

      await taskService.delete(mockDb, 'task-123');

      expect(mockTaskRepo.delete).toHaveBeenCalledWith(mockDb, 'task-123');
    });

    it('should throw error when task does not exist', async () => {
      mockTaskRepo.findById.mockResolvedValue(null);

      await expect(taskService.delete(mockDb, 'nonexistent')).rejects.toThrow('Task not found');
    });

    it('should update parent progress when deleting a sub-task', async () => {
      const mockSubTask = createMockTask({ id: 'sub-task', parentTaskId: 'parent-task' });

      mockTaskRepo.findById.mockResolvedValue(mockSubTask);
      mockTaskRepo.delete.mockResolvedValue(undefined);

      const updateParentSpy = vi.spyOn(taskService, 'updateParentProgress');

      await taskService.delete(mockDb, 'sub-task');

      expect(updateParentSpy).toHaveBeenCalledWith(mockDb, 'parent-task');
    });
  });

  describe('findById', () => {
    it('should return task when found', async () => {
      const mockTask = createMockTask({ id: 'task-123' });
      mockTaskRepo.findById.mockResolvedValue(mockTask);

      const result = await taskService.findById(mockDb, 'task-123');

      expect(result).toEqual(mockTask);
    });

    it('should return null when task not found', async () => {
      mockTaskRepo.findById.mockResolvedValue(null);

      const result = await taskService.findById(mockDb, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('query methods', () => {
    it('should find tasks by project', async () => {
      const mockTasks = [createMockTask(), createMockTask()];
      mockTaskRepo.findByProjectId.mockResolvedValue(mockTasks);

      const result = await taskService.findByProject(mockDb, 'project-123');

      expect(mockTaskRepo.findByProjectId).toHaveBeenCalledWith(mockDb, 'project-123');
      expect(result).toEqual(mockTasks);
    });

    it('should find tasks by user', async () => {
      const mockTasks = [createMockTask(), createMockTask()];
      mockTaskRepo.findByUserId.mockResolvedValue(mockTasks);

      const result = await taskService.findByUser(mockDb, 'user-123');

      expect(mockTaskRepo.findByUserId).toHaveBeenCalledWith(mockDb, 'user-123');
      expect(result).toEqual(mockTasks);
    });

    it('should find tasks by status', async () => {
      const mockTasks = [createMockTask({ status: TaskStatus.IN_PROGRESS })];
      mockTaskRepo.findByStatus.mockResolvedValue(mockTasks);

      const result = await taskService.findByStatus(mockDb, 'user-123', TaskStatus.IN_PROGRESS);

      expect(mockTaskRepo.findByStatus).toHaveBeenCalledWith(
        mockDb,
        'user-123',
        TaskStatus.IN_PROGRESS
      );
      expect(result).toEqual(mockTasks);
    });

    it('should find completed tasks', async () => {
      const mockTasks = [createMockTask({ status: TaskStatus.COMPLETED })];
      mockTaskRepo.findCompleted.mockResolvedValue(mockTasks);

      const result = await taskService.findCompleted(mockDb, 'user-123');

      expect(mockTaskRepo.findCompleted).toHaveBeenCalledWith(mockDb, 'user-123');
      expect(result).toEqual(mockTasks);
    });

    it('should find tasks by planned date', async () => {
      const mockTasks = [createMockTask({ plannedForDate: '2026-02-03' })];
      mockTaskRepo.findByPlannedDate.mockResolvedValue(mockTasks);

      const result = await taskService.findByPlannedDate(mockDb, 'user-123', '2026-02-03');

      expect(mockTaskRepo.findByPlannedDate).toHaveBeenCalledWith(mockDb, 'user-123', '2026-02-03');
      expect(result).toEqual(mockTasks);
    });

    it('should find sub-tasks', async () => {
      const mockSubTasks = [
        createMockTask({ parentTaskId: 'parent-123' }),
        createMockTask({ parentTaskId: 'parent-123' }),
      ];

      mockTaskRepo.findByParentId.mockResolvedValue(mockSubTasks);

      const result = await taskService.findSubTasks(mockDb, 'parent-123');

      expect(mockTaskRepo.findByParentId).toHaveBeenCalledWith(mockDb, 'parent-123');
      expect(result).toEqual(mockSubTasks);
    });
  });
});
