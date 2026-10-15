import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

// Cada archivo de test recibe su propio TASK_CLI_HOME temporal (R-008): la
// persistencia se ejerce sin tocar ~/.task-cli/tasks.db del usuario.
const testHome = mkdtempSync(join(tmpdir(), 'task-cli-test-'));
process.env.TASK_CLI_HOME = testHome;
process.env.NO_COLOR = '1';

afterAll(() => {
  delete process.env.TASK_CLI_HOME;
});
