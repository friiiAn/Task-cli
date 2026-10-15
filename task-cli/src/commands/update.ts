import type { Command } from 'commander';
import { withStorage } from '../db/connection.ts';
import { updateTask } from '../db/taskRepository.ts';
import { CliError } from '../utils/errors.ts';
import { writeLine } from '../utils/output.ts';
import { normalizeTitle, parseId, validatePriority, type TaskPatch } from '../utils/task.ts';

export const NO_FIELDS_ERROR =
  'indica al menos un campo a actualizar: --title, --description o --priority.';

export interface UpdateOptions {
  title?: string;
  description?: string;
  priority?: string;
}

export function buildPatch(options: UpdateOptions): TaskPatch {
  const patch: TaskPatch = {};

  if (options.title !== undefined) {
    patch.title = normalizeTitle(options.title);
  }
  if (options.description !== undefined) {
    const trimmed = options.description.trim();
    patch.description = trimmed.length === 0 ? null : trimmed;
  }
  if (options.priority !== undefined) {
    patch.priority = validatePriority(options.priority);
  }

  if (Object.keys(patch).length === 0) {
    throw new CliError(NO_FIELDS_ERROR);
  }

  return patch;
}

export function updateTaskForUser(rawId: string, options: UpdateOptions): void {
  const id = parseId(rawId);
  const patch = buildPatch(options);

  const task = withStorage((db) => updateTask(db, id, patch));

  writeLine(`Tarea ${task.id} actualizada.`);
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update <id>')
    .alias('edit')
    .description('Modificar el título, la descripción o la prioridad de una tarea')
    .option('-t, --title <titulo>', 'Nuevo título de la tarea')
    .option('-d, --description <texto>', 'Nueva descripción; una cadena vacía la borra')
    .option('-p, --priority <valor>', 'Nueva prioridad: high, medium o low')
    .action(updateTaskForUser);
}
