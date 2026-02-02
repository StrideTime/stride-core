import { generateId, initDatabase, now, tasks, users } from '@stridetime/db';
import { TaskDifficulty, type User } from '@stridetime/types';

initDatabase({ enableSync: false, dbFilename: '../../stride-db/stride.db' }).then(db => {
  db.insert(tasks).values({
    id: generateId(),
    userId: 'user_123',
    projectId: 'project_456',
    title: 'New task',
    difficulty: TaskDifficulty.MEDIUM,
    createdAt: now(),
    updatedAt: now(),
  });
});
