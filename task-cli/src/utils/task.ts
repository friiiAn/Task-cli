import { CliError } from './errors.ts';

export const TASK_STATUSES = ['todo', 'in-progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const DEFAULT_STATUS: TaskStatus = 'todo';
export const DEFAULT_PRIORITY: TaskPriority = 'medium';

export const TITLE_MAX_LENGTH = 200;

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'description' | 'priority'>>;

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
}

const VALID_TRANSITIONS: ReadonlyArray<readonly [TaskStatus, TaskStatus]> = [
  ['todo', 'in-progress'],
  ['in-progress', 'done'],
  ['in-progress', 'todo'],
  ['done', 'todo'],
];

export function formatValidValues(values: readonly string[]): string {
  return values.join(', ');
}

export function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.some((status) => status === value);
}

export function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.some((priority) => priority === value);
}

export function validateStatus(value: string): TaskStatus {
  if (isTaskStatus(value)) {
    return value;
  }
  throw new CliError(
    `estado no válido: "${value}". Valores válidos: ${formatValidValues(TASK_STATUSES)}.`,
  );
}

export function validatePriority(value: string): TaskPriority {
  if (isTaskPriority(value)) {
    return value;
  }
  throw new CliError(
    `prioridad no válida: "${value}". Valores válidos: ${formatValidValues(TASK_PRIORITIES)}.`,
  );
}

export function normalizeTitle(rawTitle: string): string {
  const title = rawTitle.trim();
  if (title.length === 0) {
    throw new CliError('el título no puede estar vacío.');
  }
  if (title.length > TITLE_MAX_LENGTH) {
    throw new CliError(
      `el título no puede superar los ${TITLE_MAX_LENGTH} caracteres (recibidos: ${title.length}).`,
    );
  }
  return title;
}

export function normalizeDescription(rawDescription: string | undefined): string | null {
  if (rawDescription === undefined) {
    return null;
  }
  const trimmed = rawDescription.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function parseId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new CliError(`el ID debe ser un entero positivo (recibido: "${rawId}").`);
  }
  return id;
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS.some(([source, target]) => source === from && target === to);
}

export function formatTransition(from: TaskStatus, to: TaskStatus): string {
  return `${from} -> ${to}`;
}

export function describeAllTransitions(): string {
  return VALID_TRANSITIONS.map(([from, to]) => formatTransition(from, to)).join(', ');
}

export function describeTransitionsFrom(from: TaskStatus): string {
  const targets = VALID_TRANSITIONS.filter(([source]) => source === from).map(([, to]) => to);
  return targets.length > 0 ? targets.join(', ') : 'ninguna';
}

export function assertTransitionAllowed(from: TaskStatus, to: TaskStatus): void {
  if (canTransition(from, to)) {
    return;
  }
  throw new CliError(
    `transición no permitida: ${formatTransition(from, to)}. ` +
      `Transiciones válidas: ${describeAllTransitions()}.`,
  );
}
