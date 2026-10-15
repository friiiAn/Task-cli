# Contrato de interfaz: `task-cli`

**Feature**: 001-task-cli | **Fecha**: 2026-09-30 | **Plan**: [plan.md](./plan.md)
**Modelo de datos**: [../data-model.md](../data-model.md)

Este documento es el contrato de la única interfaz pública del producto: la línea de comandos.
Todo lo que no aparece aquí es interno y puede cambiar sin romper compatibilidad.

---

## 1. Invocación

```text
task-cli <comando> [argumentos] [opciones]
```

- **Nombre del binario**: `task-cli` (FR-001), declarado en `package.json#bin` e instalable con
  `npm install -g`.
- **Ayuda**: `task-cli --help` y `task-cli <comando> --help`. Commander genera ambos; el parseo
  de `process.argv` es siempre de Commander (principio V).
- **Código de salida**: `0` en éxito (FR-013), `1` ante cualquier error (FR-012).
- **Flujos**: los errores van siempre a `stderr`; los resultados y mensajes informativos a `stdout`.

### 1.1 Variables de entorno

| Variable | Efecto | Ámbito |
|---|---|---|
| `NO_COLOR` | Si está definida (cualquier valor), desactiva todo el color de la salida (FR-015, constitución). | Toda la salida |
| `FORCE_COLOR` | Fuerza color aunque la salida no sea TTY. Tiene prioridad sobre la detección automática, pero no sobre `NO_COLOR`. | Toda la salida |
| `TASK_CLI_HOME` | Sustituye el directorio `~/.task-cli`. La base pasa a ser `<TASK_CLI_HOME>/tasks.db`. | **Sólo tests** (R-008). Sin valor definido, la ruta es exactamente `~/.task-cli/tasks.db` (FR-011). |

---

## 2. Comandos

| Comando | Alias | Resumen |
|---|---|---|
| `add` | `create` | Crear una tarea |
| `list` | `ls` | Listar tareas con filtros opcionales |
| `start` | `in-progress` | Pasar una tarea de `todo` a `in-progress` |
| `done` | — | Pasar una tarea de `in-progress` a `done` |
| `todo` | — | Devolver una tarea a `todo` |
| `update` | `edit` | Modificar título, descripción o prioridad |
| `delete` | `rm` | Eliminar una tarea |

`start`, `done` y `todo` son las tres-specializaciones que cubren FR-008 ("debe existir al menos un
comando para cambiar estado"). Los tres delegan en la misma validación de transiciones.

---

### 2.1 `add` (alias `create`)

```text
task-cli add <titulo> [--priority <high|medium|low>] [--description <texto>]
```

| Elemento | Requisito |
|---|---|
| `<titulo>` | Posicional, obligatorio. No puede estar vacío tras `trim()` (FR-002). |
| `--priority, -p <valor>` | Opcional. Por defecto `medium`. Valores admitidos: `high`, `medium`, `low` (FR-014). |
| `--description, -d <texto>` | Opcional. Se guarda como `NULL` si se omite (FR-002). |

Salida por `stdout` (código 0):

```text
Tarea 1 creada: "Comprar pan" (todo, medium)
```

Reglas:

- El ID lo asigna la base de datos y es autoincremental; **no** se reutiliza tras un borrado
  (FR-003).
- El estado inicial es siempre `todo` (FR-004). No hay opción para crearla en otro estado.

Errores (código 1, `stderr`):

| Situación | Mensaje |
|---|---|
| Título vacío o sólo espacios | `Error: el título no puede estar vacío.` |
| `--priority` inválido | `Error: prioridad no válida: "urgent". Valores válidos: high, medium, low.` |

### 2.2 `list` (alias `ls`)

```text
task-cli list [--status <todo|in-progress|done>] [--priority <high|medium|low>]
```

| Elemento | Requisito |
|---|---|
| `--status, -s <valor>` | Opcional. Filtra por estado (FR-006). |
| `--priority, -p <valor>` | Opcional. Filtra por prioridad (FR-006). |

Reglas:

- Sin filtros muestra todas las tareas.
- Con ambos filtros se aplica un **AND** lógico (FR-006).
- Orden: `created_at` descendente, es decir, **más recientes primero** (FR-007).
- Renderizado en tabla con las columnas `ID`, `Título`, `Estado`, `Prioridad`, `Creada`
  (FR-005, constitución).

Salida por `stdout` (código 0):

```text
ID  Título                Estado      Prioridad  Creada
1   Preparar presentación  in-progress  high       2026-09-30 10:15
2   Comprar pan           todo        medium     2026-09-30 09:02
```

Con lista vacía se imprime `No hay tareas.` en `stdout` y se devuelve 0. No es un error: una base
de datos vacía es un estado válido (SC-004).

Errores (código 1): los mismos de validación de `--status` y `--priority` que en `add`, con el
nombre del campo correspondiente.

### 2.3 `start` (alias `in-progress`)

```text
task-cli start <id>
```

Pasa la tarea de `todo` a `in-progress`. Salida: `Tarea 1 movida a in-progress.` (código 0).

### 2.4 `done`

```text
task-cli done <id>
```

Pasa la tarea de `in-progress` a `done`. Salida: `Tarea 1 movida a done.` (código 0).

### 2.5 `todo`

```text
task-cli todo <id>
```

Devuelve la tarea a `todo`. Válido desde `in-progress` y desde `done`. Salida:
`Tarea 1 movida a todo.` (código 0).

#### Comportamiento común a `start`, `done` y `todo`

| Regla | Origen |
|---|---|
| `<id>` es un entero positivo obligatorio | FR-012 |
| ID inexistente ⇒ error y **ninguna** escritura | FR-012, caso límite del spec |
| Transición no permitida ⇒ error, mensaje que nombra la transición rechazada y las válidas, y **el estado no cambia** | FR-008, US3-A1, SC-003 |

Mensaje de transición inválida:

```text
Error: transición no permitida: todo -> done. Transiciones válidas: todo -> in-progress, in-progress -> done, in-progress -> todo, done -> todo.
```

Mensaje de ID inexistente:

```text
Error: no existe ninguna tarea con el ID 42.
```

### 2.6 `update` (alias `edit`)

```text
task-cli update <id> [--title <titulo>] [--description <texto>] [--priority <high|medium|low>]
```

| Elemento | Requisito |
|---|---|
| `--title, -t <titulo>` | Opcional. No vacío tras `trim()`. |
| `--description, -d <texto>` | Opcional. `--description ""` borra la descripción (pasa a `NULL`). |
| `--priority, -p <valor>` | Opcional. |

Reglas (FR-009):

- La actualización es **parcial**: sólo se modifican los campos presentes. ID, estado,
  `created_at` y los campos omitidos permanecen intactos.
- Al menos una de las tres opciones debe indicarse. Sin ninguna, es un error de uso:
  `Error: indica al menos un campo a actualizar: --title, --description o --priority.` (código 1).
- `--description ""` es distinto de omitir `--description`: es la única forma de borrar la
  descripción sin eliminarla de la interfaz.

Salida: `Tarea 1 actualizada.` (código 0).

### 2.7 `delete` (alias `rm`)

```text
task-cli delete <id> [--force]
```

| Elemento | Requisito |
|---|---|
| `--force, -f` | Omite la confirmación (FR-010). |

Comportamiento:

1. Se comprueba que la tarea existe. Si no, error con código 1 y no se pregunta nada.
2. Si **no** se pasa `--force`, se escribe en `stderr`:

   ```text
   ¿Eliminar la tarea 1 ("Comprar pan")? [s/N]
   ```

   y se lee una línea de `stdin`.
3. La respuesta se interpreta así: `s`, `si`, `sí`, `y`, `yes` (sin distinguir mayúsculas) ⇒
   confirma. Cualquier otra respuesta, incluida una línea vacía (valor por defecto `N`), **cancela**.
4. Si se cancela: se imprime `Operación cancelada.` en `stdout` y se devuelve **0** — cancelar no
   es un error.
5. Si se confirma: se elimina, se imprime `Tarea 1 eliminada.` y se devuelve 0.

Con `--force` no se escribe ninguna pregunta y la eliminación es inmediata.

| Situación | Código | Flujo |
|---|---|---|
| Confirmado | 0 | `stdout`: `Tarea 1 eliminada.` |
| Cancelado por el usuario | 0 | `stdout`: `Operación cancelada.` |
| ID inexistente | 1 | `stderr`: `Error: no existe ninguna tarea con el ID 42.` |
| `stdin` no interactivo sin `--force` | 1 | `stderr`: mensaje indicando usar `--force` en entornos no interactivos |

---

## 3. Superficie de errores

Todo error se reporta en `stderr` con el prefijo `Error: `, seguido de una sola línea accionable.
**Nunca** se imprime un stack trace, incluidos los errores internos de SQLite (principio VI,
FR-012). El punto único de captura está en `src/cli.ts`.

| Código | Significado |
|---|---|
| `0` | Operación completada (incluye "cancelada" en `delete`). |
| `1` | Cualquier fallo: ID inexistente, valor inválido, transición no permitida, título vacío, uso incorrecto, fallo de base de datos. |

Errores de uso catch-all de Commander (comando inexistente, opción desconocida) los emite el propio
Commander con su formato por defecto y terminan con código 1, lo que es coherente con FR-012. Para
mantener el prefijo `Error: ` uniforme, `cli.ts` añade un *hook* de Commander
(`.exitOverride()`) que intercepta la salida de error y la reformatea.

---

## 4. Requisitos de salida (verificables)

| ID | Requisito | Cómo se comprueba |
|---|---|---|
| OUT-1 | La tabla de `list` tiene columnas `ID`, `Título`, `Estado`, `Prioridad`, `Creada` | `task-cli list > salida.txt` y contar columnas |
| OUT-2 | Sin color al redirigir o con `NO_COLOR` | `task-cli list \| cat` no debe contener el byte `0x1B` |
| OUT-3 | Con TTY, sólo se colorean estado y prioridad | Inspección visual; `Título` y `Creada` nunca llevan ANSI |
| OUT-4 | Todos los mensajes al usuario están en español | Revisión de las cadenas en `src/` |
| OUT-5 | Ninguna salida contiene un stack trace | `grep -E "at .*\.ts:[0-9]+" en la salida de un fallo |
