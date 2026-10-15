import { describe, expect, it } from 'vitest';
import { CliError } from '../../src/utils/errors.ts';
import {
  assertTransitionAllowed,
  canTransition,
  isTaskPriority,
  isTaskStatus,
  normalizeDescription,
  normalizeTitle,
  parseId,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TITLE_MAX_LENGTH,
  validatePriority,
  validateStatus,
} from '../../src/utils/task.ts';

describe('conjuntos de valores', () => {
  it('expone exactamente los tres estados del dominio', () => {
    expect(TASK_STATUSES).toEqual(['todo', 'in-progress', 'done']);
  });

  it('expone exactamente las tres prioridades del dominio', () => {
    expect(TASK_PRIORITIES).toEqual(['high', 'medium', 'low']);
  });

  it('reconoce estados válidos y descarta el resto', () => {
    expect(isTaskStatus('todo')).toBe(true);
    expect(isTaskStatus('in-progress')).toBe(true);
    expect(isTaskStatus('done')).toBe(true);
    expect(isTaskStatus('pending')).toBe(false);
    expect(isTaskStatus('')).toBe(false);
  });

  it('reconoce prioridades válidas y descarta el resto', () => {
    expect(isTaskPriority('high')).toBe(true);
    expect(isTaskPriority('medium')).toBe(true);
    expect(isTaskPriority('low')).toBe(true);
    expect(isTaskPriority('urgent')).toBe(false);
  });
});

describe('validateStatus', () => {
  it('devuelve el estado cuando es válido', () => {
    expect(validateStatus('done')).toBe('done');
  });

  it('lanza CliError enumerando las opciones válidas', () => {
    expect(() => validateStatus('pending')).toThrowError(CliError);
    expect(() => validateStatus('pending')).toThrowError(
      'estado no válido: "pending". Valores válidos: todo, in-progress, done.',
    );
  });
});

describe('validatePriority', () => {
  it('devuelve la prioridad cuando es válida', () => {
    expect(validatePriority('high')).toBe('high');
  });

  it('lanza CliError enumerando las opciones válidas', () => {
    expect(() => validatePriority('urgent')).toThrowError(
      'prioridad no válida: "urgent". Valores válidos: high, medium, low.',
    );
  });
});

describe('normalizeTitle', () => {
  it('recorta los espacios al inicio y al final', () => {
    expect(normalizeTitle('  Comprar pan \n')).toBe('Comprar pan');
  });

  it('conserva los espacios internos', () => {
    expect(normalizeTitle('Comprar  pan y leche')).toBe('Comprar  pan y leche');
  });

  it('rechaza un título vacío', () => {
    expect(() => normalizeTitle('')).toThrowError('el título no puede estar vacío.');
  });

  it('rechaza un título compuesto sólo por espacios', () => {
    expect(() => normalizeTitle('   ')).toThrowError('el título no puede estar vacío.');
    expect(() => normalizeTitle('\t\n ')).toThrowError('el título no puede estar vacío.');
  });

  it('acepta un título de exactamente 200 caracteres', () => {
    const title = 'a'.repeat(TITLE_MAX_LENGTH);
    expect(normalizeTitle(title)).toBe(title);
  });

  it('rechaza un título de más de 200 caracteres indicando el límite', () => {
    const title = 'a'.repeat(TITLE_MAX_LENGTH + 1);
    expect(() => normalizeTitle(title)).toThrowError(/200 caracteres/);
  });

  it('mide la longitud tras recortar', () => {
    const padded = `  ${'a'.repeat(TITLE_MAX_LENGTH)}  `;
    expect(normalizeTitle(padded)).toBe('a'.repeat(TITLE_MAX_LENGTH));
  });

  it('permite títulos duplicados', () => {
    expect(normalizeTitle('Comprar pan')).toBe(normalizeTitle('Comprar pan'));
  });
});

describe('normalizeDescription', () => {
  it('devuelve null si no se proporciona', () => {
    expect(normalizeDescription(undefined)).toBeNull();
  });

  it('devuelve null si sólo contiene espacios', () => {
    expect(normalizeDescription('   ')).toBeNull();
    expect(normalizeDescription('')).toBeNull();
  });

  it('recorta y conserva el resto', () => {
    expect(normalizeDescription('  Supermercado  ')).toBe('Supermercado');
  });
});

describe('parseId', () => {
  it('acepta enteros positivos', () => {
    expect(parseId('1')).toBe(1);
    expect(parseId('42')).toBe(42);
  });

  it('rechaza el cero y los negativos', () => {
    expect(() => parseId('0')).toThrowError(CliError);
    expect(() => parseId('-3')).toThrowError(CliError);
  });

  it('rechaza los no enteros', () => {
    expect(() => parseId('1.5')).toThrowError(CliError);
    expect(() => parseId('abc')).toThrowError(CliError);
  });
});

describe('máquina de estados', () => {
  it('permite todo -> in-progress', () => {
    expect(canTransition('todo', 'in-progress')).toBe(true);
  });

  it('permite in-progress -> done', () => {
    expect(canTransition('in-progress', 'done')).toBe(true);
  });

  it('permite in-progress -> todo', () => {
    expect(canTransition('in-progress', 'todo')).toBe(true);
  });

  it('permite done -> todo', () => {
    expect(canTransition('done', 'todo')).toBe(true);
  });

  it('rechaza todo -> done', () => {
    expect(canTransition('todo', 'done')).toBe(false);
  });

  it('rechaza todo -> todo', () => {
    expect(canTransition('todo', 'todo')).toBe(false);
  });

  it('rechaza done -> in-progress', () => {
    expect(canTransition('done', 'in-progress')).toBe(false);
  });

  it('rechaza done -> done', () => {
    expect(canTransition('done', 'done')).toBe(false);
  });

  it('rechaza in-progress -> in-progress', () => {
    expect(canTransition('in-progress', 'in-progress')).toBe(false);
  });

  it('cubre las nueve combinaciones de la tabla de transiciones', () => {
    const matrix = TASK_STATUSES.flatMap((from) =>
      TASK_STATUSES.map((to) => [from, to] as const),
    );
    expect(matrix).toHaveLength(9);

    const allowed = matrix.filter(([from, to]) => canTransition(from, to));
    expect(allowed).toHaveLength(4);
  });

  it('no lanza error en las transiciones permitidas', () => {
    expect(() => assertTransitionAllowed('todo', 'in-progress')).not.toThrow();
  });

  it('nombra la transición rechazada y las válidas al rechazar', () => {
    expect(() => assertTransitionAllowed('todo', 'done')).toThrowError(
      'transición no permitida: todo -> done. Transiciones válidas: ' +
        'todo -> in-progress, in-progress -> done, in-progress -> todo, done -> todo.',
    );
  });
});
