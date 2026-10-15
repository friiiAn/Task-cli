import Database from 'better-sqlite3';
import { CliError } from '../utils/errors.ts';
import { ensureDataDir, resolveDbPath } from '../utils/paths.ts';
import { SCHEMA_STATEMENTS } from './schema.ts';

export type Db = Database.Database;

export const BUSY_TIMEOUT_MS = 5000;

export const BUSY_MESSAGE =
  'la base de datos está ocupada por otra operación de task-cli. ' +
  'Cierra las demás instancias y vuelve a intentarlo.';

export interface OpenOptions {
  dbPath?: string;
  busyTimeoutMs?: number;
}

function isBusyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED';
}

export function translateStorageError(error: unknown): unknown {
  if (error instanceof CliError || !isBusyError(error)) {
    return error;
  }
  return new CliError(BUSY_MESSAGE, { cause: error });
}

export function openDatabase(options: OpenOptions = {}): Db {
  const dbPath = options.dbPath ?? resolveDbPath();
  if (dbPath !== ':memory:') {
    ensureDataDir();
  }

  const db = new Database(dbPath);
  db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? BUSY_TIMEOUT_MS}`);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('user_version = 1');

  for (const statement of SCHEMA_STATEMENTS) {
    db.exec(statement);
  }

  return db;
}

export function closeDatabase(db: Db): void {
  if (db.open) {
    db.close();
  }
}

// Abre, ejecuta y cierra en un único sitio: los comandos no repiten el
// try/finally y los fallos de SQLite llegan ya traducidos (T034). La apertura
// va dentro del try porque fijar el journal en WAL también escribe y, por
// tanto, también puede encontrarse con la base bloqueada.
export function withStorage<T>(action: (db: Db) => T, options: OpenOptions = {}): T {
  let db: Db | undefined;
  try {
    db = openDatabase(options);
    return action(db);
  } catch (error) {
    throw translateStorageError(error);
  } finally {
    if (db !== undefined) {
      closeDatabase(db);
    }
  }
}
