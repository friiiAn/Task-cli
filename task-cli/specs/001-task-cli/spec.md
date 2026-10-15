# Feature Specification: task-cli

**Feature Branch**: `001-task-cli`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

## Clarifications

### Session 2026-10-04

- Q: ¿Qué comandos exactos debe exponer el CLI para cambiar el estado de una tarea por su ID? → A: Opción A — verbos dedicados `start <id>`, `done <id>`, `todo <id>` más el comando genérico `status <id> <todo|in-progress|done>` (alias `set-status`).
- Q: Cuando el usuario rechaza la confirmación antes de borrar una tarea, ¿qué código de salida debe devolver el CLI? → A: Opción A — código `0` y un mensaje informativo de cancelación; la tarea no se borra.
- Q: ¿Qué debe hacer el CLI cuando un listado no devuelve ninguna tarea, ya sea porque la base está vacía o porque los filtros no tienen coincidencias? → A: Opción A — mensaje informativo y código `0`, diferenciando base vacía ("No hay tareas todavía.") de filtros sin coincidencias ("Ninguna tarea coincide con los filtros indicados.").
- Q: ¿Qué reglas de validación debe aplicar el CLI al título de una tarea? → A: Opción A — recortar espacios al inicio y final, rechazar títulos vacíos o solo con espacios, límite de 200 caracteres y títulos duplicados permitidos.
- Q: ¿Qué reglas de validación debe aplicar el CLI al título de una tarea? → A: Opción A — recortar espacios al inicio y final, rechazar títulos vacíos o solo con espacios, límite de 200 caracteres y títulos duplicados permitidos.

## User Scenarios & Testing (mandatory)

### User Story 1 - Crear tareas desde la terminal (Priority: P1)

Como usuario de línea de comandos, quiero crear tareas personales con título, prioridad opcional y descripción opcional para registrar rápidamente lo que tengo que hacer.

**Why this priority**: Es la acción fundamental para que el CLI tenga valor. Sin tareas no existen listados ni transiciones de estado.

**Independent Test**: Ejecutar `task-cli add "Comprar pan"` crea una tarea en estado `todo`, con ID numérico y prioridad `medium` por defecto, persistida en el archivo de base de datos.

**Acceptance Scenarios**:

1. **Given** base de datos vacía, **When** ejecuto `task-cli add "Estudiar TypeScript"`, **Then** se crea una tarea con ID 1, título "Estudiar TypeScript", estado `todo`, prioridad `medium`, fecha de creación registrada y sin descripción.
2. **Given** base de datos con al menos una tarea, **When** ejecuto `task-cli add --priority high "Preparar presentación" --description "Slides para demo"`, **Then** la nueva tarea tiene prioridad `high`, descripción almacenada y sigue el autoincremento de ID.
3. **Given** base de datos vacía, **When** ejecuto `task-cli add "   "`, **Then** la operación es rechazada con mensaje de error y código de salida `1`, y no se crea ninguna tarea.
4. **Given** base de datos vacía, **When** ejecuto `task-cli add "  Comprar pan  "`, **Then** el título se persiste y se muestra como "Comprar pan", sin espacios sobrantes.
5. **Given** una tarea con título "Comprar pan", **When** ejecuto `task-cli add "Comprar pan"`, **Then** se crea una segunda tarea con el mismo título y un ID distinto (los duplicados están permitidos).

---

### User Story 2 - Listar y filtrar tareas (Priority: P1)

Como usuario, quiero listar mis tareas en formato tabla, pudiendo filtrar por estado o prioridad y viendo siempre ID, título, estado, prioridad y fecha de creación.

**Why this priority**: Permite visualizar el backlog y el progreso. Es la segunda acción más usada tras crear tareas.

**Independent Test**: Con varias tareas en distintos estados y prioridades, ejecutar `task-cli list` muestra todas en tabla ordenadas por fecha de creación más recientes primero.

**Acceptance Scenarios**:

1. **Given** existen tareas con estados `todo`, `in-progress` y `done`, **When** ejecuto `task-cli list --status todo`, **Then** solo se muestran tareas en estado `todo`.
2. **Given** existen tareas con prioridades `high`, `medium` y `low`, **When** ejecuto `task-cli list --priority high`, **Then** solo se muestran tareas con prioridad `high`.
3. **Given** existen 3 tareas creadas en momentos distintos, **When** ejecuto `task-cli list`, **Then** aparecen en orden descendente por fecha de creación (más recientes primero).
4. **Given** la base de datos no contiene tareas, **When** ejecuto `task-cli list`, **Then** se imprime "No hay tareas todavía." y el proceso termina con código de salida `0`.
5. **Given** existen tareas pero ninguna coincide con los filtros indicados, **When** ejecuto `task-cli list --status done --priority low`, **Then** se imprime "Ninguna tarea coincide con los filtros indicados." y el proceso termina con código de salida `0`.

---

### User Story 3 - Cambiar estado con validación de transiciones (Priority: P1)

Como usuario, quiero cambiar el estado de una tarea por su ID, aplicando únicamente las transiciones válidas definidas.

**Why this priority**: Garantiza que una tarea no pase de `todo` directamente a `done`, impidiendo estados inconsistentes.

**Independent Test**: Con una tarea en `todo` (ID 1), intentar `task-cli done 1` debe ser rechazado; ejecutar `task-cli start 1` la pasa a `in-progress` y luego `task-cli done 1` la pasa a `done`.

**Acceptance Scenarios**:

1. **Given** tarea ID 1 en estado `todo`, **When** intento marcarla como `done`, **Then** la operación es rechazada con mensaje de error claro y el estado no cambia.
2. **Given** tarea ID 1 en estado `todo`, **When** ejecuto `task-cli start 1`, **Then** su estado pasa a `in-progress`.
3. **Given** tarea ID 1 en estado `in-progress`, **When** ejecuto `task-cli todo 1`, **Then** pasa a `todo` (volver al backlog).
4. **Given** tarea ID 1 en estado `in-progress`, **When** ejecuto `task-cli done 1`, **Then** pasa a `done`.
5. **Given** tarea ID 1 en estado `done`, **When** ejecuto `task-cli todo 1`, **Then** pasa a `todo`.
6. **Given** tarea ID 1 en estado `todo`, **When** ejecuto `task-cli status 1 in-progress`, **Then** su estado pasa a `in-progress` aplicando la misma validación de transición que `start`.

---

### User Story 4 - Actualizar tarea (Priority: P2)

Como usuario, quiero modificar título, descripción o prioridad de una tarea existente por su ID para corregir errores o ajustar información.

**Why this priority**: Útil para iterar sobre una tarea, pero no bloquea la creación/listado/cambio de estado.

**Independent Test**: Con una tarea existente, ejecutar actualización parcial (solo prioridad) cambia únicamente ese campo y persiste el resto.

**Acceptance Scenarios**:

1. **Given** tarea ID 1 con título "Comprar pan", prioridad `medium` y descripción vacía, **When** actualizo prioridad a `high`, **Then** solo cambia la prioridad; título y descripción permanecen iguales.
2. **Given** tarea ID 1 existente, **When** actualizo título y descripción, **Then** ambos campos cambian y se conserva ID, estado, fecha de creación y prioridad previa (si no se indica).

---

### User Story 5 - Eliminar tarea con confirmación (Priority: P2)

Como usuario, quiero eliminar una tarea por su ID, con confirmación por defecto para evitar borrados accidentales, pudiendo saltarla con `--force`.

**Why this priority**: Operación destructiva. Necesaria pero no crítica para el flujo diario.

**Independent Test**: Al eliminar sin `--force`, el CLI solicita confirmación; con `--force` elimina directamente.

**Acceptance Scenarios**:

1. **Given** tarea ID 1 existe, **When** intento eliminarla sin `--force`, **Then** el CLI pide confirmación, y si el usuario rechaza, la tarea no se elimina, se muestra un mensaje informativo de cancelación y el proceso termina con código de salida `0`.
2. **Given** tarea ID 1 existe, **When** ejecuto eliminación con `--force`, **Then** la tarea se elimina permanentemente y deja de aparecer en listados.

---

### Edge Cases

- Intentar operar sobre un ID inexistente: el sistema debe mostrar mensaje de error claro y salir con código 1 (sin cambiar estado).
- Proporcionar valores inválidos para `priority` o `status`: el sistema debe rechazar la operación con mensaje accionable (opciones válidas listadas).
- Título vacío al crear: debe rechazarse (título obligatorio). No se crea la tarea.
- Título con solo espacios: debe rechazarse después de recortar.
- Título que supere 200 caracteres tras el recorte: debe rechazarse indicando el límite.
- Títulos duplicados: se permiten (la unicidad la marca el ID).
- Transición inválida (`todo → done`): debe rechazarse con explicación de transición no permitida y código 1.
- Rechazar la confirmación de borrado: no se considera error; se informa la cancelación, la tarea permanece intacta y el proceso termina con código `0`.
- Filtrar con combinación `--status` y `--priority`: debe aplicarse filtro conjunto (AND lógico) cuando ambos se especifican.
- Redirección a archivo (`task-cli list > tareas.txt`): la salida debe ser legible sin color (respetar TTY/NO_COLOR) y mantener formato de tabla estable.
- Base de datos inexistente: al primer comando que requiera persistencia, debe crearse el archivo `~/.task-cli/tasks.db` y su estructura.
- Listado sin resultados: no es un error; se imprime el mensaje informativo correspondiente y el proceso termina con código `0`.
- Base de datos bloqueada por otra instancia en uso: se espera hasta 5 segundos y se reintenta; si el bloqueo persiste, error accionable y código `1` (nunca se corrompen ni se pierden tareas).
- Ruta `~/.task-cli/` no existe en el sistema: debe crearse antes de abrir la base de datos.

## Requirements (mandatory)

### Functional Requirements

- **FR-001**: El CLI debe llamarse `task-cli` y exponerse mediante binario global (`npm install -g`).
- **FR-002**: El comando para crear tareas MUST permitir `add` (o `create`) con título obligatorio. Debe aceptar `--priority` (`high|medium|low`, por defecto `medium`) y `--description` (opcional).
- **FR-003**: Cada tarea creada MUST recibir un ID numérico autoincremental. Los IDs no se reutilizan al eliminar tareas.
- **FR-004**: El estado inicial de toda tarea recién creada MUST ser `todo`.
- **FR-005**: El comando `list` (o `ls`) MUST mostrar tareas en formato tabla con columnas: ID, título, estado, prioridad, fecha de creación.
- **FR-006**: `list` MUST permitir filtrar por `--status` (`todo|in-progress|done`) y/o por `--priority` (`high|medium|low`). Si ambos se especifican, se aplican conjuntamente (AND).
- **FR-007**: `list` MUST ordenar por fecha de creación descendente (más recientes primero) por defecto.
- **FR-008**: El CLI MUST exponer el cambio de estado por ID mediante tres verbos dedicados —`start <id>` (a `in-progress`), `done <id>` (a `done`) y `todo <id>` (a `todo`)— y un comando genérico `status <id> <estado>` que acepta `todo|in-progress|done` (con alias `set-status`). Todos ellos MUST aplicar la misma validación de transición. Las transiciones permitidas son únicamente: `todo → in-progress`, `in-progress → done`, `in-progress → todo`, `done → todo`. Cualquier otra transición MUST ser rechazada.
- **FR-009**: El comando de actualización (`update <id>` o `edit <id>`) MUST permitir modificar título, descripción y/o prioridad de una tarea existente. Los campos no especificados no cambian.
- **FR-010**: El comando de eliminación (`delete <id>` o `rm <id>`) MUST pedir confirmación antes de eliminar, a menos que se use `--force`. Si el usuario rechaza la confirmación, la tarea MUST NOT eliminarse, el CLI MUST emitir un mensaje informativo de cancelación y MUST terminar con código de salida `0` (no es un error).
- **FR-011**: La persistencia MUST realizarse en SQLite mediante `better-sqlite3`, en `~/.task-cli/tasks.db`. El directorio `~/.task-cli/` debe crearse si no existe.
- **FR-012**: Toda operación que falle (ID inexistente, valor inválido, transición no permitida, título vacío) MUST devolver código de salida `1` y un mensaje de error claro y accionable (sin stack traces).
- **FR-013**: Las operaciones exitosas MUST devolver código de salida `0`.
- **FR-014**: Los valores aceptados para estado son `todo`, `in-progress`, `done`. Los valores aceptados para prioridad son `high`, `medium`, `low`. Cualquier otro valor MUST rechazarse.
- **FR-015**: La salida de tablas MUST usar `cli-table3` o equivalente. El uso de color MUST limitarse a estados y prioridades. Debe respetarse `NO_COLOR` y comportamiento sin TTY (no colorear al redirigir).
- **FR-016**: Un listado sin resultados MUST ser un resultado válido, no un error: el CLI MUST terminar con código de salida `0` e imprimir un mensaje informativo en español que distinga entre base de datos vacía ("No hay tareas todavía.") y filtros sin coincidencias ("Ninguna tarea coincide con los filtros indicados.").
- **FR-017**: El CLI MUST tolerar invocaciones concurrentes sobre `~/.task-cli/tasks.db`. Si la base de datos está bloqueada por otra instancia, el CLI MUST esperar hasta 5 segundos antes de reintentar; si tras ese plazo sigue bloqueada, MUST terminar con código `1` y un mensaje accionable indicando que otra instancia está en uso (nunca un error técnico ni stack trace). Las escrituras MUST ser atómicas: una tarea añadida por una instancia no puede perderse, duplicarse ni corromperse por efecto de otra.
- **FR-018**: El título MUST normalizarse recortando los espacios al inicio y al final antes de persistirse. MUST rechazarse con código `1` y mensaje accionable si, tras el recorte, queda vacío o contiene solo espacios. La longitud MUST NOT superar 200 caracteres; un título más largo MUST rechazarse indicando el límite en el mensaje. Los títulos duplicados MUST permitirse: la identidad de una tarea la establece su ID, no su título.

### Key Entities (include if feature involves data)

- **Task**: Representa una tarea personal. Atributos: `id` (entero autoincremental), `title` (texto obligatorio, recortado, de 1 a 200 caracteres tras el recorte; los duplicados se permiten), `description` (texto opcional), `status` (`todo|in-progress|done`), `priority` (`high|medium|low`), `created_at` (marca de tiempo ISO 8601). Relaciones: ninguna (sin usuarios, subtareas ni dependencias).

## Success Criteria (mandatory)

### Measurable Outcomes

- **SC-001**: Un usuario puede crear una tarea desde la terminal en menos de 15 segundos (flujo completo: comando + verificación).
- **SC-002**: El 100% de las operaciones de listado con hasta 100 tareas se renderizan correctamente en formato tabla legible.
- **SC-003**: Al menos el 95% de los intentos de transición inválida (`todo → done`) son rechazados con mensaje accionable y código 1 (sin afectar otras tareas).
- **SC-004**: La primera ejecución crea `~/.task-cli/tasks.db` sin requerir intervención manual del usuario.
- **SC-005**: Tras redirigir `task-cli list` a un archivo, el contenido permanece legible (sin secuencias de color ANSI) y conserva columnas alineadas.
- SC-006: Con dos instancias del CLI ejecutadas simultáneamente sobre la misma base de datos, el 100% de los intentos terminan con código `0` (esperando el acceso) y ninguna tarea se duplica, se pierde ni queda corrupta.

## Assumptions

- Los usuarios utilizan terminales compatibles con TTY estándar. Cuando la salida se redirige (pipe), no se espera color.
- `~` se resuelve al directorio de usuario del sistema operativo (Windows `%USERPROFILE%`/Linux/macOS `$HOME`). El CLI debe funcionar en Node.js LTS multiplataforma.
- No existen usuarios múltiples; todas las tareas pertenecen al usuario local.
- La confirmación de eliminación es interactiva por defecto. En entornos no interactivos (CI/scripts), el usuario usará `--force` para evitar bloqueo.
- El orden por defecto de `list` es estrictamente por `created_at` descendente (más recientes primero). No se requiere orden secundario.
- El esquema de base de datos es inicial (v0/v1) y autocontenido para esta versión; no se prevén migraciones complejas.
- Los comandos aceptan nombres en español o inglés según convención CLI (se prefiere nombres cortos: `add`, `list`, `delete`, `update`), manteniendo mensajes al usuario en español conforme a la constitución.
- Las fechas de creación se almacenan en formato ISO 8601 (UTC o local coherente) y se muestran en listados de forma legible.

## Notes

- Esta especificación cumple con la Constitución `task-cli` v1.0.0 (principios I–VIII): TypeScript + Node LTS, SQLite/better-sqlite3 en `~/.task-cli/tasks.db`, estructura plana (commands/db/utils), funcional, Commander.js, errores sin stack traces (códigos 0/1), Vitest para lógica de negocio, sin ORMs ni dependencias innecesarias.
- No se registran [NEEDS CLARIFICATION]. Todos los puntos críticos tienen valores razonables por defecto y son verificables.
- Alcance limitado a lo indicado en `spec-input.md` (sin usuarios, sincronización externa, due dates, subtareas, tags/categorías, web/API REST).