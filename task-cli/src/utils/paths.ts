import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DATA_DIR_NAME = '.task-cli';
const DB_FILE_NAME = 'tasks.db';

export function resolveDataDir(): string {
  const override = process.env.TASK_CLI_HOME;
  return override && override.length > 0
    ? override
    : join(homedir(), DATA_DIR_NAME);
}

export function resolveDbPath(): string {
  return join(resolveDataDir(), DB_FILE_NAME);
}

export function ensureDataDir(): string {
  const dir = resolveDataDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}
