import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { resolveDataDir } from '../../src/utils/paths.ts';
import type { Task, TaskPriority, TaskStatus } from '../../src/utils/task.ts';
import { changeStatus, createTask } from '../../src/db/taskRepository.ts';
import { openDatabase, closeDatabase } from '../../src/db/connection.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const CLI_ENTRY = join(REPO_ROOT, 'src', 'cli.ts');

export interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
  output: string;
}

export function runCli(args: string[], input?: string): CliResult {
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    encoding: 'utf8',
    env: { ...process.env, TASK_CLI_HOME: resolveDataDir(), NO_COLOR: '1' },
    input: input ?? '',
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return {
    status: result.status ?? 1,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
  };
}

export function runCliAsync(args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      env: { ...process.env, TASK_CLI_HOME: resolveDataDir(), NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (status) =>
      resolve({ status: status ?? 1, stdout, stderr, output: `${stdout}${stderr}` }),
    );
  });
}

export function resetDatabase(): void {
  const dir = resolveDataDir();
  for (const name of ['tasks.db', 'tasks.db-wal', 'tasks.db-shm']) {
    // En Windows un archivo abierto no se borra: los reintentos cubren la
    // ventana entre el cierre de una conexión y su liberación real.
    rmSync(join(dir, name), { force: true, maxRetries: 5, retryDelay: 50 });
  }
}

export interface SeedOptions {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export function seedTask(options: SeedOptions = {}): Task {
  const db = openDatabase();
  try {
    const created = createTask(db, {
      title: options.title ?? 'Tarea de prueba',
      description: options.description ?? null,
      ...(options.priority !== undefined ? { priority: options.priority } : {}),
    });
    return moveToStatus(db, created, options.status ?? 'todo');
  } finally {
    closeDatabase(db);
  }
}

// La siembra alcanza el estado deseado recorriendo la máquina de estados, no
// escribiendo la columna directamente: la prueba usa la misma vía que el CLI.
function moveToStatus(db: Database.Database, task: Task, target: TaskStatus): Task {
  let current = task;
  const path: TaskStatus[] = target === 'done' ? ['in-progress', 'done'] : [target];

  for (const next of path) {
    if (next === current.status) {
      continue;
    }
    if (next === 'in-progress' && current.status === 'todo') {
      current = changeStatus(db, current.id, 'in-progress');
      continue;
    }
    current = changeStatus(db, current.id, next);
  }

  return current;
}

export function seedTasks(count: number, options: SeedOptions = {}): Task[] {
  const tasks: Task[] = [];
  for (let index = 1; index <= count; index += 1) {
    tasks.push(seedTask({ title: `Tarea ${index}`, ...options }));
  }
  return tasks;
}

export interface Captured<T> {
  value: T;
  output: string;
}

export async function captureStdout<T>(action: () => T | Promise<T>): Promise<Captured<T>> {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stdout.write;

  try {
    const value = await action();
    return { value, output: chunks.join('') };
  } finally {
    process.stdout.write = original;
  }
}
