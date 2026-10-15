<!--
SYNC IMPACT REPORT — material de trabajo temporal para revisión humana.
ELIMINAR este comentario antes de hacer commit de la constitución.

Cambio de versión: (sin versión previa — documento sin ratificar) → 1.0.0

Principios añadidos (8, replaces los 5 placeholders [PRINCIPLE_N_*]):
- I. TypeScript sobre Node.js LTS                 ← reglas.md 1, 10
- II. Persistencia local en SQLite (better-sqlite3) ← reglas.md 2
- III. Estructura plana, organizada por funcionalidad ← reglas.md 3
- IV. Estilo funcional sobre clases                ← reglas.md 4
- V. Commander.js como único parseo de argumentos  ← reglas.md 5
- VI. Errores accionables, nunca stack traces      ← reglas.md 6
- VII. Tests unitarios con Vitest                  ← reglas.md 7
- VIII. Sin dependencias innecesarias              ← reglas.md 8

Secciones añadidas:
- Requisitos de salida en terminal                 ← reglas.md 9
- Distribución, flujo de desarrollo y puertas de calidad ← reglas.md 10 + gates de CI
- Governance (procedimiento de enmienda, versioning, cumplimiento)

Secciones eliminadas: ninguna (documento inicial).

TRAZABILIDAD: las 10 reglas de `reglas.md` (D:\Astro\reglas.md) están cubiertas 1:1
entre los principios I–VIII y las dos secciones adicionales.

PENDIENTES / DERIVACIONES (requieren confirmación del usuario):
- Los mensajes al usuario deben escribirse en español. NO figura en `reglas.md`;
  se derivó de `D:\Astro\CLAUDE.md`, que obliga a escribir en español. Si no es
  correcto para el CLI, eliminar esa viñeta de la sección de salida en terminal.
- `reglas.md` vive fuera del repositorio (en D:\Astro\). La constitución es
  deliberadamente autocontenida para no depender de un archivo externo al repo.
-->

# task-cli Constitution

## Core Principles

### I. TypeScript sobre Node.js LTS

- Todo el código fuente MUST estar escrito en TypeScript y MUST ejecutarse sobre
  Node.js en versión LTS.
- La ejecución directa MUST ser posible con `tsx` o equivalente, sin paso de
  compilación obligatorio.
- El paquete MUST declarar `bin` en `package.json` y MUST ser instalable con
  `npm install -g`.

**Rationale**: un CLI que se distribuye globalmente tiene que arrancar en la
máquina del usuario sin toolchain adicional ni paso de build.

### II. Persistencia local en SQLite con better-sqlite3

- El almacenamiento MUST ser SQLite mediante `better-sqlite3`. Ningún otro motor
  de base de datos está permitido.
- La base de datos MUST residir en un archivo local dentro del directorio del
  usuario: `~/.task-cli/tasks.db`.
- El estado MUST persistir únicamente en ese archivo. No se permite estado en
  memoria entre invocaciones ni servicios externos.

**Rationale**: un gestor de tareas personal debe funcionar sin conexión, ser
portable y respaldarse copiando un solo archivo.

### III. Estructura plana, organizada por funcionalidad

- El código MUST organizarse por funcionalidad en `commands/`, `db/` y
  `utils/`.
- MUST NOT introducirse clean architecture, capas de abstracción ni
  dependencias entre capas (domain / application / infrastructure).
- El código nuevo MUST residir en el módulo de su funcionalidad. Lo compartido
  MUST limitarse a `utils/`.

**Rationale**: en un CLI de este tamaño la indirección supera al beneficio; la
organización por funcionalidad mantiene el repositorio navegable sin capas.

### IV. Estilo funcional sobre clases

- El código MUST usar funciones puras siempre que sea posible. Las clases
  quedan reservadas a casos que exijan estado o ciclo de vida propio.
- Variables y funciones MUST usar `camelCase`.
- `PascalCase` MUST usarse exclusivamente para tipos e interfaces.

**Rationale**: menos `this` y menos estado implícito; funciones puras se prueban
y se componen de forma aislada.

### V. Commander.js como único parseo de argumentos

- El parseo de argumentos y el registro de comandos MUST delegarse íntegramente
  en Commander.js.
- Cada comando MUST registrarse con nombre, descripción y argumentos
  explícitos. MUST NOT parsearse `process.argv` manualmente.

**Rationale**: un único punto de parseo garantiza ayuda coherente, validación
uniforme y códigos de salida consistentes entre comandos.

### VI. Errores accionables, nunca stack traces

- MUST NOT imprimirse stack traces al usuario bajo ninguna circunstancia.
- Los errores MUST reportarse como mensajes claros y accionables: qué falló y
  qué debe hacer el usuario a continuación.
- El proceso MUST terminar con código de salida `0` en caso de éxito y `1` ante
  cualquier error.

**Rationale**: el usuario final no puede actuar sobre un stack trace; el único
output que ve debe ser accionable.

### VII. Tests unitarios con Vitest para la lógica de negocio

- Los tests MUST escribirse con Vitest.
- TODA lógica de negocio MUST tener test unitario. Esto incluye transiciones de
  estado, validaciones, ordenamiento, filtrado y persistencia.
- NO se establece un umbral mínimo de cobertura. La cobertura se evalúa caso
  por caso contra la obligación anterior, no contra un porcentaje.

**Rationale**: la lógica de negocio es lo único que puede romperse en silencio
en un CLI sin interfaz gráfica que lo delate.

### VIII. Sin dependencias innecesarias

- MUST NOT añadirse ninguna librería cuando el comportamiento se resuelva con
  unas pocas líneas de código.
- MUST NOT usarse ORMs. El acceso a datos MUST escribirse directamente con la
  API de `better-sqlite3`.
- Toda dependencia nueva MUST justificarse por escrito: alternativa evaluada,
  coste en build y en mantenimiento.

**Rationale**: un CLI se instala globalmente; cada dependencia es peso de
instalación, superficie de ataque y deuda de mantenimiento.

## Requisitos de salida en terminal

- Los listados MUST renderizarse como tablas (con `cli-table3` o equivalente)
  con columnas alineadas y anchos estables.
- El color MUST usarse únicamente para comunicar estado y prioridad. MUST NOT
  colorearse el resto del output.
- El output MUST permanecer legible sin color cuando `NO_COLOR` esté definido
  o cuando la salida no sea un TTY (redirección o pipe).
- Los mensajes al usuario MUST escribirse en español.

**Rationale**: el terminal es la única interfaz de este producto; una salida
alineada y con color acotado hace la información escaneable sin volverla
ilegible al redirigirla.

## Distribución, flujo de desarrollo y puertas de calidad

- Puerta de instalación: el paquete MUST instalarse correctamente con
  `npm install -g` y el binario MUST quedar disponible en el PATH.
- Puerta de tests: la suite de Vitest MUST pasar antes de integrar cualquier
  cambio.
- Puerta de cobertura: todo cambio en lógica de negocio MUST incluir o
  actualizar sus tests en el mismo commit (principio VII).
- Revisión: cada PR MUST verificar el cumplimiento de los principios I a VIII y
  MUST documentar en la descripción cualquier excepción, con su justificación.

**Rationale**: las reglas 10 y 7 de `reglas.md` sólo se sostienen si los puntos
de verificación son explícitos y se aplican de forma uniforme.

## Governance

Esta constitución prevalece sobre cualquier otra práctica, guía o convención del
proyecto. Cuando una regla de `reglas.md` o de otra documentación entre en
conflicto con esta constitución, prevalece la constitución.

**Procedimiento de enmienda**:

1. Proponer la enmienda indicando el principio o sección afectada y el
   principio de retorno (por qué la regla anterior no basta).
2. Obtener aprobación explícita antes de aplicar el cambio.
3. Si la enmienda rompe comportamiento existente, adjuntar un plan de migración.
4. Registrar el cambio en el reporte de impacto al actualizar este archivo.

**Política de versionado** (semver sobre el número de constitución):

- MAJOR: eliminación o redefinición de un principio que rompa el código o los
  procesos existentes.
- MINOR: alta de un principio o sección, o ampliación material de la guía
  existente.
- PATCH: aclaraciones, redacción, correcciones de typos y refinamientos no
  semánticos.

**Cumplimiento**:

- Toda revisión de código y todo PR MUST comprobar el cumplimiento de esta
  constitución antes de aprobarse.
- La complejidad o el coste que no se justifique MUST quedar escrito en la PR.
  MUST NOT aceptarse complejidad sin justificación explícita.
- Las dependencias nuevas MUST justificarse según el principio VIII.

**Documentos de referencia**: `reglas.md` es el documento de origen de los
principios I a VIII. Esta constitución es normativa y autocontenida; `reglas.md`
no se carga en tiempo de ejecución.

**Version**: 1.0.0 | **Ratified**: 2026-09-30 | **Last Amended**: 2026-09-30