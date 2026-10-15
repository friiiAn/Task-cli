import { beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../../src/db/connection.ts';
import { getTaskById, listTasks } from '../../src/db/taskRepository.ts';
import { resolveDbPath } from '../../src/utils/paths.ts';
import { existsSync } from 'node:fs';
import { resetDatabase, runCli } from '../support/harness.ts';

beforeEach(() => {
  resetDatabase();
});

describe('add', () => {
  it('crea la tarea con valores por defecto y sale con 0 (US1-A1)', () => {
    const result = runCli(['add', 'Comprar pan']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Tarea 1 creada: "Comprar pan" (todo, medium)');
    expect(result.stderr).toBe('');
  });

  it('crea el directorio y el archivo de base de datos en la primera invocación (SC-004)', () => {
    expect(existsSync(resolveDbPath())).toBe(false);

    runCli(['add', 'Primera tarea']);

    expect(existsSync(resolveDbPath())).toBe(true);
  });

  it('persiste título, prioridad, estado y descripción nula (FR-002)', () => {
    runCli(['add', 'Comprar pan']);

    const db = openDatabase();
    try {
      const tasks = listTasks(db);
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        id: 1,
        title: 'Comprar pan',
        description: null,
        status: 'todo',
        priority: 'medium',
      });
      expect(tasks[0]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      closeDatabase(db);
    }
  });

  it('acepta prioridad y descripción explícitas (US1-A2)', () => {
    const result = runCli([
      'add',
      '--priority',
      'high',
      'Preparar presentación',
      '--description',
      'Slides para demo',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('(todo, high)');

    const db = openDatabase();
    try {
      expect(getTaskById(db, 1)).toMatchObject({
        title: 'Preparar presentación',
        description: 'Slides para demo',
        priority: 'high',
      });
    } finally {
      closeDatabase(db);
    }
  });

  it('acepta las opciones cortas -p y -d', () => {
    const result = runCli(['add', '-p', 'low', '-d', 'Detalle', 'Tarea corta']);

    expect(result.status).toBe(0);
    const db = openDatabase();
    try {
      expect(getTaskById(db, 1)).toMatchObject({ priority: 'low', description: 'Detalle' });
    } finally {
      closeDatabase(db);
    }
  });

  it('recorta el título antes de persistirlo (FR-018)', () => {
    const result = runCli(['add', '   Comprar pan y leche   ']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"Comprar pan y leche"');
  });

  it('no reutiliza el ID tras un borrado (FR-003)', () => {
    runCli(['add', 'Tarea uno']);
    runCli(['add', 'Tarea dos']);
    runCli(['delete', '2', '--force']);

    const result = runCli(['add', 'Tarea tres']);

    expect(result.stdout).toContain('Tarea 3 creada');
  });

  it('funciona con el alias create', () => {
    const result = runCli(['create', 'Desde el alias']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Tarea 1 creada: "Desde el alias"');
  });

  it('rechaza un título vacío con código 1 y sin crear nada (FR-002, E-12)', () => {
    const result = runCli(['add', '   ']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error: el título no puede estar vacío.');
    expect(result.stdout).toBe('');

    const db = openDatabase();
    try {
      expect(listTasks(db)).toHaveLength(0);
    } finally {
      closeDatabase(db);
    }
  });

  it('rechaza un título de más de 200 caracteres indicando el límite (FR-018)', () => {
    const result = runCli(['add', 'a'.repeat(201)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('200 caracteres');
  });

  it('acepta un título de exactamente 200 caracteres (FR-018)', () => {
    const result = runCli(['add', 'a'.repeat(200)]);

    expect(result.status).toBe(0);
  });

  it('rechaza una prioridad inválida enumerando las válidas (FR-014, E-13)', () => {
    const result = runCli(['add', 'X', '--priority', 'urgent']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Error: prioridad no válida: "urgent". Valores válidos: high, medium, low.',
    );
  });

  it('permite títulos duplicados (FR-018)', () => {
    runCli(['add', 'Comprar pan']);
    const result = runCli(['add', 'Comprar pan']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Tarea 2 creada: "Comprar pan"');
  });

  it('falla con código 1 si falta el argumento obligatorio', () => {
    const result = runCli(['add']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error:');
  });

  it('devuelve una descripción vacía como NULL', () => {
    const result = runCli(['add', 'Tarea', '--description', '   ']);

    expect(result.status).toBe(0);
    const db = openDatabase();
    try {
      expect(getTaskById(db, 1)?.description).toBeNull();
    } finally {
      closeDatabase(db);
    }
  });
});
