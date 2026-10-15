import type { Command } from 'commander';
import { withStorage } from '../db/connection.ts';
import { changeStatus } from '../db/taskRepository.ts';
import { writeLine } from '../utils/output.ts';
import { parseId, type TaskStatus } from '../utils/task.ts';

export function moveTask(rawId: string, next: TaskStatus): void {
  const id = parseId(rawId);

  const task = withStorage((db) => changeStatus(db, id, next));

  writeLine(`Tarea ${task.id} movida a ${task.status}.`);
}

export function registerStatusCommands(program: Command): void {
  program
    .command('start <id>')
    .alias('in-progress')
    .description('Empezar una tarea: pasa de todo a in-progress')
    .action((id: string) => moveTask(id, 'in-progress'));

  program
    .command('done <id>')
    .description('Completar una tarea: pasa de in-progress a done')
    .action((id: string) => moveTask(id, 'done'));

  program
    .command('todo <id>')
    .description('Devolver una tarea a todo, desde in-progress o desde done')
    .action((id: string) => moveTask(id, 'todo'));
}
