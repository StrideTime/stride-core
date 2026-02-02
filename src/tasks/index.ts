/**
 * Task management exports
 */

export { createTask, validateCreateTask, TaskValidationError, type CreateTaskParams } from './create';
export { updateTask, updateTaskProgress, updateParentProgress, validateUpdateTask, type UpdateTaskParams } from './update';
