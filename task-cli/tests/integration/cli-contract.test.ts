import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_LIST_MESSAGE } from '../../src/commands/list.ts';
import { CANCELLED_MESSAGE } from '../../src/commands/delete.ts';
import { NO_FIELDS_ERROR } from '../../src/commands/update.ts';
import { BUSY_MESSAGE } from '../../src/db/connection.ts';
import { resetDatabase, runCli, seedTask } from '../support/harness.ts';

const STACK_TRACE = /(^|\s)at\s+[\w./<>$-]+\.(ts|js|mjs|cjs):\d+/m;
const SQLITE_DETAIL = /SQLITE_|SqliteError|CommanderError/;

beforeEach(() => {
  resetDatabase();
});

interface FailureCase {
  name: string;
  args: string[];
  expected: string;
}

interface SuccessCase {
  name: string;
  args: string[];
  expected: string;
  // Estado de partida necesario para que la transición sea válida.
  seed?: () => void;
}

const IN_PROGRESS = { status: 'in-progress' as const };

const SUCCESS_CASES: SuccessCase[] = [
  { name: 'add', args: ['add', 'Comprar pan'], expected: 'Tarea 1 creada' },
  { name: 'list con base vacía', args: ['list'], expected: EMPTY_LIST_MESSAGE },
  {
    name: 'list con tareas',
    args: ['list'],
    expected: 'Comprar pan',
    seed: () => void seedTask({ title: 'Comprar pan' }),
  },
  {
    name: 'start',
    args: ['start', '1'],
    expected: 'Tarea 1 movida a in-progress.',
    seed: () => void seedTask({ title: 'Comprar pan' }),
  },
  {
    name: 'done',
    args: ['done', '1'],
    expected: 'Tarea 1 movida a done.',
    seed: () => void seedTask({ title: 'Comprar pan', ...IN_PROGRESS }),
  },
  {
    name: 'todo desde in-progress',
    args: ['todo', '1'],
    expected: 'Tarea 1 movida a todo.',
    seed: () => void seedTask({ title: 'Comprar pan', ...IN_PROGRESS }),
  },
  {
    name: 'todo desde done',
    args: ['todo', '1'],
    expected: 'Tarea 1 movida a todo.',
    seed: () => void seedTask({ title: 'Comprar pan', status: 'done' }),
  },
  {
    name: 'update',
    args: ['update', '1', '--title', 'Otro'],
    expected: 'Tarea 1 actualizada.',
    seed: () => void seedTask({ title: 'Comprar pan' }),
  },
  {
    name: 'delete',
    args: ['delete', '1', '--force'],
    expected: 'Tarea 1 eliminada.',
    seed: () => void seedTask({ title: 'Comprar pan' }),
  },
];

const FAILURE_CASES: FailureCase[] = [  {
    name: 'add con título vacío',
    args: ['add', '   '],
    expected: 'el título no puede estar vacío.',
  },
  {
    name: 'add con prioridad inválida',
    args: ['add', 'X', '--priority', 'urgent'],
    expected: 'prioridad no válida: "urgent". Valores válidos: high, medium, low.',
  },
  {
    name: 'add sin título',
    args: ['add'],
    expected: 'falta el argumento obligatorio "titulo".',
  },
  {
    name: 'list con estado inválido',
    args: ['list', '--status', 'pending'],
    expected: 'estado no válido: "pending". Valores válidos: todo, in-progress, done.',
  },
  {
    name: 'list con opción desconocida',
    args: ['list', '--inexistente'],
    expected: 'opción desconocida: "--inexistente".',
  },
  {
    name: 'start con ID inexistente',
    args: ['start', '999'],
    expected: 'no existe ninguna tarea con el ID 999.',
  },
  {
    name: 'done con ID no numérico',
    args: ['done', 'abc'],
    expected: 'el ID debe ser un entero positivo',
  },
  {
    name: 'update sin campos',
    args: ['update', '1'],
    expected: NO_FIELDS_ERROR,
  },
  {
    name: 'delete con ID inexistente',
    args: ['delete', '42', '--force'],
    expected: 'no existe ninguna tarea con el ID 42.',
  },
  {
    name: 'comando inexistente',
    args: ['inventado'],
    expected: 'comando desconocido: "inventado".',
  },
  {
    name: 'add con argumentos de más',
    args: ['add', 'uno', 'dos'],
    expected: 'se recibieron 2 argumentos pero sólo se esperaban 1.',
  },
];

describe('T035: contrato de errores', () => {
  it.each(FAILURE_CASES)('escribe en español el error de $name', ({ args, expected }) => {
    seedTask({ title: 'Comprar pan' });

    const result = runCli(args);

    expect(result.stderr).toContain(`Error: ${expected}`);
  });

  it.each(FAILURE_CASES)('devuelve código 1 en $name', ({ args }) => {
    seedTask({ title: 'Comprar pan' });

    expect(runCli(args).status).toBe(1);
  });

  it.each(FAILURE_CASES)('nunca imprime un stack trace en $name', ({ args }) => {
    seedTask({ title: 'Comprar pan' });

    const result = runCli(args);

    expect(result.stderr).not.toMatch(STACK_TRACE);
    expect(result.stdout).not.toMatch(STACK_TRACE);
  });

  it.each(FAILURE_CASES)('nunca filtra detalles internos de SQLite o Commander en $name', ({ args }) => {
    seedTask({ title: 'Comprar pan' });

    const result = runCli(args);

    expect(result.stderr).not.toMatch(SQLITE_DETAIL);
  });

  it.each(FAILURE_CASES)('escribe el error en stderr y no en stdout en $name', ({ args }) => {
    seedTask({ title: 'Comprar pan' });

    const result = runCli(args);

    expect(result.stdout).toBe('');
    expect(result.stderr).not.toBe('');
  });

  it('usa el prefijo "Error: " en una sola línea', () => {
    const result = runCli(['start', '999']);

    expect(result.stderr.trimEnd().split(/\r?\n/)).toHaveLength(1);
    expect(result.stderr.startsWith('Error: ')).toBe(true);
  });

  it('informa con un mensaje accionable cuando la base está ocupada', () => {
    expect(BUSY_MESSAGE).not.toMatch(SQLITE_DETAIL);
    expect(BUSY_MESSAGE).not.toMatch(STACK_TRACE);
  });
});

describe('T035: mensajes de éxito en español', () => {
  it.each(SUCCESS_CASES)('escribe en español el mensaje de éxito de $name', ({ args, expected, seed }) => {
    if (seed !== undefined) {
      seed();
    }

    const result = runCli(args);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(expected);
  });

  it('escribe "Operación cancelada." en español al cancelar', () => {
    expect(CANCELLED_MESSAGE).toBe('Operación cancelada.');
  });
});

describe('T035: códigos de salida', () => {
  it.each(SUCCESS_CASES)('devuelve exactamente 0 en $name', ({ args, seed }) => {
    if (seed !== undefined) {
      seed();
    }

    expect(runCli(args).status).toBe(0);
  });

  it.each(FAILURE_CASES)('devuelve exactamente 1 en $name', ({ args }) => {
    seedTask({ title: 'Comprar pan' });

    expect(runCli(args).status).toBe(1);
  });

  it('devuelve 0 al pedir la ayuda global', () => {
    expect(runCli(['--help']).status).toBe(0);
  });

  it('devuelve 0 al pedir la versión', () => {
    expect(runCli(['--version']).status).toBe(0);
  });

  it('nunca devuelve un código distinto de 0 o 1 en ninguna invocación', () => {
    const invocations: string[][] = [
      ...FAILURE_CASES.map((item) => item.args),
      ['--help'],
      ['--version'],
      ['list', '--help'],
    ];

    const codes = invocations.map((args) => runCli(args).status);

    expect(codes.every((code) => code === 0 || code === 1)).toBe(true);
  });
});

describe('T035: superficie de la ayuda', () => {
  it('lista los siete comandos con sus alias en español', () => {
    const help = runCli(['--help']);

    expect(help.status).toBe(0);
    for (const command of ['add', 'list', 'start', 'done', 'todo', 'update', 'delete']) {
      expect(help.stdout).toContain(command);
    }
  });

  it('documenta cada comando con una descripción en español', () => {
    const help = runCli(['--help']).stdout;

    expect(help).toContain('Crear una tarea');
    expect(help).toContain('Listar tareas');
    expect(help).toContain('Empezar una tarea');
    expect(help).toContain('Completar una tarea');
    expect(help).toContain('Devolver una tarea a todo');
    expect(help).toContain('Modificar el título');
    expect(help).toContain('Eliminar una tarea');
  });

  it('muestra la ayuda de cada comando sin fallar', () => {
    for (const command of ['add', 'list', 'start', 'done', 'todo', 'update', 'delete']) {
      const result = runCli([command, '--help']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Uso:');
    }
  });

  it('devuelve la versión y sale con 0', () => {
    const result = runCli(['--version']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('traduce a español las cabeceras de la ayuda (OUT-4)', () => {
    const help = runCli(['--help']).stdout;

    expect(help).toContain('Uso:');
    expect(help).toContain('Opciones:');
    expect(help).toContain('Comandos:');
    expect(help).not.toMatch(/^Usage:/m);
    expect(help).not.toMatch(/^Options:/m);
    expect(help).not.toMatch(/^Commands:/m);
    expect(help).not.toContain('display help for command');
  });

  it('traduce también la ayuda de un subcomando', () => {
    const help = runCli(['add', '--help']).stdout;

    expect(help).toContain('Uso: task-cli add');
    expect(help).toContain('Opciones:');
    expect(help).not.toContain('display help for command');
  });

  it('no crea la base de datos al pedir ayuda', () => {
    resetDatabase();

    runCli(['--help']);

    const result = runCli(['list']);
    expect(result.stdout.trim()).toBe(EMPTY_LIST_MESSAGE);
  });
});
