import { describe, expect, it } from 'vitest';
import { isInteractiveStream, parseConfirmation } from '../../src/utils/prompt.ts';
import type { ReadStream } from 'node:tty';

describe('parseConfirmation', () => {
  it.each(['s', 'S', 'si', 'SI', 'sí', 'SÍ', 'sÍ ', 'y', 'Y', 'yes', 'YES', ' s ', '\ts\n'])(
    'confirma con la respuesta "%s"',
    (answer) => {
      expect(parseConfirmation(answer)).toBe('confirm');
    },
  );

  it.each(['', '   ', 'n', 'N', 'no', 'NO', 'quizá', '1', 'x', 'si no', 'algo'])(
    'cancela con la respuesta "%s"',
    (answer) => {
      expect(parseConfirmation(answer)).toBe('cancel');
    },
  );
});

describe('isInteractiveStream', () => {
  it('es falsa cuando el flujo no es TTY', () => {
    expect(isInteractiveStream({ isTTY: false } as ReadStream)).toBe(false);
  });

  it('es verdadera cuando el flujo es TTY', () => {
    expect(isInteractiveStream({ isTTY: true } as ReadStream)).toBe(true);
  });

  it('es falsa cuando la propiedad isTTY no está definida', () => {
    expect(isInteractiveStream({} as ReadStream)).toBe(false);
  });
});
