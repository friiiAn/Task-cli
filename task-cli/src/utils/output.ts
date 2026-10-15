import Table from 'cli-table3';
import type { Task, TaskPriority, TaskStatus } from './task.ts';

const ANSI = {
  reset: '\u001B[0m',
  gray: '\u001B[90m',
  red: '\u001B[31m',
  yellow: '\u001B[33m',
  green: '\u001B[32m',
  cyan: '\u001B[36m',
  magenta: '\u001B[35m',
} as const;

type AnsiColor = keyof typeof ANSI;

export interface ColorOptions {
  env?: NodeJS.ProcessEnv;
  stream?: NodeJS.WriteStream;
}

export function colorEnabled(options: ColorOptions = {}): boolean {
  const env = options.env ?? process.env;
  if (env.NO_COLOR !== undefined) {
    return false;
  }
  if (env.FORCE_COLOR !== undefined) {
    return true;
  }
  const stream = options.stream ?? process.stdout;
  return stream.isTTY === true;
}

export function colorize(text: string, color: AnsiColor, enabled: boolean): string {
  return enabled ? `${ANSI[color]}${text}${ANSI.reset}` : text;
}

const STATUS_COLORS: Record<TaskStatus, AnsiColor> = {
  todo: 'yellow',
  'in-progress': 'cyan',
  done: 'green',
};

const PRIORITY_COLORS: Record<TaskPriority, AnsiColor> = {
  high: 'red',
  medium: 'magenta',
  low: 'gray',
};

export function formatStatus(status: TaskStatus, enabled: boolean): string {
  return colorize(status, STATUS_COLORS[status], enabled);
}

export function formatPriority(priority: TaskPriority, enabled: boolean): string {
  return colorize(priority, PRIORITY_COLORS[priority], enabled);
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${day} ${time}`;
}

export function renderTasksTable(tasks: Task[], options: ColorOptions = {}): string {
  const useColor = colorEnabled(options);
  const table = new Table({
    head: ['ID', 'Título', 'Estado', 'Prioridad', 'Creada'],
    style: { head: [], border: [] },
  });

  for (const task of tasks) {
    table.push([
      String(task.id),
      task.title,
      formatStatus(task.status, useColor),
      formatPriority(task.priority, useColor),
      formatDate(task.created_at),
    ]);
  }

  return table.toString();
}

export function writeLine(text: string): void {
  process.stdout.write(`${text}\n`);
}

export function writeErrorLine(text: string): void {
  process.stderr.write(`${text}\n`);
}

// Commander escribe las cabeceras de su ayuda con literales en inglés y no
// ofrece un punto de extensión para traducirlas. Sólo se sustituyen esas
// cabeceras, nunca el texto de las descripciones, que ya están en español.
const HELP_HEADINGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Usage:/gm, 'Uso:'],
  [/^Options:/gm, 'Opciones:'],
  [/^Global Options:/gm, 'Opciones globales:'],
  [/^Arguments:/gm, 'Argumentos:'],
  [/^Commands:/gm, 'Comandos:'],
  [/display help for command/g, 'muestra la ayuda del comando'],
  [/output the version number/g, 'muestra el número de versión'],
];

export function translateHelp(text: string): string {
  return HELP_HEADINGS.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, text);
}
