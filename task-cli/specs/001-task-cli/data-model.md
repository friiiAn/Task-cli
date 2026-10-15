# Data Model: task-cli

**Feature**: 001-task-cli | **Fecha**: 2026-09-30 | **Plan**: [plan.md](./plan.md)
**Contratos**: [contracts/cli.md](./contracts/cli.md)

---

## 1. Entidades

### 1.1 Task

La única entidad del dominio. No tiene relaciones con otras entidades (sin usuarios, subtareas,
dependencias ni etiquetas), según la sección *Key Entities* de `spec.md`.

| Campo | Tipo (TS) | Tipo (SQL) | Nulable | Reglas |
|---|---|---|---|---|
| `id` | `number` | `INTEGER` | no | `PRIMARY KEY AUTOINCREMENT`. Asignado por la base de datos. Nunca se reutiliza tras un borrado (FR-003). |
| `title` | `string` | `TEXT` | no | Obligatorio, no vacío tras `trim()` (FR-002, caso límite del spec). |
| `description` | `string` | `TEXT` | sí | Opcional. Se almacena como `NULL` cuando no se ha indicado (FR-002, FR-009). |
| `status` | `TaskStatus` | `TEXT` | no | `'todo'` \| `'in-progress'` \| `'done'`. Valor inicial `todo` (FR-004). |
| `priority` | `TaskPriority` | `string` (TEXT) | no | `'high'` \| `'medium'` \| `'low'`. Valor inicial `medium` (FR-002). |
| `created_at` | `string` | `TEXT` | no | ISO 8601 UTC (`new Date().toISOString()`). Inmutable (no hay requisito de actualización). |

**Definiciones TypeScript** (cakarta, sin `enum`, por R-002):

```ts
export const TASK_STATUSES = ['todo', 'in-progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
}
```

`TASK_STATUSES` y `TASK_PRIORITIES` son la única fuente de verdad: de ellos se derivan la
validación (FR-014), los valores por defecto de Commander y los textos de los mensajes de error
que enumeran las opciones válidas.

---

## 2. Máquina de estados

Las transiciones permitidas son exactamente las de FR-008. Cualquier otro par se rechaza.

```text
                 ┌──────────────────────┐
                 │                      │
    (crear)      ▼      start          done
   ────────►  [ todo ] ─────────► [ in-progress ] ─────────► [ done ]
                 ▲                    │                        │
                 │                    └──────► (start) ─────────┘
                 │                              (in-progress → todo)
                 └────────────────────────────────────────────────┘
                            (todo: vuelve a [ todo ])
```

Tabla de transiciones (implementada como función pura `canTransition`):

| Desde | Hacia | Resultado |
|---|---|---|
| `todo` | `in-progress` | permitida |
| `in-progress` | `done` | permitida |
| `in-progress` | `todo` | permitida |
| `done` | `todo` | permitida |
| `todo` | `done` | **rechazada** (cubre US3-A1 y SC-003) |
| `todo` | `todo` | rechazada (no-op) |
| `done` | `in-progress` | rechazada |
| `done` | `done` | rechazada (no-op) |
| `in-progress` | `in-progress` | rechazada (no-op) |

El grafo es acíclico salvo el retorno explícito a `todo`, por lo que toda tarea puede volver al
backlog (`done → todo`, `in-progress → todo`) pero nunca avanza saltándose `in-progress`.

---

## 3. Reglas de validación

Todas implementadas como funciones puras y synchronous en `src/utils/task.ts`, sin acceso a I/O
(principio IV, principio VII).

| Regla | Origen | Comportamiento ante fallo |
|---|---|---|
| `title` presente y no vacío tras `trim()` | FR-002, caso límite | `CliError`, salida 1 |
| `status ∈ TASK_STATUSES` | FR-014 | `CliError` enumerando las opciones válidas, salida 1 |
| `priority ∈ TASK_PRIORITIES` | FR-014 | `CliError` enumerando las opciones válidas, salida 1 |
| `id` es entero positivo y existente | FR-012, caso límite | `CliError` indicando que la tarea no existe, salida 1 |
| transición permitida en la tabla §2 | FR-008 | `CliError` explicando la transición rechazada y las válidas, salida 1 |

### Modelo de error

Un único tipo de error de dominio, `CliError`, definido en `src/utils/errors.ts`:

```ts
export class CliError extends Error {
  constructor(message: string, options?: { cause?: unknown });
}
```

- Es la **única** clase del proyecto (principio IV: clases reservadas a lo que exige estado o ciclo
  de vida propio; aqui marca la frontera entre "error esperado de negocio" y "fallo inesperado").
- `cli.ts` la captura en un único punto, escribe `Error: <message>` por `stderr` y fija
  `process.exitCode = 1`.
- Cualquier error **no** `CliError` se reporta con un mensaje genérico en español, **sin stack
  trace** (principio VI, FR-012).
- Ningún camino imprime stack traces, incluidos los errores de SQLite (`SqliteError`).

---

## 4. Esquema de persistencia

Archivo: `<home>/.task-cli/tasks.db` (FR-011). El directorio se crea con `recursive: true` antes de
abrir el archivo (caso límite del spec).

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  description TEXT,
  status      TEXT    NOT NULL DEFAULT 'todo',
  priority    TEXT    NOT NULL DEFAULT 'medium',
  created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority    ON tasks (priority);
```

**Justificación de cada elemento**

| Elemento | Motivo |
|---|---|
| `AUTOINCREMENT` | Obligatorio para que los IDs no se reutilicen al borrar (FR-003, R-010). |
| `status`/`priority` como `TEXT` | El dominio son 3 valores cerrados. `CHECK` añadiría validación en dos sitios; la validación vive en TypeScript y es la única vía de escritura (R-011). |
| `created_at TEXT` ISO 8601 UTC | Orden lexicográfico = orden cronológico, lo que hace correcto `ORDER BY created_at DESC` sin conversiones (FR-007, R-009). |
| `idx_tasks_created_at` | Es el orden por defecto de `list` (FR-007); con 100+ filas (SC-002) evita un *sort* completo. |
| `idx_tasks_status` / `idx_tasks_priority` | Soportan los filtros de FR-006. |
| `PRAGMA journal_mode = WAL` | Escrituras atómicas y lecturas sin bloqueo para otros procesos del CLI. |
| `PRAGMA foreign_keys = ON` | Sin claves foráneas en v1; se activa por defecto para que las migraciones futuras no introduzcan sorpresas. |

El esquema es **v1** y autocontenido. La creación es idempotente (`IF NOT EXISTS`) y se ejecuta en
cada apertura, de modo que la primera invocación del CLI crea archivo y esquema sin intervención
del usuario (SC-004).

**Migraciones**: fuera de alcance (`spec.md`, supuesto "sin migraciones complejas"). Si en el futuro
se añadiera una columna, `db/connection.ts` leería un `user_version` y un array de pasos
apilados; hoy `PRAGMA user_version` se fija en `1`.

---

## 5. Operaciones de la capa `db/`

`src/db/taskRepository.ts` expone funciones que reciben la instancia `Database` abierta (principio
IV: sin estado global implícito) y devuelven datos planos.

| Función | Devuelve | Notas |
|---|---|---|
| `createTask(db, input)` | `Task` | `INSERT`; devuelve el `id` con `lastInsertRowid`. No fija `created_at` si se recibe (testeable). |
| `listTasks(db, filters)` | `Task[]` | `filters?: { status?, priority? }`. Filtros combinados con `AND` (FR-006). `ORDER BY created_at DESC, id DESC` — el `id` desempata tareas creadas dentro del mismo milisegundo, manteniendo determinismo. |
| `getTaskById(db, id)` | `Task \| undefined` | `undefined` se convierte en `CliError` en la capa de comandos. |
| `updateTask(db, id, patch)` | `Task` | `patch` sólo con los campos presentes; construye el `SET` dinámicamente a partir de las claves presentes, de modo que los campos no especificados no cambian (FR-009). |
| `changeStatus(db, id, next)` | `Task` | Valida la transición contra la tabla §2 antes de escribir; lanza `CliError` sin escribir si es inválida. |
| `deleteTask(db, id)` | `void` | Lanza `CliError` si no existe. |

Todas las consultas usan *prepared statements* (`db.prepare(...)`) con parámetros vinculados
(R-011): la inyección SQL queda anulada por construcción.

---

## 6. Depuración y datos de prueba

Ninguna entidad más allá de `Task`. No hay semilla ni datos de ejemplo en producción: la base de
datos se crea vacía. Los tests generan sus propios datos sobre una base temporal aislada mediante
`TASK_CLI_HOME` (R-008).
