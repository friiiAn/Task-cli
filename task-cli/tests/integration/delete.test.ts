import { Readable, Writable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import { CANCELLED_MESSAGE, deleteTaskForUser, questionFor } from '../../src/commands/delete.ts';
import { closeDatabase, openDatabase } from '../../src/db/connection.ts';
import { getTaskById, listTasks } from '../../src/db/taskRepository.ts';
import type { PromptStreams } from '../../src/utils/prompt.ts';
import { resetDatabase, runCli, seedTask, captureStdout } from '../support/harness.ts';

beforeEach(() => {
  resetDatabase();
});

function taskStatus(id: number): string {
  const db = openDatabase();
  try {
    return getTaskById(db, id)?.status ?? 'inexistente';
  } finally {
    closeDatabase(db);
  }
}

function taskCount(): number {
  const db = openDatabase();
  try {
    return listTasks(db).length;
  } finally {
    closeDatabase(db);
  }
}

interface CapturedPrompt {
  streams: PromptStreams;
  output: () => string;
}

function interactive(answer: string): CapturedPrompt {
  const chunks: string[] = [];
  return {
    streams: {
      input: Object.assign(Readable.from([`${answer}\n`]), { isTTY: true }),
      output: new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(String(chunk));
          callback();
        },
      }),
    },
    output: () => chunks.join(''),
  };
}

describe('delete con --force', () => {
  it('elimina la tarea sin preguntar y sale con 0 (US5-A2, E-11)', () => {
    const task = seedTask({ title: 'Comprar pan' });

    const result = runCli(['delete', String(task.id), '--force']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`Tarea ${task.id} eliminada.`);
    expect(result.stderr).toBe('');
    expect(taskStatus(task.id)).toBe('inexistente');
  });

  it('no imprime ninguna pregunta por stderr', () => {
    const task = seedTask();

    const result = runCli(['delete', String(task.id), '--force']);

    expect(result.stderr).not.toContain('¿Eliminar');
  });

  it('acepta la opción corta -f', () => {
    const task = seedTask();

    expect(runCli(['delete', String(task.id), '-f']).status).toBe(0);
  });

  it('funciona con el alias rm', () => {
    const task = seedTask();

    const result = runCli(['rm', String(task.id), '--force']);

    expect(result.status).toBe(0);
    expect(taskStatus(task.id)).toBe('inexistente');
  });

  it('sólo elimina la tarea indicada y conserva las demás', () => {
    const keep = seedTask({ title: 'Conservar' });
    const remove = seedTask({ title: 'Eliminar' });

    runCli(['delete', String(remove.id), '--force']);

    expect(taskStatus(keep.id)).toBe('todo');
    expect(taskStatus(remove.id)).toBe('inexistente');
  });
});

describe('delete sin --force', () => {
  it('falla con código 1 si la entrada no es interactiva y sugiere usar --force', () => {
    const task = seedTask({ title: 'Comprar pan' });

    const result = runCli(['delete', String(task.id)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--force');
    expect(taskStatus(task.id)).toBe('todo');
  });

  it('elimina la tarea e imprime el mensaje de éxito cuando el usuario confirma con s (US5-A1, E-10)', async () => {
    const task = seedTask({ title: 'Comprar pan' });
    const prompt = interactive('s');

    const { output } = await captureStdout(() => deleteTaskForUser(String(task.id), {}, prompt.streams));

    expect(taskStatus(task.id)).toBe('inexistente');
    expect(output.trim()).toBe(`Tarea ${task.id} eliminada.`);
  });

  it.each(['n', 'N', 'no', ''])(
    'conserva la tarea e imprime "Operación cancelada." con la respuesta "%s"',
    async (answer) => {
      const task = seedTask({ title: 'Comprar pan' });
      const prompt = interactive(answer);

      const { output } = await captureStdout(() =>
        deleteTaskForUser(String(task.id), {}, prompt.streams),
      );

      expect(taskStatus(task.id)).toBe('todo');
      expect(output.trim()).toBe(CANCELLED_MESSAGE);
    },
  );

  it('escribe la pregunta con el ID y el título de la tarea', async () => {
    const task = seedTask({ title: 'Comprar pan' });
    const prompt = interactive('n');

    await captureStdout(() => deleteTaskForUser(String(task.id), {}, prompt.streams));

    expect(prompt.output()).toContain(questionFor(task.id, 'Comprar pan'));
  });

  it('no imprime ninguna pregunta cuando se usa --force', async () => {
    const task = seedTask({ title: 'Comprar pan' });
    const prompt = interactive('s');

    await captureStdout(() => deleteTaskForUser(String(task.id), { force: true }, prompt.streams));

    expect(prompt.output()).toBe('');
    expect(taskStatus(task.id)).toBe('inexistente');
  });
});

describe('errores de delete', () => {
  it('falla con código 1 si el ID no existe y no pregunta nada (FR-012)', () => {
    const result = runCli(['delete', '42', '--force']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error: no existe ninguna tarea con el ID 42.');
    expect(result.stderr).not.toContain('¿Eliminar');
  });

  it('falla con código 1 si el ID no existe y no se usa --force', () => {
    const result = runCli(['delete', '42']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error: no existe ninguna tarea con el ID 42.');
  });

  it('falla con código 1 si el ID no es un entero positivo', () => {
    const result = runCli(['delete', 'abc', '--force']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error:');
  });

  it('falla con código 1 si falta el argumento obligatorio', () => {
    const result = runCli(['delete']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error:');
  });

  it('no imprime ningún stack trace (OUT-5)', () => {
    const result = runCli(['delete', '42', '--force']);

    expect(result.stderr).not.toMatch(/at .*\.(ts|js):\d+/);
    expect(result.stderr).not.toContain('SqliteError');
  });
});

describe('autoincremento tras el borrado', () => {
  it('no reutiliza el ID de la tarea eliminada (FR-003, E-02)', () => {
    runCli(['add', 'Tarea uno']);
    runCli(['add', 'Tarea dos']);

    expect(runCli(['delete', '2', '--force']).status).toBe(0);
    const result = runCli(['add', 'Tarea tres']);

    expect(result.stdout).toContain('Tarea 3 creada');
    expect(taskCount()).toBe(2);
  });
});
