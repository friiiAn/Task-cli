# Research: task-cli (Phase 0)

**Feature**: 001-task-cli | **Fecha**: 2026-09-30 | **Plan**: [plan.md](./plan.md)

Todas las decisiones técnicas marcadas como `NEEDS CLARIFICATION` en el contexto técnico
del plan están resueltas aquí. No quedan aclaraciones pendientes.

---

## R-001. Versión de runtime Node.js

- **Decision**: `engines.node = ">=22.12.0"`. Desarrollo sobre Node 24 LTS (verificado en el
  entorno: `v24.14.1`).
- **Rationale**: el piso de `>=22.12.0` no es arbitrario, lo imponen las dependencias elegidas:
  `commander@15` declara `engines.node >= 22.12.0` y `vitest@5` declara
  `^22.12.0 || ^24.0.0 || >=26.0.0`. Node 24 es LTS activo y es el objetivo de desarrollo y CI.
  La constitución (principio I) exige Node LTS; tanto 22 como 24 lo son.
- **Alternatives considered**:
  - `>=20`: descartado. `commander@15` y `vitest@5` no lo soportan; obligaría a fijar
    `commander@14` y `vitest@4`, madurando el toolchain sin ganancia para el usuario final.
  - `>=24.12`: descartado. Excluiría a usuarios en Node 22 LTS sin motivo funcional.

---

## R-002. Cómo se ejecuta el TypeScript

- **Decision**: doble vía.
  1. **Desarrollo / ejecución directa**: `node src/cli.ts` mediante el *type stripping* nativo de
     Node (estable desde v24.12.0, por defecto desde v22.18.0). Sin dependencias adicionales.
  2. **Distribución**: `bin` apunta a `dist/cli.js`, compilado con `tsc` (`npm run build`,
     disparado por `prepack`). El paquete publicado incluye `dist/`.
- **Rationale**: el principio I exige ejecución directa con `tsx` **o equivalente** sin paso de
  compilación obligatorio; el *type stripping* nativo es ese equivalente y cumple el principio VIII
  al no añadir ninguna dependencia. Compilar a `dist/` para el binario conserva la instalación
  global en cualquier Node dentro del rango de `engines`, sin atar el paquete a una versión que
  sólo soporte `.ts`. `tsc` ya es necesario para la puerta de typecheck, así que el coste marginal
  del build es cero.
- **Restricción que se hereda**: el *type stripping* no ejecuta sintaxis no borrable. Por eso el
  `tsconfig.json` fija `erasableSyntaxOnly: true`. En consecuencia **no se usarán `enum`,
  `namespace` ni parameter properties**: los conjuntos de valores (`todo`, `in-progress`, ...)
  se modelan como `as const` + unión de tipos, lo que además encaja con el principio IV
  (funciones puras sobre clases).
- **Alternatives considered**:
  - `tsx` como dependencia de desarrollo: funcional, pero es una dependencia completa (ESBuild)
    para algo que Node ya resuelve. Descartada por el principio VIII.
  - Publicar el `.ts` como `bin` directamente: descarta el requisito de typecheck en tiempo de
    ejecución y ata el binario a Node ≥ 24.12. Además hace que `npm install -g` falle en
    Node 22.12–22.17. Descartada.

---

## R-003. Persistencia: `better-sqlite3`

- **Decision**: `better-sqlite3@^13.0.3` (principio II; `engines.node >= 22`).
- **Rationale**: la v13.0.0 es la primera versión que compila sobre **N-API** y publica los binarios
  precompilados **dentro del propio tarball**, eliminando la dependencia `prebuild-install`. Esto es
  crítico para la puerta de instalación (`npm install -g`): el usuario no necesita toolchain de
  C++, Python ni Visual Studio Build Tools. En las versiones anteriores, la ausencia de prebuild
  para una plataforma obligaba a caer en `node-gyp rebuild`, que es exactamente el modo de fallo
  reportado para Node 24 en sistemas sin compilador.
- **Alternatives considered**:
  - `better-sqlite3@12.x`: funciona con Node 24 desde la 12.0.0, pero sigue dependiendo de
    `prebuild-install` y compila desde fuente en plataformas sin prebuild. Regresión frente a v13.
  - `node:sqlite` (módulo integrado):-descartado. La constitución nombra explícitamente
    `better-sqlite3` (principio II) y su APISync encaja mejor con el resto del diseño.
  - ORMs (Prisma, TypeORM, Drizzle): prohibidos por el principio VIII.

---

## R-004. Parseo de argumentos: `commander`

- **Decision**: `commander@^15.0.0`.
- **Rationale**: el principio V obliga a delegar íntegramente el parseo en Commander.js. La v15 es
  la actual, es **ESM puro** (`"type": "module"`), por lo que el proyecto se declara
  `"type": "module"` en `package.json` y el acceso a `better-sqlite3` y `cli-table3` (ambos CJS)
  se hace por *default import* bajo la interoperabilidad ESM de Node.
- **Alternatives considered**:
  - Parseo manual de `process.argv`: prohibido por el principio V.
  - `yargs`: másFeatures y más superficie; el conjunto de comandos de este CLI no lo justifica.

---

## R-005. Renderizado de tablas: `cli-table3`

- **Decision**: `cli-table3@^0.6.5`.
- **Rationale**: la constitución lo nombra explícitamente en la sección de salida en terminal. La
  v0.6.5 **incluye sus propios tipos** (`index.d.ts`), de modo que no hace falta `@types/cli-table3`
  (que además no existe en el registro). Su única dependencia transitiva es `string-width`, usada
  para calcular anchos de columna y por tanto directamente útil al requisito de columnas
  alineadas y anchos estables.
- **Alternatives considered**:
  - `table` / `console.table`: sin control de anchos ni de color por celda; no cumple el requisito
    de salida legible al redirigir.

---

## R-006. Confirmación interactiva de borrado (FR-010)

- **Decision**: `node:readline/promises` (módulo integrado de Node), envuelta en
  `src/utils/prompt.ts`.
- **Rationale**: FR-010 exige confirmación por defecto con `--force` como escape. `readline/promises`
  ofrece `question()` con la API de promesas, suficiente para un sí/no, sin añadir nada.
- **Alternatives considered**:
  - `inquirer` (~10 dependencias transitivas): desproporcionado para un sí/no; principio VIII.
  - `prompts` (1 dependencia): viable, pero `readline` integrado ya cubre el caso.
- **Consecuencia asumida**: la suposición documentada en `spec.md` —en entornos no interactivos
  (CI, pipes) se usa `--force`— es la que evita bloqueos. Si `stdin` no es interactivo, `readline`
  no recibe entrada y el proceso termina con código 1 mediante el manejador de errores, nunca
  eliminando la tarea. Se documenta en `contracts/cli.md`.

---

## R-007. Color y respeto de TTY / `NO_COLOR` (FR-015, SC-005)

- **Decision**: helper propio en `src/utils/output.ts` (~20 líneas) con tres funciones
  (`colorize`, `colorEnabled`, `renderTable`) en lugar de una librería de color.
- **Rationale**: el principio VIII prohíbe añadir librerías cuando el comportamiento se resuelve con
  unas pocas líneas. Los colores necesarios son exactamente dos paletas (estado y prioridad), lo
  que no justifica `chalk`/`picocolors`. La decisión de color se toma **una sola vez** en
  `output.ts`: se desactiva si `NO_COLOR` está definido, si `FORCE_COLOR` no lo está y
  `process.stdout` no es TTY. `cli-table3` recibe celdas con o sin secuencias ANSI según ese flag,
  de forma que la salida redirigida conserva las mismas columnas alineadas.
- **Alternatives considered**:
  - `picocolors` / `chalk`: excellentamente hechas, pero ~1 dependencia y ~5 kB para colorear
    6 valores. Descartadas por el principio VIII.
  - `kleur` con detección propia: mismo coste que la opción anterior con más código.

---

## R-008. Rutas y aislamiento de la base de datos en tests

- **Decision**: `src/utils/paths.ts` resuelve el directorio de la base de datos con la precedencia:
  1. `TASK_CLI_HOME` si está definido (usado **sólo** por los tests),
  2. `path.join(os.homedir(), '.task-cli')`.
  El archivo es siempre `<dir>/tasks.db` y el directorio se crea con `mkdirSync(..., { recursive: true })`
  antes de abrir la conexión.
- **Rationale**: FR-011 fija `~/.task-cli/tasks.db`, pero el principio VII exige tests unitarios de
  la persistencia. Sin un override por variable de entorno, la suite tendría que escribir en el
  directorio home del usuario, lo que la haría no hermética, no paralela y potencialmente
  destructiva. El override no altera el comportamiento por defecto: si `TASK_CLI_HOME` no está
  definido, la ruta es exactamente la exigida por FR-011. Se documenta en `contracts/cli.md` como
  variable de entorno reservada a pruebas.
- **Alternatives considered**:
  - Inyección de dependencias en los repositorios: encaja con el estilo funcional (principio IV)
    y es más limpio, pero el `process.env` como override único es suficiente para esta
    funcionalidad y evita propagar un parámetro por todos los comandos. La inyección se reservaría
    para el futuro si apareciera un segundo backend.

---

## R-009. Modelo de fechas

- **Decision**: `created_at` se almacena como texto ISO 8601 en UTC (`new Date().toISOString()`), y
  se presenta en los listados con formato local legible `YYYY-MM-DD HH:mm`.
- **Rationale**: el texto ISO ordena lexicográficamente igual que cronológicamente, por lo que
  `ORDER BY created_at DESC` es correcto sin conversiones; el formato UTC es inequívoco entre
  máquinas y evita la ambigüedad de SQLite con fechas locales. La presentación se convierte a hora
  local sólo al renderizar, que es donde el usuario la lee. Satisface la suposición de `spec.md`
  sobre fechas ISO 8601 y la de `Task.created_at`.
- **Alternatives considered**:
  - `INTEGER` con epoch: más compacto, pero ilegible al inspeccionar el archivo y dependiente de
    la zona horaria al formatear.
  - `DATETIME` de SQLite: fijo a formats string-dependent; peor portabilidad.

---

## R-010. Autoincremento sin reutilización de IDs (FR-003)

- **Decision**: `id INTEGER PRIMARY KEY AUTOINCREMENT` en SQLite.
- **Rationale**: la palabra clave `AUTOINCREMENT` mantiene la tabla interna `sqlite_sequence`, lo que
  garantiza que un ID **nunca** se reutiliza tras un `DELETE` (a diferencia del `ROWID` por
  defecto, que reutiliza el máximo+1 actual). Es exactamente lo que exige FR-003.
- **Alternatives considered**:
  - `id INTEGER PRIMARY KEY` sin `AUTOINCREMENT`: más rápido, pero incumple FR-003 tras un borrado
    de la última tarea.

---

## R-011. Aislamiento transaccional de la persistencia

- **Decision**: una única instancia de `Database` por invocación del CLI, abierta perezosamente
  (lazy) en `db/connection.ts` y cerrada explícitamente al terminar. Todas las escrituras
  (update, delete, change-status) usan *prepared statements*.
- **Rationale**: el CLI es de un solo proceso y de vida corta; abrir la base de forma diferida evita
  crear `~/.task-cli/tasks.db` para invocaciones que no lo necesitan (por ejemplo `task-cli --help`),
  lo que refuerza SC-004 y la Nota de la constitución sobre no crear estado innecesario. Los
  *prepared statements* evitan el reparseo del SQL y parameterizan los valores, anulando la
  inyección SQL por construcción.

---

## R-012. Toolchain de desarrollo

- **Decision**:
  | Paquete | Versión | Motivo |
  |---|---|---|
  | `typescript` | `^7.0.2` | `latest` del registro; usado para `tsc --noEmit` y para emitir `dist/`. |
  | `vitest` | `^5.0.3` | Principio VII. |
  | `@types/node` | `^26.6.4` | Tipos de las APIs integradas (`node:readline`, `node:os`, `node:path`). |
  | `@types/better-sqlite3` | `^9.6.0` | `better-sqlite3` no incluye tipos propios. |
  | `tsx` | **no se instala** | Ver R-002. |
- **Rationale**: `cli-table3` y `commander` ya incluyen sus declaraciones, por lo que no se añaden
  paquetes `@types` para ellos. Contingencia documentada: si el puerto nativo de TypeScript 7
  (`tsc` en Go) presentara fricción con `rewriteRelativeImportExtensions` o `erasableSyntaxOnly`,
  fijar `typescript@~5.9.3` (última 5.x) sin cambiar nada más del plan.

---

## Resumen de dependencias

**Runtime**: `better-sqlite3`, `commander`, `cli-table3` (3 dependencias, todas justificadas por
principio constitucional: II, V y sección de salida en terminal).

**Desarrollo**: `typescript`, `vitest`, `@types/node`, `@types/better-sqlite3`.

**Integradas de Node** (sin dependencia): `node:readline/promises` (R-006), `node:os` (R-008),
`node:path`, `node:fs`, `node:process`.
