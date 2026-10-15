import { beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../../src/db/connection.ts';
import { getTaskById } from '../../src/db/taskRepository.ts';
import { resetDatabase, runCli, seedTask } from '../support/harness.ts';

beforeEach(() => {
  resetDatabase();
});

function readTask(id: number) {
  const db = openDatabase();
  try {
    return getTaskById(db, id);
  } finally {
    closeDatabase(db);
  }
}

describe('update', () => {
  it('cambia sólo la prioridad y deja el resto intacto (US4-A1, FR-009, E-09)', () => {
    const before = seedTask({ title: 'Comprar pan', description: 'Pan y leche', priority: 'low' });

    const result = runCli(['update', String(before.id), '--priority', 'high']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`Tarea ${before.id} actualizada.`);

    const after = readTask(before.id);
    expect(after).toMatchObject({
      id: before.id,
      title: before.title,
      description: before.description,
      status: before.status,
      priority: 'high',
      created_at: before.created_at,
    });
  });

  it('cambia título y descripción a la vez conservando estado y created_at (US4-A2, E-09)', () => {
    const before = seedTask({ title: 'Comprar pan', status: 'in-progress' });

    const result = runCli([
      'update',
      String(before.id),
      '--title',
      'Comprar pan y leche',
      '--description',
      'Supermercado',
    ]);

    expect(result.status).toBe(0);
    const after = readTask(before.id);
    expect(after).toMatchObject({
      id: before.id,
      title: 'Comprar pan y leche',
      description: 'Supermercado',
      status: 'in-progress',
      created_at: before.created_at,
    });
  });

  it('recorta el nuevo título antes de guardarlo (FR-018)', () => {
    const task = seedTask({ title: 'Comprar pan' });

    runCli(['update', String(task.id), '--title', '   Revisar notas   ']);

    expect(readTask(task.id)?.title).toBe('Revisar notas');
  });

  it('añade la descripción si la tarea no tenía ninguna', () => {
    const task = seedTask({ title: 'Comprar pan' });

    runCli(['update', String(task.id), '--description', 'Supermercado']);

    expect(readTask(task.id)?.description).toBe('Supermercado');
  });

  it('borra la descripción cuando se pasa una cadena vacía (FR-009)', () => {
    const task = seedTask({ title: 'Comprar pan', description: 'Supermercado' });

    const result = runCli(['update', String(task.id), '--description', '']);

    expect(result.status).toBe(0);
    expect(readTask(task.id)?.description).toBeNull();
  });

  it('borra la descripción cuando sólo contiene espacios', () => {
    const task = seedTask({ title: 'Comprar pan', description: 'Supermercado' });

    runCli(['update', String(task.id), '-d', '   ']);

    expect(readTask(task.id)?.description).toBeNull();
  });

  it('no borra la descripción si la opción se omite', () => {
    const task = seedTask({ title: 'Comprar pan', description: 'Supermercado' });

    runCli(['update', String(task.id), '--title', 'Otro título']);

    expect(readTask(task.id)?.description).toBe('Supermercado');
  });

  it('acepta las opciones cortas -t, -d y -p', () => {
    const task = seedTask({ title: 'Comprar pan' });

    const result = runCli(['update', String(task.id), '-t', 'Nuevo', '-d', 'Detalle', '-p', 'low']);

    expect(result.status).toBe(0);
    expect(readTask(task.id)).toMatchObject({
      title: 'Nuevo',
      description: 'Detalle',
      priority: 'low',
    });
  });

  it('funciona con el alias edit', () => {
    const task = seedTask({ title: 'Comprar pan' });

    const result = runCli(['edit', String(task.id), '--title', 'Nuevo título']);

    expect(result.status).toBe(0);
    expect(readTask(task.id)?.title).toBe('Nuevo título');
  });

  it('falla con código 1 si no se indica ningún campo a actualizar', () => {
    const task = seedTask({ title: 'Comprar pan' });

    const result = runCli(['update', String(task.id)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Error: indica al menos un campo a actualizar: --title, --description o --priority.',
    );
  });

  it('falla con código 1 si el ID no existe y no modifica nada', () => {
    seedTask({ title: 'Comprar pan' });

    const result = runCli(['update', '999', '--title', 'Otro']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error: no existe ninguna tarea con el ID 999.');
  });

  it('rechaza un título vacío sin modificar la tarea', () => {
    const task = seedTask({ title: 'Comprar pan' });

    const result = runCli(['update', String(task.id), '--title', '   ']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error: el título no puede estar vacío.');
    expect(readTask(task.id)?.title).toBe('Comprar pan');
  });

  it('rechaza una prioridad inválida sin modificar la tarea', () => {
    const task = seedTask({ title: 'Comprar pan', priority: 'low' });

    const result = runCli(['update', String(task.id), '--priority', 'urgent']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Error: prioridad no válida: "urgent". Valores válidos: high, medium, low.',
    );
    expect(readTask(task.id)?.priority).toBe('low');
  });

  it('no permite cambiar el estado (FR-008 sólo mediante start/done/todo)', () => {
    const task = seedTask({ title: 'Comprar pan', status: 'todo' });

    const result = runCli(['update', String(task.id), '--title', 'Nuevo', '--status', 'done']);

    expect(result.status).toBe(1);
    expect(readTask(task.id)?.status).toBe('todo');
  });

  it('no imprime ningún stack trace en un error (OUT-5)', () => {
    const result = runCli(['update', '999', '--title', 'Otro']);

    expect(result.stderr).not.toMatch(/at .*\.(ts|js):\d+/);
  });
});
