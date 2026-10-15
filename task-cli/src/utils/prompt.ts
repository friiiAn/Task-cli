import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { CliError } from './errors.ts';

export type ConfirmResponse = 'confirm' | 'cancel';

const AFFIRMATIVE = new Set(['s', 'si', 'sí', 'y', 'yes']);

export interface PromptStreams {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}

export function parseConfirmation(answer: string): ConfirmResponse {
  const normalized = answer.trim().toLowerCase();
  return AFFIRMATIVE.has(normalized) ? 'confirm' : 'cancel';
}

export function isInteractiveStream(stream: NodeJS.ReadStream = stdin): boolean {
  return stream.isTTY === true;
}

export async function confirm(
  question: string,
  streams: PromptStreams = { input: stdin, output: stdout },
): Promise<ConfirmResponse> {
  const rl = createInterface({
    input: streams.input,
    output: streams.output,
  });
  try {
    const answer = await rl.question(question);
    return parseConfirmation(answer);
  } catch (cause) {
    if (cause instanceof CliError) {
      throw cause;
    }
    throw new CliError(
      'no se pudo leer la respuesta. Usa --force para ejecutar la operación sin confirmación.',
      { cause },
    );
  } finally {
    rl.close();
  }
}

export function assertInteractive(input: NodeJS.ReadStream = stdin): void {
  if (!isInteractiveStream(input)) {
    throw new CliError(
      'la entrada no es interactiva, no se puede pedir confirmación. Usa --force para ejecutar la operación sin confirmarla.',
    );
  }
}
