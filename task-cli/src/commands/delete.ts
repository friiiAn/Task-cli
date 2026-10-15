import type { Command } from 'commander';
import { withStorage } from '../db/connection.ts';
import { deleteTask, getTaskById } from '../db/taskRepository.ts';
import { CliError } from '../utils/errors.ts';
import { writeLine } from '../utils/output.ts';
import { assertInteractive, confirm, type PromptStreams } from '../utils/prompt.ts';
import { parseId } from '../utils/task.ts';

export const CANCELLED_MESSAGE = 'Operación cancelada.';

export interface DeleteOptions {
  force?: boolean;
}

export function questionFor(id: number, title: string): string {
  return `¿Eliminar la tarea ${id} ("${title}")? [s/N]`;
}

export async function deleteTaskForUser(
  rawId: string,
  options: DeleteOptions,
  streams: PromptStreams = { input: process.stdin, output: process.stderr },
): Promise<void> {
  const id = parseId(rawId);

  // La existencia se comprueba antes de preguntar: un ID inválido no debe
  // provocar una pregunta (contracts/cli.md §2.7, paso 1).
  const task = withStorage((db) => getTaskById(db, id));
  if (!task) {
    throw new CliError(`no existe ninguna tarea con el ID ${id}.`);
  }

  if (options.force !== true) {
    assertInteractive(streams.input as NodeJS.ReadStream);
    const answer = await confirm(questionFor(id, task.title), streams);
    if (answer === 'cancel') {
      writeLine(CANCELLED_MESSAGE);
      return;
    }
  }

  withStorage((db) => deleteTask(db, id));

  writeLine(`Tarea ${id} eliminada.`);
}

export function registerDeleteCommand(program: Command): void {
  program
    .command('delete <id>')
    .alias('rm')
    .description('Eliminar una tarea, con confirmación salvo que se use --force')
    .option('-f, --force', 'Elimina sin pedir confirmación')
    .action((id: string, options: DeleteOptions) => deleteTaskForUser(id, options));
}
