# Implementation Plan: task-cli

**Branch**: `001-task-cli` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-task-cli/spec.md`

## Summary

Se construye `task-cli`, un CLI de terminal para gestionar una lista personal de tareas, con
persistencia local en un único archivo SQLite. El usuario crea tareas con `add`, las consulta en
tabla con `list` (con filtros por estado y prioridad), avanza su estado con `start`/`done`/`todo`
sometido a una máquina de estados que impide saltos, las corrige con `update` y las borra con
`delete` mediante confirmación.

Enfoque técnico: TypeScript ESM sobre Node LTS, `commander` como único parseo de argumentos,
`better-sqlite3` con precompilados N-API en `~/.task-cli/tasks.db`, `cli-table3` para el renderizado
y el *type stripping* nativo de Node para ejecutar el TypeScript sin dependencias de desarrollo
adicionales. Toda la lógica de negocio son funciones puras y está cubierta con Vitest.

## Technical Context

**Language/Version**: TypeScript 7.0 (`erasableSyntaxOnly`, sin `enum`) sobre Node.js LTS —
objetivo 24.x, piso declarado `>=22.12.0` (R-001)

**Primary Dependencies**: `better-sqlite3@^13.0.3`, `commander@^15.0.0`, `cli-table3@^0.6.5`
(desarrollo: `typescript@^7.0.2`, `vitest@^5.0.3`, `@types/node@^26.6.4`,
`@types/better-sqlite3@^9.6.0`)

**Storage**: SQLite vía `better-sqlite3`, archivo `~/.task-cli/tasks.db`, esquema v1, WAL

**Testing**: Vitest. Unitarias para la lógica de negocio y de integración sobre base temporal
aislada con `TASK_CLI_HOME`

**Target Platform**: Linux, macOS y Windows; Node LTS. Sin dependencias nativas que compilar en la
máquina del usuario

**Project Type**: cli

**Performance Goals**: arranque del proceso por debajo de 500 ms con 100 tareas (SC-002). No hay objetivo de
rendimiento de servidor: el trabajo por proceso es una consulta SQLite

**Constraints**: funcionamiento totalmente offline (principio II); sin stack traces en la salida
(principio VI); sólo códigos de salida `0` y `1` (FR-012, FR-013); salida legible sin color al
redirigir (SC-005); mensajes al usuario en español (constitución)

**Scale/Scope**: backlog personal de un único usuario, del orden de 10²–10³ tareas, una entidad,
un archivo de base de datos, 7 comandos. Sin usuarios, sincronización, fechas límite, subtareas,
etiquetas ni API web

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Puerta previa (antes de la Fase 0)

| Principio | Verificación | Estado |
|---|---|---|
| I. TypeScript sobre Node LTS | Todo el código en `.ts`; `tsc` en `devDependencies`; `engines.node >= 22.12.0`; ejecución directa con `node src/cli.ts`; `bin` declarado | **CUMPLE** |
| II. SQLite con `better-sqlite3` en `~/.task-cli/tasks.db` | Sin ORM; acceso directo con la API del driver; directorio creado con `mkdir recursive` | **CUMPLE** |
| III. Estructura plana por funcionalidad | Sólo `commands/`, `db/`, `utils/` más el entrypoint. Sin capas `domain`/`application`/`infrastructure` | **CUMPLE** (ver nota N-1) |
| IV. Estilo funcional sobre clases | Funciones puras con `db` como parámetro. Única clase: `CliError`, justificada abajo | **CUMPLE** |
| V. Commander.js como único parseo | Todo comando registrado con nombre, descripción y argumentos. `process.argv` nunca se parsea a mano | **CUMPLE** |
| VI. Errores accionables, sin stack traces | Captura única en `cli.ts`; `Error: <mensaje>` en `stderr`; `process.exitCode = 1` | **CUMPLE** |
| VII. Tests unitarios con Vitest | Plan de tests en `tests/unit` y `tests/integration` que cubre transiciones, validación, orden, filtrado y persistencia | **CUMPLE** |
| VIII. Sin dependencias innecesarias | 3 dependencias de runtime, cada una justificada por escrito en `research.md`. `tsx`, `chalk`/`picocolors`, `inquirer` y los ORMs descartados explícitamente | **CUMPLE** |

**Decisión de la puerta**: PASA. No hay violaciones que requieran la sección *Complexity Tracking*.

**Nota N-1 — lectura de III**: el principio nombra `commands/`, `db/` y `utils/`, y además dice que
"lo compartido MUST limitarse a `utils/`". Los tipos de la entidad, la tabla de transiciones y las
validaciones son lógica compartida sin I/O, por lo que van en `utils/task.ts` en vez de crear un
directorio `domain/`. Es la lectura más fiel al principio: mantener exactamente los tres
directorios nombrados.

### Puerta posterior (después de la Fase 1)

| Principio | Cambio introducido en diseño | Estado |
|---|---|---|
| I | `bin` → `dist/cli.js` (compilado con `tsc`, vía `prepack`); ejecución directa mantenida en desarrollo | **CUMPLE** |
| II | Índices y WAL añadidos en diseño; ninguna tabla ni motor nuevo | **CUMPLE** |
| III | Sin directorios nuevos tras el diseño | **CUMPLE** |
| IV | `CliError` es la única clase; el estado de SQLite se pasa por parámetro, sin singleton | **CUMPLE** |
| V | Se añade `.exitOverride()` para unificar el formato de los errores de uso de Commander con el prefijo `Error:` | **CUMPLE** |
| VI | Se formaliza el contrato de errores en `contracts/cli.md` §3 y la comprobación OUT-5 | **CUMPLE** |
| VII | Se concreta el aislamiento de la persistencia con `TASK_CLI_HOME`, que es lo que hace posible probar el repositorio sin tocar el home del usuario | **CUMPLE** |
| VIII | `cli-table3` y `commander` ya incluyen sus tipos: no se añaden `@types/cli-table3` ni `@types/commander` | **CUMPLE** |

**Decisión de la puerta**: PASA tras el diseño. Ninguna excepción requiere *Complexity Tracking*.

## Project Structure

### Documentation (this feature)

```text
specs/001-task-cli/
├── spec.md              # Especificación (entrada de /speckit.plan)
├── plan.md              # Este archivo (salida de /speckit.plan)
├── research.md          # Fase 0: decisiones técnicas y alternativas descartadas
├── data-model.md        # Fase 1: entidad, máquina de estados, esquema SQL
├── contracts/
│   └── cli.md           # Fase 1: contrato de la interfaz de línea de comandos
├── quickstart.md        # Fase 1: escenarios de validación E-01..E-16
├── checklists/
│   └── requirements.md  # Checklist de calidad de la especificación
└── tasks.md             # Salida de /speckit.tasks (NO lo crea /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── cli.ts                    # Entry point: registra los comandos en Commander y captura errores
├── commands/                 # Un módulo por comando; sólo orquesta, no contiene reglas
│   ├── add.ts
│   ├── list.ts
│   ├── status.ts             # start / done / todo comparten la misma acción base
│   ├── update.ts
│   └── delete.ts
├── db/                       # Persistencia; acceso directo a la API de better-sqlite3
│   ├── connection.ts         # Resuelve ruta, crea el directorio, abre y cierra la conexión
│   ├── schema.ts             # Sentencias DDL idempotentes del esquema v1
│   └── taskRepository.ts     # CRUD de Task con prepared statements
└── utils/                    # Lo compartido, sin I/O salvo donde se indica
    ├── errors.ts             # CliError (única clase del proyecto)
    ├── paths.ts              # Resuelve <home>/.task-cli, con override TASK_CLI_HOME
    ├── task.ts               # Tipos, tablas de estados/prioridades y transiciones (funciones puras)
    ├── output.ts             # Tabla, color con NO_COLOR/TTY, formateo de fechas
    └── prompt.ts             # Confirmación por readline/promises

tests/
├── unit/
│   ├── task.test.ts          # Validaciones y las 9 transiciones
│   ├── output.test.ts        # Color bajo NO_COLOR / no-TTY, formato de tabla y fecha
│   └── prompt.test.ts        # Interpretación de la respuesta sí/no
└── integration/
    ├── add.test.ts
    ├── list.test.ts
    ├── status.test.ts
    ├── update.test.ts
    └── delete.test.ts
```

**Estructura de apoyo**

```text
package.json      # "type": "module", bin, scripts (build/test/typecheck), engines
tsconfig.json     # nodenext + erasableSyntaxOnly + rewriteRelativeImportExtensions
vitest.config.ts  # Aislamiento por test: TASK_CLI_HOME temporal
.gitignore        # node_modules/, dist/, tasks.db
```

**Structure Decision**: proyecto único con estructura plana, exactamente como exige el principio III.
El repositorio **no** contiene todavía ningún código de aplicación: `src/` y `tests/` se crean
integros en la fase de implementación. La separación refleja la frontera de testabilidad: `utils/`
contiene lo que se prueba sin I/O, `db/` y `commands/` se prueban contra una base temporal
aislada.

## Phase 0 recap

Doce decisiones documentadas en `research.md`. Las tres que condicionan el resto del diseño:

| Decisión | Elección | Efecto en el diseño |
|---|---|---|
| R-002 | *type stripping* nativo en desarrollo, `dist/` compilado para el binario | Obliga a `erasableSyntaxOnly`: sin `enum`, conjuntos como `as const` |
| R-008 | `TASK_CLI_HOME` como override del directorio de datos | Hace posible probar la persistencia sin tocar el home del usuario |
| R-011 | Conexión perezosa por invocación | `task-cli --help` no crea `tasks.db` |

## Notes de riesgos

| Riesgo | Mitigación |
|---|---|
| `typescript@7` es el puerto nativo; podría no soportar alguna opción de `tsconfig` | Contingencia en R-012: fijar `typescript@~5.9.3` sin cambiar nada más |
| `better-sqlite3` es una dependencia nativa | v13 usa N-API y trae precompilados en el tarball; sin toolchain de C++ para el usuario |
| El *type stripping* ignora `tsconfig.json` en tiempo de ejecución | Por eso el `tsconfig` se configura para **reflejar** el comportamiento de Node, no al revés (R-002) |
