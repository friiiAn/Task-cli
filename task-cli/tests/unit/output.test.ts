import { describe, expect, it } from 'vitest';
import {
  colorEnabled,
  colorize,
  formatDate,
  formatPriority,
  formatStatus,
  renderTasksTable,
} from '../../src/utils/output.ts';
import type { Task } from '../../src/utils/task.ts';
import type { WriteStream } from 'node:tty';

const ANSI_ESCAPE = /\u001B\[/;

function streamWith(isTTY: boolean | undefined): WriteStream {
  return { isTTY } as WriteStream;
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: 'Comprar pan',
    description: null,
    status: 'todo',
    priority: 'medium',
    created_at: '2026-09-30T09:02:00.000Z',
    ...overrides,
  };
}

describe('colorEnabled', () => {
  it('desactiva el color si NO_COLOR está definido aunque la salida sea TTY (FR-015)', () => {
    expect(colorEnabled({ env: { NO_COLOR: '1' }, stream: streamWith(true) })).toBe(false);
  });

  it('desactiva el color con NO_COLOR aunque tenga valor vacío', () => {
    expect(colorEnabled({ env: { NO_COLOR: '' }, stream: streamWith(true) })).toBe(false);
  });

  it('desactiva el color cuando la salida no es TTY (SC-005)', () => {
    expect(colorEnabled({ env: {}, stream: streamWith(false) })).toBe(false);
  });

  it('desactiva el color cuando isTTY no está definido (redirección o pipe)', () => {
    expect(colorEnabled({ env: {}, stream: streamWith(undefined) })).toBe(false);
  });

  it('activa el color con TTY y sin NO_COLOR', () => {
    expect(colorEnabled({ env: {}, stream: streamWith(true) })).toBe(true);
  });

  it('fuerza el color con FORCE_COLOR aunque la salida no sea TTY', () => {
    expect(colorEnabled({ env: { FORCE_COLOR: '1' }, stream: streamWith(false) })).toBe(true);
  });

  it('NO_COLOR tiene prioridad sobre FORCE_COLOR', () => {
    expect(colorEnabled({ env: { NO_COLOR: '1', FORCE_COLOR: '1' }, stream: streamWith(true) })).toBe(
      false,
    );
  });
});

describe('colorize', () => {
  it('devuelve el texto intacto cuando el color está desactivado', () => {
    expect(colorize('todo', 'yellow', false)).toBe('todo');
  });

  it('envuelve el texto en secuencias ANSI cuando el color está activo', () => {
    const colored = colorize('todo', 'yellow', true);

    expect(colored).toContain('\u001B[');
    expect(colored).toContain('todo');
    expect(colored.endsWith('\u001B[0m')).toBe(true);
  });
});

describe('formatStatus y formatPriority', () => {
  it('colorea cada estado de forma distinta', () => {
    const todo = formatStatus('todo', true);
    const inProgress = formatStatus('in-progress', true);
    const done = formatStatus('done', true);

    expect(new Set([todo, inProgress, done]).size).toBe(3);
  });

  it('colorea cada prioridad de forma distinta', () => {
    const high = formatPriority('high', true);
    const medium = formatPriority('medium', true);
    const low = formatPriority('low', true);

    expect(new Set([high, medium, low]).size).toBe(3);
  });

  it('devuelve el valor literal sin color cuando está desactivado', () => {
    expect(formatStatus('in-progress', false)).toBe('in-progress');
    expect(formatPriority('high', false)).toBe('high');
  });
});

describe('formatDate', () => {
  it('presenta la fecha ISO en formato YYYY-MM-DD HH:mm (R-009)', () => {
    const formatted = formatDate(new Date(2026, 8, 30, 10, 15).toISOString());

    expect(formatted).toBe('2026-09-30 10:15');
  });

  it('rellena con cero los meses y días de un solo dígito', () => {
    const formatted = formatDate(new Date(2026, 0, 5, 9, 2).toISOString());

    expect(formatted).toBe('2026-01-05 09:02');
  });

  it('devuelve la entrada tal cual si la fecha no es válida', () => {
    expect(formatDate('no-es-una-fecha')).toBe('no-es-una-fecha');
  });
});

describe('renderTasksTable', () => {
  it('incluye las cinco columnas requeridas (OUT-1)', () => {
    const rendered = renderTasksTable([task()], { env: { NO_COLOR: '1' }, stream: streamWith(false) });

    for (const column of ['ID', 'Título', 'Estado', 'Prioridad', 'Creada']) {
      expect(rendered).toContain(column);
    }
  });

  it('no emite secuencias ANSI cuando NO_COLOR está definido (OUT-2)', () => {
    const rendered = renderTasksTable([task()], { env: { NO_COLOR: '1' }, stream: streamWith(true) });

    expect(rendered).not.toMatch(ANSI_ESCAPE);
  });

  it('no emite secuencias ANSI cuando la salida no es TTY (OUT-2)', () => {
    const rendered = renderTasksTable([task()], { env: {}, stream: streamWith(false) });

    expect(rendered).not.toMatch(ANSI_ESCAPE);
  });

  it('colorea estado y prioridad cuando la salida es TTY (OUT-3)', () => {
    const rendered = renderTasksTable([task()], { env: {}, stream: streamWith(true) });

    expect(rendered).toMatch(ANSI_ESCAPE);
  });

  it('nunca colorea el título ni la fecha (OUT-3)', () => {
    const rendered = renderTasksTable(
      [task({ title: 'Comprar pan' })],
      { env: {}, stream: streamWith(true) },
    );

    const lines = rendered.split('\n');
    const rowLine = lines.find((line) => line.includes('Comprar pan')) ?? '';

    expect(rowLine).toBeDefined();
    const titleCell = rowLine.slice(rowLine.indexOf('Comprar pan'), rowLine.indexOf('Comprar pan') + 10);
    expect(titleCell).not.toMatch(ANSI_ESCAPE);
  });

  it('mantiene el mismo número de columnas sin color y con color', () => {
    const tasks = [task(), task({ id: 2, title: 'Preparar presentación' })];

    const plain = renderTasksTable(tasks, { env: { NO_COLOR: '1' }, stream: streamWith(true) });
    const colored = renderTasksTable(tasks, { env: {}, stream: streamWith(true) });

    const countRows = (text: string): number => text.split('\n').filter((line) => line.includes('│')).length;
    expect(countRows(plain)).toBe(countRows(colored));
  });

  it('devuelve sólo la cabecera para una lista vacía', () => {
    const rendered = renderTasksTable([], { env: { NO_COLOR: '1' }, stream: streamWith(false) });

    expect(rendered).toContain('ID');
  });
});

describe('detección de TTY por defecto', () => {
  it('usa el stream real del proceso cuando no se inyecta ninguno', () => {
    const expected = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

    expect(colorEnabled({ env: {} })).toBe(expected);
  });
});
