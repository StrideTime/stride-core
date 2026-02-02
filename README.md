# @stridetime/core

Business logic for Stride - task management, scoring, productivity calculations, and planning utilities.

## Features

- 📋 **Task Management** - Create, update, validate tasks with sub-task support
- 🎯 **Productivity Scoring** - Calculate points based on difficulty, efficiency, and focus
- ✅ **Validation** - Sub-task depth validation, progress rollup logic
- 📅 **Planning** - Assign tasks to days, priority calculation, backlog management
- 🔒 **Type-safe** - Full TypeScript support
- 🧪 **Testable** - Pure functions, no side effects
- 📦 **Framework Agnostic** - Works with any frontend or backend

## Installation

```bash
yarn add @stridetime/core @stridetime/db
```

### GitHub Package Registry Setup

This package is published to GitHub Package Registry. Configure authentication:

```
@stridetime:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN_HERE
```

## Usage

### Task Management

```typescript
import { createTask, updateTask, updateTaskProgress } from '@stridetime/core';
import { getDatabase } from '@stridetime/db';

const db = getDatabase();

// Create a new task
const task = await createTask(db, 'user_123', {
  title: 'Fix login bug',
  projectId: 'proj_456',
  difficulty: 'MEDIUM',
  estimatedMinutes: 120,
});

// Update task progress
await updateTaskProgress(db, task.id, 50); // 50% complete

// Mark as complete
await updateTask(db, task.id, {
  status: 'COMPLETED',
  progress: 100,
});
```

### Productivity Scoring

```typescript
import { calculateTaskScore, calculateDailyScore, DIFFICULTY_MULTIPLIERS } from '@stridetime/core';

// Calculate points for a completed task
const score = calculateTaskScore(task, {
  taskTypesWorkedToday: 3,
});

console.log(score);
// {
//   basePoints: 3.0,          // MEDIUM (3 points) × 100% complete
//   efficiencyBonus: 0.6,     // Finished under estimate (+20%)
//   focusBonus: 0.3,          // Worked on 3+ task types (+10%)
//   totalPoints: 4            // Rounded total
// }

// Calculate daily score
const dailyScore = calculateDailyScore(completedTasks, {
  taskTypesWorkedToday: 4,
});
```

### Sub-task Validation

```typescript
import { canHaveSubtasks, validateSubtaskCreation, calculateParentProgress } from '@stridetime/core';

// Check if task can have sub-tasks (max 2 levels)
if (canHaveSubtasks(parentTask, allTasks)) {
  validateSubtaskCreation(parentTask, allTasks);

  // Create sub-task...
  const subTask = await createTask(db, userId, {
    title: 'Sub-task',
    projectId: parentTask.project_id,
    parentTaskId: parentTask.id,  // Links to parent
  });
}

// Calculate parent progress from sub-tasks
const progress = calculateParentProgress(subTasks);
// Returns average progress (e.g., 75 if sub-tasks are 50%, 100%)
```

### Planning & Task Assignment

```typescript
import {
  assignToDay,
  getTasksForDay,
  getOngoingTasks,
  getBacklogTasks,
  calculatePriority,
} from '@stridetime/core';

// Assign task to Monday
await assignToDay(db, task.id, '2026-01-27');

// Get tasks for a specific day
const mondayTasks = await getTasksForDay(db, userId, '2026-01-27');

// Get ongoing tasks (past their planned date)
const ongoing = await getOngoingTasks(db, userId, '2026-01-27');

// Get backlog (unplanned tasks)
const backlog = await getBacklogTasks(db, userId);

// Calculate priority score for task suggestions
const priority = calculatePriority(task, new Date());
// Higher score = more urgent
```

## API Reference

### Task Management

#### `createTask(db, userId, params): Promise<Task>`

Create a new task with validation.

**Parameters:**
- `params.title` (string, required): Task title
- `params.projectId` (string, required): Project ID
- `params.difficulty` (Difficulty, optional): Default 'MEDIUM'
- `params.estimatedMinutes` (number, optional): Estimated time
- `params.maxMinutes` (number, optional): Maximum time to spend
- `params.dueDate` (Date, optional): Due date
- `params.parentTaskId` (string, optional): Parent task for sub-tasks
- `params.taskTypeId` (string, optional): Task type/category
- `params.description` (string, optional): Task description

**Throws:** `TaskValidationError` if validation fails

#### `updateTask(db, taskId, params): Promise<Task>`

Update task properties.

#### `updateTaskProgress(db, taskId, progress): Promise<Task>`

Update progress and recalculate parent progress if needed.

### Scoring

#### `calculateTaskScore(task, context): TaskScore`

Calculate productivity points for a task.

**Returns:**
```typescript
{
  basePoints: number;        // difficulty × completion
  efficiencyBonus: number;   // +20% if under estimate
  focusBonus: number;        // +10% if 3+ task types today
  totalPoints: number;       // rounded total
}
```

#### `calculateEfficiency(task): number`

Calculate efficiency rating (1.0 = on-time, >1.0 = faster, <1.0 = slower).

#### `calculateDailyScore(tasks, context): number`

Sum all task scores for the day.

### Validation

#### `canHaveSubtasks(task, allTasks): boolean`

Check if task can have sub-tasks (enforces 2-level max).

#### `validateSubtaskCreation(parentTask, allTasks): void`

Validate sub-task creation (throws if invalid).

#### `calculateParentProgress(subTasks): number`

Calculate average progress from sub-tasks.

#### `canCompleteParent(subTasks): boolean`

Check if parent can be marked 100% (all sub-tasks must be 100%).

### Planning

#### `assignToDay(db, taskId, date): Promise<Task>`

Assign task to a specific day (YYYY-MM-DD).

#### `rescheduleTask(db, taskId, newDate): Promise<Task>`

Move task to a different day.

#### `getTasksForDay(db, userId, date): Promise<Task[]>`

Get all tasks planned for a specific day.

#### `getOngoingTasks(db, userId, today): Promise<Task[]>`

Get tasks that lapsed past their planned date.

#### `getBacklogTasks(db, userId): Promise<Task[]>`

Get unplanned tasks.

#### `calculatePriority(task, today): number`

Calculate priority score based on:
- Due date urgency (40%)
- Near completion (30%)
- Time constraint (20%)
- Neglect (10%)

## Development

```bash
# Install dependencies
yarn install

# Build
yarn build

# Watch mode
yarn dev

# Lint
yarn lint

# Type check
yarn typecheck

# Test
yarn test
```

## Publishing

Uses [Changesets](https://github.com/changesets/changesets):

```bash
yarn changeset       # Create changeset
yarn version         # Update versions
yarn release         # Build and publish
```

## License

AGPL-3.0

## Repository

https://github.com/stridetime/stride-core
