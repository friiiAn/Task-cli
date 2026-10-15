#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, CommanderError } from 'commander';
import { registerAddCommand } from './commands/add.ts';
import { registerDeleteCommand } from './commands/delete.ts';
import { registerListCommand } from './commands/list.ts';
import { registerStatusCommands } from './commands/status.ts';
import { registerUpdateCommand } from './commands/update.ts';
import { CliError } from './utils/errors.ts';
import { writeErrorLine, translateHelp } from './utils/output.ts';

export const PROGRAM_NAME = 'task-cli';
export const PROGRAM_DESCRIPTION =
  'Gestor personal de tareas con almacenamiento local en SQLite.';

export function buildProgram(): Command {
  const program = new Command();

  program
    .name(PROGRAM_NAME)
    .description(PROGRAM_DESCRIPTION)
    .version('0.1.0')
    .showHelpAfterError()
    .configureOutput({
      writeOut: (str) => process.stdout.write(translateHelp(str)),
      // La salida de error de Commander se silencia aquí: la reescribimos con
      // el prefijo uniforme "Error: " en el único punto de captura (principio VI).
      writeErr: () => {},
    })
    .exitOverride();

  registerAddCommand(program);
  registerListCommand(program);
  registerStatusCommands(program);
  registerUpdateCommand(program);
  registerDeleteCommand(program);

  return program;
}

export async function run(argv: string[]): Promise<number> {
  const program = buildProgram();

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    return reportFailure(error);
  }
}

export const UNEXPECTED_FAILURE_MESSAGE =
  'se produjo un fallo inesperado al ejecutar el comando. Inténtalo de nuevo.';

export const GENERIC_ERROR_PREFIX = 'Error: ';

// Commander emite sus errores de uso en inglés. Se traducen por código, que es
// estable entre versiones, en lugar de por texto: así OUT-4 se sostiene aunque
// Commander cambie la redacción (constitución: mensajes al usuario en español).
interface UsageErrorRule {
  build: (message: string) => string;
}

const quoted = (message: string): string | undefined => /'([^']*)'/.exec(message)?.[1];

const tooManyArguments = (message: string): string => {
  const counts = /(\d+)\s+arguments?\s+but got (\d+)/.exec(message);
  return counts === null
    ? 'se recibieron argumentos de más.'
    : `se recibieron ${counts[2]} argumentos pero sólo se esperaban ${counts[1]}.`;
};

const USAGE_ERROR_RULES: Record<string, UsageErrorRule> = {
  'commander.unknownCommand': {
    build: (message) => `comando desconocido: "${quoted(message) ?? message}".`,
  },
  'commander.unknownOption': {
    build: (message) => `opción desconocida: "${quoted(message) ?? message}".`,
  },
  'commander.missingArgument': {
    build: (message) => `falta el argumento obligatorio "${quoted(message) ?? message}".`,
  },
  'commander.optionMissingArgument': {
    build: (message) => `falta el valor de la opción ${quoted(message) ?? message}.`,
  },
  'commander.excessArguments': { build: tooManyArguments },
  'commander.conflictingOption': {
    build: (message) => `opción en conflicto: ${quoted(message) ?? message}.`,
  },
};

export function translateUsageError(error: CommanderError): string {
  const rule = USAGE_ERROR_RULES[error.code];
  return rule === undefined ? error.message : rule.build(error.message);
}

export function reportFailure(error: unknown): number {
  if (error instanceof CommanderError) {
    if (error.exitCode === 0) {
      return 0;
    }
    writeErrorLine(`${GENERIC_ERROR_PREFIX}${translateUsageError(error)}`);
    return 1;
  }

  if (error instanceof CliError) {
    writeErrorLine(`${GENERIC_ERROR_PREFIX}${error.message}`);
    return 1;
  }

  writeErrorLine(`${GENERIC_ERROR_PREFIX}${UNEXPECTED_FAILURE_MESSAGE}`);
  return 1;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  process.exitCode = await run(process.argv);
}
