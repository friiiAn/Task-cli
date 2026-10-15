import type { Command } from 'commander';
import { withStorage } from '../db/connection.ts';
import { createTask } from '../db/taskRepository.ts';
import { writeLine } from '../utils/output.ts';
import { normalizeDescription, normalizeTitle, validatePriority } from '../utils/task.ts';

export interface AddOptions {
  priority: string;
  description?: string;
}

export function addTask(title: string, options: AddOptions): void {
  const normalizedTitle = normalizeTitle(title);
  const priority = validatePriority(options.priority);
  const description = normalizeDescription(options.description);

  const task = withStorage((db) =>
    createTask(db, { title: normalizedTitle, description, priority }),
  );

  writeLine(`Tarea ${task.id} creada: "${task.title}" (${task.status}, ${task.priority})`);
}

export function registerAddCommand(program: Command): void {
  program
    .command('add <titulo>')
    .alias('create')
    .description('Crear una tarea')
    .option('-p, --priority <valor>', 'Prioridad: high, medium (por defecto) o low', 'medium')
    .option('-d, --description <texto>', 'Descripción opcional de la tarea')
    .action(addTask);
}
