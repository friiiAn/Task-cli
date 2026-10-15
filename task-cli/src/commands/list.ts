import type { Command } from 'commander';
import { withStorage } from '../db/connection.ts';
import { listTasks } from '../db/taskRepository.ts';
import { renderTasksTable, writeLine } from '../utils/output.ts';
import { validatePriority, validateStatus } from '../utils/task.ts';

export const EMPTY_LIST_MESSAGE = 'No hay tareas.';

export interface ListOptions {
  status?: string;
  priority?: string;
}

export function listTasksForUser(options: ListOptions): void {
  const filters = {
    ...(options.status !== undefined ? { status: validateStatus(options.status) } : {}),
    ...(options.priority !== undefined ? { priority: validatePriority(options.priority) } : {}),
  };

  const tasks = withStorage((db) => listTasks(db, filters));

  if (tasks.length === 0) {
    writeLine(EMPTY_LIST_MESSAGE);
    return;
  }

  writeLine(renderTasksTable(tasks));
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('Listar tareas, con filtros opcionales por estado y prioridad')
    .option('-s, --status <valor>', 'Mostrar sólo tareas con este estado: todo, in-progress o done')
    .option('-p, --priority <valor>', 'Mostrar sólo tareas con esta prioridad: high, medium o low')
    .action(listTasksForUser);
}
