import { beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../../src/db/connection.ts';
import { getTaskById } from '../../src/db/taskRepository.ts';
import { resetDatabase, runCli, seedTask } from '../support/harness.ts';

beforeEach(() => {
  resetDatabase();
});

function statusOf(id: number): string {
  const db = openDatabase();
  try {
    return getTaskById(db, id)?.status ?? 'inexistente';
  } finally {
    closeDatabase(db);
  }
}

describe('start', () => {
  it('mueve una tarea de todo a in-progress (US3-A2, E-07)', () => {
    const task = seedTask({ status: 'todo' });

    const result = runCli(['start', String(task.id)]);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`Tarea ${task.id} movida a in-progress.`);
    expect(statusOf(task.id)).toBe('in-progress');
  });

  it('funciona con el alias in-progress', () => {
    const task = seedTask({ status: 'todo' });

    const result = runCli(['in-progress', String(task.id)]);

    expect(result.status).toBe(0);
    expect(statusOf(task.id)).toBe('in-progress');
  });

  it('rechaza empezar una tarea ya iniciada y no la modifica (FR-008)', () => {
    const task = seedTask({ status: 'in-progress' });

    const result = runCli(['start', String(task.id)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('transición no permitida: in-progress -> in-progress');
    expect(statusOf(task.id)).toBe('in-progress');
  });

  it('rechaza empezar una tarea completada y no la modifica (FR-008)', () => {
    const task = seedTask({ status: 'done' });

    const result = runCli(['start', String(task.id)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('transición no permitida: done -> in-progress');
    expect(statusOf(task.id)).toBe('done');
  });
});

describe('done', () => {
  it('mueve una tarea de in-progress a done (US3-A3, E-07)', () => {
    const task = seedTask({ status: 'in-progress' });

    const result = runCli(['done', String(task.id)]);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`Tarea ${task.id} movida a done.`);
    expect(statusOf(task.id)).toBe('done');
  });

  it('rechaza completar una tarea que está en todo (US3-A1, SC-003, E-06)', () => {
    const task = seedTask({ status: 'todo' });

    const result = runCli(['done', String(task.id)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error: transición no permitida: todo -> done.');
    expect(statusOf(task.id)).toBe('todo');
  });

  it('rechaza completar una tarea ya completada y no la modifica', () => {
    const task = seedTask({ status: 'done' });

    const result = runCli(['done', String(task.id)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('transición no permitida: done -> done');
    expect(statusOf(task.id)).toBe('done');
  });
});

describe('todo', () => {
  it('devuelve a todo una tarea in-progress (US3-A4, E-07)', () => {
    const task = seedTask({ status: 'in-progress' });

    const result = runCli(['todo', String(task.id)]);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`Tarea ${task.id} movida a todo.`);
    expect(statusOf(task.id)).toBe('todo');
  });

  it('reabre una tarea completada, done -> todo (US3-A5, E-07)', () => {
    const task = seedTask({ status: 'done' });

    const result = runCli(['todo', String(task.id)]);

    expect(result.status).toBe(0);
    expect(statusOf(task.id)).toBe('todo');
  });

  it('rechaza devolver a todo una tarea que ya está en todo', () => {
    const task = seedTask({ status: 'todo' });

    const result = runCli(['todo', String(task.id)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('transición no permitida: todo -> todo');
    expect(statusOf(task.id)).toBe('todo');
  });
});

describe('reglas comunes a start, done y todo', () => {
  it('falla con código 1 si el ID no existe (FR-012, E-08)', () => {
    const result = runCli(['start', '999']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error: no existe ninguna tarea con el ID 999.');
  });

  it('falla con código 1 si el ID no es un entero positivo', () => {
    const result = runCli(['done', 'abc']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error:');
  });

  it('falla con código 1 si falta el argumento obligatorio', () => {
    const result = runCli(['done']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error:');
  });

  it('no imprime ningún stack trace en un error (OUT-5, principio VI)', () => {
    const result = runCli(['done', '999']);

    expect(result.stderr).not.toMatch(/at .*\.(ts|js):\d+/);
    expect(result.stderr).not.toContain('SqliteError');
    expect(result.stderr).not.toContain('CommanderError');
  });

  it('no escribe nada en stdout cuando la transición se rechaza', () => {
    const task = seedTask({ status: 'todo' });

    const result = runCli(['done', String(task.id)]);

    expect(result.stdout).toBe('');
  });

  it('encadena todo el recorrido de una tarea sin saltos (E-07)', () => {
    const task = seedTask({ status: 'todo' });

    expect(runCli(['start', String(task.id)]).status).toBe(0);
    expect(statusOf(task.id)).toBe('in-progress');
    expect(runCli(['todo', String(task.id)]).status).toBe(0);
    expect(statusOf(task.id)).toBe('todo');
    expect(runCli(['start', String(task.id)]).status).toBe(0);
    expect(runCli(['done', String(task.id)]).status).toBe(0);
    expect(statusOf(task.id)).toBe('done');
    expect(runCli(['todo', String(task.id)]).status).toBe(0);
    expect(statusOf(task.id)).toBe('todo');
  });
});
