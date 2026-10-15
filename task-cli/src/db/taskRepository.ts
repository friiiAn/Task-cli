import { CliError } from '../utils/errors.ts';
import {
  assertTransitionAllowed,
  DEFAULT_PRIORITY,
  DEFAULT_STATUS,
  type Task,
  type TaskFilters,
  type TaskInput,
  type TaskPatch,
} from '../utils/task.ts';
import type { Db } from './connection.ts';

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: Task['priority'];
  created_at: string;
}

const SELECT_COLUMNS = 'id, title, description, status, priority, created_at';

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    created_at: row.created_at,
  };
}

function requireTask(db: Db, id: number): Task {
  const task = getTaskById(db, id);
  if (!task) {
    throw new CliError(`no existe ninguna tarea con el ID ${id}.`);
  }
  return task;
}

export function createTask(db: Db, input: TaskInput): Task {
  const createdAt = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO tasks (title, description, status, priority, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.description ?? null,
      DEFAULT_STATUS,
      input.priority ?? DEFAULT_PRIORITY,
      createdAt,
    );

  return requireTask(db, Number(info.lastInsertRowid));
}

export function getTaskById(db: Db, id: number): Task | undefined {
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM tasks WHERE id = ?`)
    .get(id) as TaskRow | undefined;
  return row ? toTask(row) : undefined;
}

export function listTasks(db: Db, filters: TaskFilters = {}): Task[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status !== undefined) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.priority !== undefined) {
    conditions.push('priority = ?');
    params.push(filters.priority);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM tasks ${where} ORDER BY created_at DESC, id DESC`,
    )
    .all(...params) as TaskRow[];

  return rows.map(toTask);
}

export function updateTask(db: Db, id: number, patch: TaskPatch): Task {
  const current = requireTask(db, id);

  const assignments: string[] = [];
  const params: unknown[] = [];

  if (patch.title !== undefined) {
    assignments.push('title = ?');
    params.push(patch.title);
  }
  if (patch.description !== undefined) {
    assignments.push('description = ?');
    params.push(patch.description);
  }
  if (patch.priority !== undefined) {
    assignments.push('priority = ?');
    params.push(patch.priority);
  }

  if (assignments.length > 0) {
    params.push(id);
    db.prepare(`UPDATE tasks SET ${assignments.join(', ')} WHERE id = ?`).run(...params);
  }

  return assignments.length === 0 ? current : requireTask(db, id);
}

export function changeStatus(db: Db, id: number, next: Task['status']): Task {
  const current = requireTask(db, id);
  assertTransitionAllowed(current.status, next);

  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(next, id);
  return requireTask(db, id);
}

export function deleteTask(db: Db, id: number): void {
  requireTask(db, id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}
