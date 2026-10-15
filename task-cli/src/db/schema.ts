export const SCHEMA_VERSION = 1;

export const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT,
    status      TEXT    NOT NULL DEFAULT 'todo',
    priority    TEXT    NOT NULL DEFAULT 'medium',
    created_at  TEXT    NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority)',
];

export const SCHEMA_MIGRATIONS: readonly ((version: number) => readonly string[])[] = [
  (version) => (version < 1 ? SCHEMA_STATEMENTS : []),
];
