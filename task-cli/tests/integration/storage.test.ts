import { beforeEach, describe, expect, it } from 'vitest';
import {
  BUSY_MESSAGE,
  BUSY_TIMEOUT_MS,
  translateStorageError,
  withStorage,
} from '../../src/db/connection.ts';
import { createTask } from '../../src/db/taskRepository.ts';
import { CliError } from '../../src/utils/errors.ts';
import { resolveDbPath } from '../../src/utils/paths.ts';
import { resetDatabase, runCli, runCliAsync, seedTask } from '../support/harness.ts';
import Database from 'better-sqlite3';

beforeEach(() => {
  resetDatabase();
});

function busyError(code: string): Error {
  return Object.assign(new Error('database is locked'), { code });
}

// Toma un bloqueo de escritura exclusivo sobre el archivo real. La liberación
// es idempotente porque un mismo bloqueo puede liberarse desde el temporizador
// del test y desde su finally.
function holdExclusiveLock(): { release: () => void } {
  const blocker = new Database(resolveDbPath());
  blocker.pragma('journal_mode = WAL');
  blocker.exec('BEGIN EXCLUSIVE');

  let released = false;
  return {
    release: () => {
      if (released) {
        return;
      }
      released = true;
      try {
        blocker.exec('ROLLBACK');
      } catch {
        // La transacción ya no está activa: la conexión se cierra igualmente.
      }
      blocker.close();
    },
  };
}

describe('translateStorageError', () => {
  it('espera hasta 5 segundos antes de declarar la base bloqueada', () => {
    expect(BUSY_TIMEOUT_MS).toBe(5000);
  });

  it('convierte SQLITE_BUSY en un CliError accionable', () => {
    const translated = translateStorageError(busyError('SQLITE_BUSY'));

    expect(translated).toBeInstanceOf(CliError);
    expect((translated as CliError).message).toBe(BUSY_MESSAGE);
  });

  it('convierte SQLITE_LOCKED en un CliError accionable', () => {
    const translated = translateStorageError(busyError('SQLITE_LOCKED'));

    expect(translated).toBeInstanceOf(CliError);
  });

  it('menciona la acción a tomar en el mensaje', () => {
    expect(BUSY_MESSAGE).toContain('ocupada');
    expect(BUSY_MESSAGE).toContain('task-cli');
  });

  it('deja intactos los CliError ya traducidos', () => {
    const original = new CliError('mensaje de negocio');

    expect(translateStorageError(original)).toBe(original);
  });

  it('deja intactos los errores que no son de bloqueo', () => {
    const original = new TypeError('fallo de programación');

    expect(translateStorageError(original)).toBe(original);
  });

  it('deja intactos los valores que no son errores', () => {
    expect(translateStorageError('texto')).toBe('texto');
  });
});

describe('espera activa ante una base bloqueada', () => {
  it('espera y completa la escritura si el bloqueo se libera antes del límite', async () => {
    const lock = holdExclusiveLock();
    const release = setTimeout(() => lock.release(), 300);

    try {
      const started = Date.now();
      const result = await runCliAsync(['add', 'Tarea con espera']);
      const elapsed = Date.now() - started;

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Tarea 1 creada');
      expect(elapsed).toBeGreaterThanOrEqual(250);
      expect(elapsed).toBeLessThan(BUSY_TIMEOUT_MS + 3000);
    } finally {
      clearTimeout(release);
      lock.release();
    }
  });

  it('informa con un mensaje accionable si el bloqueo no se libera a tiempo', async () => {
    const lock = holdExclusiveLock();

    try {
      const result = await runCliAsync(['add', 'Tarea bloqueada']);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(BUSY_MESSAGE);
      expect(result.stderr).not.toMatch(/at .*\.(ts|js):\d+/);
      expect(result.stderr).not.toContain('SQLITE_BUSY');
    } finally {
      lock.release();
    }
  });

  it('no pierde escrituras cuando varios procesos escriben a la vez', () => {
    const first = withStorage((db) => createTask(db, { title: 'Primera' }));
    const second = withStorage((db) => createTask(db, { title: 'Segunda' }));

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
  });

  it('no deja la base bloqueada para la siguiente invocación', () => {
    seedTask({ title: 'Tarea' });

    const result = runCli(['list']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Tarea');
  });
});
