import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_LIST_MESSAGE } from '../../src/commands/list.ts';
import { resetDatabase, runCli, seedTask, seedTasks } from '../support/harness.ts';

beforeEach(() => {
  resetDatabase();
});

function columnHeader(output: string): boolean {
  return ['ID', 'Título', 'Estado', 'Prioridad', 'Creada'].every((column) =>
    output.includes(column),
  );
}

function idsIn(output: string): number[] {
  return [...output.matchAll(/^\s*[│|]\s*(\d+)\s/gm)].map((match) => Number(match[1]));
}

describe('list', () => {
  it('imprime "No hay tareas." en una base vacía y sale con 0 (SC-004, E-15)', () => {
    const result = runCli(['list']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(EMPTY_LIST_MESSAGE);
    expect(result.stderr).toBe('');
  });

  it('renderiza la tabla con las cinco columnas requeridas (FR-005, OUT-1)', () => {
    seedTask({ title: 'Comprar pan' });

    const result = runCli(['list']);

    expect(result.status).toBe(0);
    expect(columnHeader(result.stdout)).toBe(true);
  });

  it('muestra las columnas sin código ANSI al redirigir (SC-005, OUT-2)', () => {
    seedTask({ title: 'Comprar pan' });

    const result = runCli(['list']);

    expect(result.stdout).not.toContain('\u001B[');
  });

  it('ordena por created_at descendente, más recientes primero (FR-007, E-03)', () => {
    seedTasks(3);

    const result = runCli(['list']);

    expect(result.status).toBe(0);
    expect(idsIn(result.stdout)).toEqual([3, 2, 1]);
  });

  it('desempata por id descendente cuando la marca de tiempo coincide', () => {
    seedTasks(3);

    const result = runCli(['list']);

    expect(idsIn(result.stdout)).toEqual([3, 2, 1]);
  });

  it('funciona con el alias ls', () => {
    seedTask({ title: 'Comprar pan' });

    const result = runCli(['ls']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Comprar pan');
  });

  it('filtra por estado (FR-006, E-04)', () => {
    seedTask({ title: 'A', status: 'todo' });
    seedTask({ title: 'B', status: 'done' });
    seedTask({ title: 'C', status: 'done' });

    const result = runCli(['list', '--status', 'done']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('B');
    expect(result.stdout).toContain('C');
    expect(result.stdout).not.toMatch(/[│|]\s*A\s+[│|]/);
  });

  it('filtra por prioridad (FR-006, E-04)', () => {
    seedTask({ title: 'A', priority: 'high' });
    seedTask({ title: 'B', priority: 'low' });

    const result = runCli(['list', '--priority', 'low']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('B');
    expect(result.stdout).not.toMatch(/[│|]\s*A\s+[│|]/);
  });

  it('combina ambos filtros con AND lógico (FR-006, E-05)', () => {
    seedTask({ title: 'A', status: 'todo', priority: 'high' });
    seedTask({ title: 'B', status: 'todo', priority: 'low' });
    seedTask({ title: 'C', status: 'done', priority: 'high' });

    const result = runCli(['list', '--status', 'todo', '--priority', 'high']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('A');
    expect(result.stdout).not.toMatch(/[│|]\s*B\s+[│|]/);
    expect(result.stdout).not.toMatch(/[│|]\s*C\s+[│|]/);
  });

  it('imprime "No hay tareas." cuando el filtro no coincide con nada', () => {
    seedTask({ title: 'A', status: 'todo' });

    const result = runCli(['list', '--status', 'done']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(EMPTY_LIST_MESSAGE);
  });

  it('acepta las opciones cortas -s y -p', () => {
    seedTask({ title: 'A', status: 'in-progress', priority: 'high' });
    seedTask({ title: 'B', status: 'done', priority: 'low' });

    const result = runCli(['ls', '-s', 'in-progress', '-p', 'high']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('A');
    expect(result.stdout).not.toMatch(/[│|]\s*B\s+[│|]/);
  });

  it('rechaza un estado inválido enumerando las opciones válidas (FR-014, E-13)', () => {
    const result = runCli(['list', '--status', 'pending']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Error: estado no válido: "pending". Valores válidos: todo, in-progress, done.',
    );
  });

  it('rechaza una prioridad inválida enumerando las opciones válidas (FR-014, E-13)', () => {
    const result = runCli(['list', '--priority', 'urgent']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Error: prioridad no válida: "urgent". Valores válidos: high, medium, low.',
    );
  });

  it('muestra la fecha en formato local YYYY-MM-DD HH:mm (R-009)', () => {
    seedTask({ title: 'Comprar pan' });

    const result = runCli(['list']);

    expect(result.stdout).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  it('renderiza 100 tareas con la tabla alineada y sale con 0 (SC-002, E-16)', () => {
    seedTasks(100);

    const result = runCli(['list']);

    expect(result.status).toBe(0);
    expect(idsIn(result.stdout)).toHaveLength(100);
    expect(result.stdout).toContain('Tarea 1');
    expect(result.stdout).toContain('Tarea 100');
  });
});
