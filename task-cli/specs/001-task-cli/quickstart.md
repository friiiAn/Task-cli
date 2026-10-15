# Quickstart: validación de `task-cli`

**Feature**: 001-task-cli | **Fecha**: 2026-09-30 | **Plan**: [plan.md](./plan.md)
**Contrato**: [contracts/cli.md](./contracts/cli.md) | **Modelo**: [data-model.md](./data-model.md)

Guía para comprobar de extremo a extremo que la funcionalidad está implementada y cumple los
criterios de éxito. **No** es un documento de implementación: aquí no hay código, ni migración, ni
cuerpos de funciones.

---

## 1. Prerrequisitos

| Requisito | Versión mínima | Cómo comprobarlo |
|---|---|---|
| Node.js | 22.12.0 (objetivo de desarrollo: 24 LTS) | `node --version` |
| npm | 10 o superior | `npm --version` |
| Herramientas de compilación | **Ninguna** | `better-sqlite3@13` usa N-API y trae precompilados |

## 2. Preparación

```bash
npm install
npm run build          # genera dist/ a partir de src/
npm test               # suite de Vitest
npm run typecheck      # tsc --noEmit
```

Modo de desarrollo, sin compilar (R-002):

```bash
node src/cli.ts --help
```

Instalación global (puerta de instalación de la constitución):

```bash
npm link               # o: npm install -g .
task-cli --help
```

## 3. Aislamiento de los datos de prueba

Todas las escenarios de abajo se ejecutan contra una base de datos **temporal**, para no tocar
`~/.task-cli/tasks.db` (R-008). En PowerShell:

```powershell
$env:TASK_CLI_HOME = Join-Path $env:TEMP "task-cli-quickstart"
Remove-Item -Recurse -Force $env:TASK_CLI_HOME -ErrorAction SilentlyContinue
```

En bash/zsh, exportar `TASK_CLI_HOME`. Para volver al comportamiento normal, eliminar la variable.

La primera invocación crea el directorio y `tasks.db` sin intervención manual (**SC-004**).

---

## 4. Escenarios de validación

Cada escenario indica el comando, el resultado esperado y la referencia que satisface. `TASK_CLI_HOME
apunta siempre al directorio temporal de arriba.

### E-01. Creación con valores por defecto (US1-A1, FR-002, FR-004)

```bash
task-cli add "Estudiar TypeScript"
```

Esperado: `Tarea 1 creada: "Estudiar TypeScript" (todo, medium)`, salida 0, y existe
`$TASK_CLI_HOME/tasks.db` (SC-004).

### E-02. Creación con prioridad y descripción, y autoincremento (US1-A2, FR-002, FR-003)

```bash
task-cli add --priority high "Preparar presentación" --description "Slides para demo"
```

Esperado: ID 2, prioridad `high`, descripción almacenada.

```bash
task-cli delete 2 --force && task-cli add "Otra tarea"
```

Esperado: la nueva tarea recibe ID **3**, no 2. Verifica que los IDs no se reutilizan tras un
borrado (FR-003, R-010).

### E-03. Listado y orden descendente (US2-A3, FR-005, FR-007)

```bash
task-cli list
```

Esperado: tabla con columnas `ID`, `Título`, `Estado`, `Prioridad`, `Creada`; las más recientes
primero.

### E-04. Filtros por estado y por prioridad (US2-A1, US2-A2, FR-006)

```bash
task-cli list --status todo
task-cli list --priority high
```

Esperado: cada listado muestra sólo las tareas que cumplen el filtro.

### E-05. Filtro combinado (caso límite: AND lógico)

```bash
task-cli list --status todo --priority high
```

Esperado: sólo las tareas que son **a la vez** `todo` y `high`.

### E-06. Transición inválida rechazada (US3-A1, FR-008, SC-003)

```bash
task-cli done 1
```

Esperado: salida **1** en `stderr` con el mensaje de transición no permitida; `task-cli list`
confirma que la tarea 1 sigue en `todo`.

### E-07. Transiciones válidas (US3-A2, US3-A3, US3-A4, US3-A5)

```bash
task-cli start 1   # todo -> in-progress
task-cli todo 1    # in-progress -> todo
task-cli start 1   # in-progress
task-cli done 1    # in-progress -> done
task-cli todo 1    # done -> todo (reabrir)
```

Esperado: cada comando devuelve 0 y el mensaje `Tarea 1 movida a <estado>.`

### E-08. ID inexistente (caso límite, FR-012)

```bash
task-cli start 999
```

Esperado: salida 1, `Error: no existe ninguna tarea con el ID 999.`, sin stack trace.

### E-09. Actualización parcial (US4-A1, US4-A2, FR-009)

```bash
task-cli update 1 --priority high
```

Esperado: sólo cambia la prioridad; título, estado, descripción y `created_at` intactos.

```bash
task-cli update 1 --title "Comprar pan y leche" --description "Supermercado"
```

Esperado: cambian título y descripción; el ID, el estado y la `created_at` se conservan.

### E-10. Eliminación con confirmación (US5-A1, FR-010)

```bash
task-cli delete 1
```

Respondiendo `n`: esperado `Operación cancelada.` y salida **0**, tarea intacta.
Respondiendo `s`: esperado `Tarea 1 eliminada.` y salida 0, y la tarea ya no aparece en `list`.

### E-11. Eliminación con `--force` (US5-A2)

```bash
task-cli delete 1 --force
```

Esperado: eliminación inmediata, sin pregunta, salida 0.

### E-12. Título vacío rechazado (caso límite, FR-002)

```bash
task-cli add "   "
```

Esperado: salida 1, `Error: el título no puede estar vacío.`, y no se crea ninguna tarea.

### E-13. Valores inválidos (caso límite, FR-014)

```bash
task-cli add "X" --priority urgent
task-cli list --status pending
```

Esperado en ambos: salida 1 con el mensaje que enumera las opciones válidas.

### E-14. Salida sin color al redirigir (SC-005, OUT-2)

```bash
task-cli list > tareas.txt
```

Esperado: `tareas.txt` **no** contiene el byte `0x1B` y conserva las columnas alineadas.

```bash
NO_COLOR=1 task-cli list        # bash/zsh
$env:NO_COLOR='1'; task-cli list # PowerShell
```

Esperado: idéntico al anterior.

### E-15. Base de datos vacía (SC-004, borde de `list`)

```bash
TASK_CLI_HOME=<dir nuevo y vacío> task-cli list
```

Esperado: `No hay tareas.`, salida 0.

### E-16. Renderizado con 100 tareas (SC-002)

Generar 100 tareas (por ejemplo con un bucle sobre `task-cli add`) y listar. Esperado: 100 filas,
tabla alineada, salida 0.

---

## 5. Comprobaciones automatizadas que deben pasar

| Puerta | Comando | Origen |
|---|---|---|
| Suite de tests | `npm test` | Principio VII, puerta de tests de la constitución |
| Tipos | `npm run typecheck` | Principio I |
| Compilación | `npm run build` | Principio I, puerta de distribución |
| Instalación global | `npm link` && `task-cli --help` | Principio I, puerta de instalación |

Las pruebas unitarias cubren, como mínimo, la máquina de estados (las 9 combinaciones de la tabla de
`data-model.md` §2), la validación de título/estado/prioridad, el filtrado combinado, el orden
descendente y la confirmación de borrado. La persistencia se prueba contra una base temporal
aislada mediante `TASK_CLI_HOME`.

---

## 6. Lista de comprobación de salida

- [ ] E-01 a E-16 pasan en Windows (PowerShell), Linux y macOS
- [ ] Ninguna salida de error contiene un stack trace (OUT-5)
- [ ] Todos los mensajes están en español (OUT-4)
- [ ] `task-cli --help` lista los 7 comandos con sus aliases
