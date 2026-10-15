# Tasks: task-cli

**Input**: Design documents from /specs/001-task-cli/ (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required).

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create project structure per implementation plan (src/{commands,db,utils}, tests/{unit,integration})
- [X] T002 Initialize TypeScript ESM project with dependencies: better-sqlite3@^13.0.3, commander@^15.0.0, cli-table3@^0.6.5
- [X] T003 Add dev dependencies: typescript@^7.0.2, vitest@^5.0.3, @types/node@^26.6.4, @types/better-sqlite3@^9.6.0
- [X] T004 Configure package.json: type module, bin task-cli -> dist/cli.js, scripts build/typecheck/test/prepack
- [X] T005 Create tsconfig.json (nodenext, erasableSyntaxOnly, rewriteRelativeImportExtensions, outDir dist)
- [X] T006 Create vitest.config.ts with TASK_CLI_HOME isolation per test
- [X] T007 Create .gitignore (node_modules/, dist/, *.log, .env*)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T008 Implement utils/errors.ts: CliError class
- [X] T009 Implement utils/paths.ts: resolve ~/.task-cli with TASK_CLI_HOME override
- [X] T010 Implement utils/task.ts: types/constants/transitions (no enum, as const) True
- [X] T011 Implement utils/output.ts: cli-table3, NO_COLOR/TTY True
- [X] T012 Implement utils/prompt.ts: confirmation True
- [X] T013 Implement db/schema.ts: v1 schema with WAL/indexes/CHECK
- [X] T014 Implement db/connection.ts: lazy open, create dir
- [X] T015 Implement db/taskRepository.ts: CRUD with prepared statements True
- [X] T016 Implement src/cli.ts: Commander + error handler + exit codes 0/1

**Checkpoint**: Foundation ready.

---

## Phase 3: User Story 1 - Crear tareas desde la terminal (Priority: P1)
**Goal**: Crear/listar tareas.
**Independent Test**: task-cli add 'Comprar pan' crea tarea todo con ID 1, prioridad medium.

- [X] T017 Implement commands/add.ts: validation/trim/max200/defaults True US1
- [X] T018 Implement commands/list.ts: table, filters AND, order desc, empty messages True US1
- [X] T019 Wire add/list into cli.ts False US1
- [X] T020 Unit tests: utils/task True
- [X] T021 Integration tests: add True
- [X] T022 Integration tests: list True

---
## Phase 4: User Story 2 - Listar y filtrar tareas (Priority: P1)

- [X] T023 Verify combined filters and empty messages False US2
- [X] T024 Unit test output color/TTY/NO_COLOR True US2

---
## Phase 5: User Story 3 - Cambiar estado con validación (Priority: P1)

- [X] T025 Implement commands/status.ts (start/done/todo/status) True US3
- [X] T026 Wire into cli.ts False US3
- [X] T027 Integration tests: transitions and invalid todo->done True US3

---
## Phase 6: User Story 4 - Actualizar tarea (Priority: P2)

- [X] T028 Implement commands/update.ts (partial updates) True US4
- [X] T029 Wire update/edit into cli.ts False US4
- [X] T030 Integration tests: partial/full update True US4

---
## Phase 7: User Story 5 - Eliminar con confirmación (Priority: P2)

- [X] T031 Implement commands/delete.ts (confirm + --force, cancel returns 0) True US5
- [X] T032 Wire delete/rm into cli.ts False US5
- [X] T033 Integration tests: cancel/force/nonexistent True US5

---
## Phase 8: Polish & Cross-Cutting Concerns

- [X] T034 Ensure concurrency (wait up to 5s, actionable error if locked)
- [X] T035 Validate Spanish messages, no stack traces, exit codes 0/1
- [X] T036 Run quickstart E-01..E-16 validation
- [X] T037 Build (tsc), typecheck, full tests; verify dist/cli.js
- [ ] T038 npm pack/global smoke test (optional)