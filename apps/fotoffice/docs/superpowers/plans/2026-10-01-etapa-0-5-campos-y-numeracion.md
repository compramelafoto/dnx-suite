# Etapa 0.5 · Campos personalizados y numeración — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Campos personalizados tipados por organización para Cliente, Socio y Consulta (ficha, listados, búsqueda, exportación, historial) y numeración configurable con contador atómico, estrenada en las consultas de Captación.

**Architecture:** Definiciones y valores en tablas propias (`lib/campos/`), polimórficas por `(entityType, entityId)` y siempre acotadas por workspace; un ayudante agrega columnas, filtros, búsqueda y exportación a las definiciones de listado existentes (0.2). La numeración (`lib/numeracion/`) usa una tabla de secuencias con `UPDATE … RETURNING` dentro de la transacción del alta y una tabla de números asignados por registro.

**Tech Stack:** Next.js 16 App Router, Prisma (`packages/db/prisma/schema.prisma`), Vitest 3 (node; usar la base en memoria `apps/fotoffice/lib/circuitos/base-en-memoria.ts` para pruebas de comportamiento), Tailwind v4 `--fo-*`, lucide-react, pnpm.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-01-etapa-0-5-campos-y-numeracion-design.md`

## Global Constraints

- Rama `feat/fotoffice-campos-y-numeracion` desde `feat/fotoffice-motor-de-etapas` (PR 290). Worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-campos`.
- pnpm; **ninguna dependencia nueva**.
- Ninguna columna nueva en tablas existentes; sólo las seis tablas nuevas.
- Migración a mano `packages/db/prisma/migrations/20261004120000_fotoffice_campos_y_numeracion/migration.sql`; **no se aplica**; nada de `prisma migrate`/`db push` remotos; `prisma validate`/`generate` sí.
- `workspaceId` siempre de la sesión; un registro (cliente, socio, consulta) se valida contra el workspace antes de leer o escribir sus valores; ids ajenos → "no encontrado".
- Permisos (`puede`): editar valores = `operar`; configurar campos y numeración = `configurar`.
- Tipos de registro: `CLIENTE`, `SOCIO`, `CONSULTA` (activos); `PRESUPUESTO`, `PEDIDO`, `CONTRATO`, `PROYECTO` (reservados, no se ofrecen en la UI).
- Tipos de campo: `TEXTO`, `TEXTO_LARGO`, `NUMERO`, `FECHA`, `SI_NO`, `LISTA`, `ENLACE`. Nombre 1–60; Texto corto ≤ 200; Texto largo ≤ 4000; Enlace `http(s)://` ≤ 500; máximo 40 campos activos por tipo de registro.
- Secuencias: `CONSULTA` (inicial: con año, 4 dígitos, sin prefijo), `PRESUPUESTO`, `PEDIDO`, `CONTRATO`, `PROYECTO` (inicial: sin año, sin prefijo, 1 dígito, próximo 1). Prefijo ≤ 8 `[A-Za-z0-9-]`; dígitos 1–8; el próximo número no puede bajar del último usado. Formato con año: `{prefijo}{AAAA}-{N con ceros}`; sin año: `{prefijo}{N con ceros}`.
- Hora `America/Argentina/Buenos_Aires` para el año de los números y para mostrar fechas.
- DNX (publicSlug `dnx-estudio`) arranca con el campo de Clientes "Archivos del cliente" (`ENLACE`), creado en código al abrir Configuración → Campos o la ficha de un cliente.
- Textos en español rioplatense; Socios con vocabulario del workspace.
- Pruebas `pnpm --filter fotoffice exec vitest run <ruta>`; tsc `NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit`; build igual. Borrar `apps/fotoffice/.next/cache` después de cada build. No commitear `apps/*/tsconfig.tsbuildinfo`.
- Commits en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final; sin merge nunca.

## Decisiones tomadas al planificar (rulings)

1. Spec y plan fueron decididos sin consultar a Daniel por su pedido explícito; cada **[decisión]** del spec queda listada en el PR para revisión.
2. La asignación de números usa SQL crudo (`$executeRaw`/`$queryRaw` con template etiquetado) para el `UPDATE … RETURNING` atómico; la base en memoria emula sólo esa sentencia.
3. El historial de cambios de campos de Cliente/Socio entra a la línea de tiempo 0.3 con un proveedor nuevo `campos`; en Consulta se muestra en el historial de su ficha (0.4).

## Mapa de archivos

- Base: schema + `migrations/20261004120000_fotoffice_campos_y_numeracion/migration.sql` + `packages/db/docs/MIGRACION-CAMPOS-Y-NUMERACION.md`.
- `apps/fotoffice/lib/campos/`: `constantes.ts`, `validacion.ts` (puro), `definiciones.ts`, `valores.ts`, `semillas.ts`, `listado.tsx` (ayudante), `acceso.ts`; pruebas al lado.
- `apps/fotoffice/lib/numeracion/`: `formato.ts` (puro), `secuencias.ts`, `asignar.ts`; pruebas al lado.
- Acciones: `apps/fotoffice/app/actions/campos.ts`; `apps/fotoffice/app/workspace/configuracion/{campos,numeracion}/{page.tsx,actions.ts,*.tsx}`.
- Componentes: `apps/fotoffice/components/campos/{mas-datos.tsx,editor-valores.tsx,valor.tsx}`.
- Integraciones: `lib/ficha/proveedores/campos.ts` + `index.ts`; fichas `app/(shell)/clientes/[clientId]`, `app/(shell)/members/[id]`, `app/(shell)/captacion/[id]`; listados `lib/clients/listado.tsx`, `lib/members/listado.tsx`, `lib/service-leads/listado.tsx`; `lib/circuitos/eventos.ts` (enganche), `app/actions/service-lead.ts`, `lib/circuitos/tablero.ts` + `components/circuitos/tarjeta.tsx`.

---

### Task 1: Tablas y migración

**Files:** schema, migration.sql, `apps/fotoffice/lib/campos/migracion.test.ts`.

**Produces:** modelos `FotofficeCustomField`, `FotofficeCustomFieldOption`, `FotofficeCustomValue`, `FotofficeCustomValueChange`, `FotofficeSequence`, `FotofficeSequenceChange`, `FotofficeRecordNumber` (siete tablas: la de opciones cuenta aparte).

- [ ] Modelos según spec §4.1–4.2, con: `FotofficeCustomField` único (workspaceId, entityType, key), índice (workspaceId, entityType, archivedAt, order); `FotofficeCustomFieldOption` índice (fieldId, order); `FotofficeCustomValue` único (fieldId, entityId), índices (workspaceId, entityType, entityId) y (fieldId, optionId), `valueNumber Decimal(18,4)`; `FotofficeCustomValueChange` índice (workspaceId, entityType, entityId, createdAt); `FotofficeSequence` único (workspaceId, key); `FotofficeSequenceChange` índice (workspaceId, key, createdAt); `FotofficeRecordNumber` únicos (entityType, entityId) y (workspaceId, sequenceKey, year, value) — como `year` puede ser null, en el SQL dos índices únicos parciales: con año (`WHERE "year" IS NOT NULL`) y sin año (`(workspaceId, sequenceKey, value) WHERE "year" IS NULL`). CHECKs: `type` en la lista; `entityType` en la lista (activos + reservados); `digits BETWEEN 1 AND 8`; `nextValue >= 1`. FKs con `onDelete: Cascade` a Workspace; opciones y valores a su campo (Cascade); valor→opción SetNull. Relaciones inversas virtuales en `Workspace`.
- [ ] SQL con `prisma migrate diff` sin base + índices parciales + CHECKs; `prisma validate`/`generate`.
- [ ] Prueba de fuente: no altera tablas existentes; crea las siete tablas; índices parciales y CHECKs presentes.
- [ ] tsc de fotoffice, compramelafoto, clickaton, fotorank. Commit `Campos y numeración: tablas (SQL sin aplicar)`.

### Task 2: Validación y formato puros

**Files:** `lib/campos/constantes.ts`, `lib/campos/validacion.ts`, `lib/numeracion/formato.ts` + pruebas.

**Produces:**
- `TIPOS_REGISTRO_ACTIVOS`, `TIPOS_REGISTRO`, `TIPOS_CAMPO`, `ETIQUETA_TIPO_CAMPO`, `MAX_CAMPOS = 40`.
- `claveDeCampo(nombre): string` (minúsculas, sin acentos, `_`, ≤ 40; sufijo `_2`, `_3` lo resuelve quien crea si choca).
- `validarNombreCampo(raw): string | null`.
- `validarValor(tipo, raw: unknown, opcionesValidas: string[]): { ok: true; valor: ValorCampo | null } | { ok: false; error: string }` — `null` = vacío; Fecha `YYYY-MM-DD` real; Número con coma o punto decimal, hasta 4 decimales; Enlace `http(s)://`; Sí/No `"si"|"no"`; Lista un id de `opcionesValidas`. `ValorCampo = { texto?: string; numero?: string; fecha?: string; booleano?: boolean; opcionId?: string }`.
- `textoLegible(tipo, valor, etiquetasDeOpcion): string` (para historial y exportación; fecha dd/mm/aaaa, número con coma, Sí/No).
- `formatearNumero({ prefix, withYear, digits }, year: number | null, value: number): string` y `validarConfigSecuencia(...)` (prefijo, dígitos, próximo ≥ mínimo).

- [ ] Pruebas que fallan (casos de borde de cada tipo; fechas imposibles; formato con/sin año/prefijo/ceros) → implementar → pasan. Commit `Campos y numeración: validación por tipo y formato de números`.

### Task 3: Definiciones de campos y semilla

**Files:** `lib/campos/definiciones.ts`, `lib/campos/semillas.ts`, `lib/campos/acceso.ts` + pruebas.

**Produces:** (todas reciben `ctx = { workspaceId, userId, userLabel, role }`; las de escritura exigen `configurar` adentro)
- `listarCampos(workspaceId, entityType, { incluirArchivados? })` (con opciones activas, por `order`), cacheable por request (`cache` de React como `loadPersonVocabulary`).
- `crearCampo`, `editarCampo` (nombre, obligatorio, showInList; **tipo no cambia si hay valores**), `reordenarCampos`, `archivarCampo`/`desarchivarCampo`, `borrarCampo` (sólo sin valores; si no → "Este campo tiene datos: archivalo."), `crearOpcion`, `renombrarOpcion`, `archivarOpcion`, `reordenarOpciones`; tope de 40 activos ("Ya hay 40 campos activos para … Archivá alguno.").
- `asegurarCamposIniciales(workspaceId, slug)` — DNX: crea "Archivos del cliente" (`ENLACE`, `CLIENTE`) si no existe ningún campo de clientes; idempotente.
- `contextoDeCampos()` en `acceso.ts` — patrón de `lib/ficha/acceso.ts` (nunca redirige; null ante cualquier falta).

- [ ] Pruebas con la base en memoria: aislamiento por workspace; tope 40; no cambiar tipo con valores; borrar vs archivar; claves únicas con sufijo; semilla idempotente. Commit `Campos personalizados: definiciones, opciones y campo inicial de DNX`.

### Task 4: Valores, historial y acciones

**Files:** `lib/campos/valores.ts`, `app/actions/campos.ts` + pruebas.

**Produces:**
- `registroDelWorkspace(workspaceId, entityType, entityId): Promise<boolean>` (Cliente → `client`, Socio → `member`, Consulta → `serviceSalesLead`, siempre con `workspaceId`).
- `valoresDe(workspaceId, entityType, ids: string[]): Promise<Map<string, Map<string /*fieldId*/, ValorGuardado>>>` en una consulta.
- `guardarValores(ctx, entityType, entityId, entrada: Record<string /*fieldId*/, unknown>)` — valida cada campo activo del tipo (`validarValor`), exige obligatorios, en una transacción: upsert/borrado de valores, una fila `FotofficeCustomValueChange` por campo que cambió (texto legible antes/después), devuelve `{ ok } | { ok: false; errores: Record<fieldId, string> }`. Exige `operar`.
- `cambiosDe(workspaceId, entityType, entityId, { antesDe?, take })` para historial.
- Acción `guardarValoresAction({ entityType, entityId, valores })` (`"use server"`, sólo async; forma → contexto → módulo del tipo encendido (`clients` / `members` / `service-leads`) → `operar` → registro del workspace) y revalida la ficha.

- [ ] Pruebas: valor de otro workspace no se lee ni escribe; obligatorio vacío → error de ese campo; sin cambios → sin historial; cambio → una fila con antes/después legibles; opción archivada no se acepta como nuevo valor. Commit `Campos personalizados: valores con historial y acción de guardado`.

### Task 5: Numeración

**Files:** `lib/numeracion/secuencias.ts`, `lib/numeracion/asignar.ts` + pruebas; ampliar `lib/circuitos/base-en-memoria.ts` para emular sólo la sentencia de asignación.

**Produces:**
- `SECUENCIAS_INICIALES` (spec §3.4) y `asegurarSecuencias(workspaceId)` (idempotente, crea las que falten).
- `leerSecuencias(workspaceId)`, `configurarSecuencia(ctx, key, { prefix, withYear, digits, nextValue })` (exige `configurar`; rechaza bajar por debajo del máximo usado del año corriente — o de todos si sin año —: "No se puede volver a un número ya usado."; registra `FotofficeSequenceChange`), `vistaPrevia(config, hoy)`.
- `asignarNumero(tx, { workspaceId, key, entityType, entityId, fecha: Date }): Promise<{ year: number | null; value: number; display: string }>` — dentro de la transacción del llamador: `asegurarSecuencias` previo si hace falta; una sentencia `UPDATE "FotofficeSequence" SET "nextValue" = CASE WHEN "withYear" AND "currentYear" IS DISTINCT FROM $año THEN 2 ELSE "nextValue" + 1 END, "currentYear" = CASE WHEN "withYear" THEN $año ELSE NULL END WHERE "workspaceId" = $ws AND "key" = $key RETURNING …` que devuelve el valor asignado (1 si reinició, `nextValue` previo si no); crea `FotofficeRecordNumber`; si el registro ya tenía número lo devuelve sin consumir otro. `$año` = año AR de `fecha`.
- `numeroDe(workspaceId, entityType, ids[])` en lote.

- [ ] Pruebas: secuencial; reinicio anual; ya numerado → mismo número; config que baja → error; vista previa; aislamiento. Revisar el SQL contra la migración (nombres entre comillas, parámetros enlazados). Commit `Numeración: secuencias configurables con asignación atómica`.

### Task 6: Configuración → Campos y Numeración

**Files:** `app/workspace/configuracion/campos/*`, `app/workspace/configuracion/numeracion/*`; entradas en los tres menús de Configuración (como Ficha y Circuitos).

- [ ] Campos: pestañas Clientes / Socios (vocabulario) / Consultas (sólo con su módulo encendido); lista con tipo, obligatorio, en listado, ordenar (arrastrar + subir/bajar accesibles), archivar/desarchivar/borrar, opciones de Lista; `asegurarCamposIniciales` al abrir. `configurar` antes de leer.
- [ ] Numeración: una fila por secuencia con prefijo, año, dígitos, próximo número, vista previa en vivo y último usado; historial de cambios; `asegurarSecuencias` al abrir.
- [ ] Pruebas de fuente (permiso antes de leer, acciones sólo async) + pruebas de las acciones. Build. Commit `Configuración: campos personalizados y numeración`.

### Task 7: "Más datos" en las fichas

**Files:** `components/campos/*`, `lib/ficha/proveedores/campos.ts` (+ registro en `proveedores/index.ts` y `proveedoresParaWorkspace`), fichas de Cliente, Socio y Consulta.

- [ ] Tarjeta "Más datos" (server) con los campos activos y sus valores; modo edición (client) con un control por tipo, errores por campo, `guardarValoresAction`; obligatorios vacíos en rojo; sólo con `operar` se ve "Editar".
- [ ] Proveedor `campos` en la línea de tiempo de Cliente/Socio (tipo "cambios"); en la ficha de Consulta, los cambios se intercalan en su historial.
- [ ] Llamar `asegurarCamposIniciales` en la ficha de cliente.
- [ ] Pruebas: proveedor acotado por workspace/persona; componentes cliente sin `@repo/db`; guarda antes de leer. Commit `Fichas: tarjeta Más datos con campos personalizados`.

### Task 8: Campos en los listados

**Files:** `lib/campos/listado.tsx` + integración en `lib/clients/listado.tsx`, `lib/members/listado.tsx`, `lib/service-leads/listado.tsx` (en su `cargar(ctx)` del registro).

- [ ] Ayudante `camposParaListado(ctx, entityType)` → `{ columnas, filtros, condicionBusqueda(q), columnasExport, cargarValores(ids) }`: columnas secundarias para `showInList`; filtros `cf_<key>` (Lista: opción con sus opciones activas; Sí/No: siNo; Fecha: período); búsqueda `OR` sobre valores de texto/enlace vía subconsulta de entityIds del workspace (tope + aviso como en 0.4 R9); exportación de todos los activos con `textoLegible`. Las claves de filtro no chocan con `PARAMETROS_RESERVADOS`.
- [ ] Pruebas: columnas/filtros sólo de campos activos del workspace; filtro por opción traduce a la subconsulta acotada; búsqueda; exportación. Commit `Listados: columnas, filtros, búsqueda y exportación de campos personalizados`.

### Task 9: Captación numerada

**Files:** `app/actions/service-lead.ts`, `lib/circuitos/eventos.ts` (enganche), `lib/circuitos/tablero.ts`, `components/circuitos/tarjeta.tsx`, `lib/service-leads/listado.tsx`, `app/(shell)/captacion/[id]/page.tsx`.

- [ ] Alta: dentro del try existente, `asignarNumero` (CONSULTA) junto al alta; si falla, la consulta queda creada sin número (nunca falla el alta).
- [ ] Enganche (0.4): además numera, por fecha de alta y con el año de su alta, las consultas sin número del workspace, dentro del mismo tope por llamada y en la misma transacción por consulta; `quedan` cuenta también las sin número.
- [ ] Tarjeta del tablero, lista (columna "N°", ordenable por número, búsqueda por número/texto mostrado) y título de la ficha muestran el número.
- [ ] Pruebas: alta numerada; falla de numeración no rompe el alta; enganche numera viejas en orden y una sola vez; búsqueda por número. Commit `Captación: cada consulta tiene su número`.

### Task 10: Documento de migración y verificación

- [ ] `packages/db/docs/MIGRACION-CAMPOS-Y-NUMERACION.md` con la estructura de `MIGRACION-MOTOR-DE-ETAPAS.md` (qué hace, **en negrita** qué pantallas leen las tablas, orden, checksum, verificación de sólo lectura, vuelta atrás, prueba manual: crear un campo Lista y filtrarlo, editar Más datos de un socio y verlo en su historial, numerar una consulta nueva y buscarla, configurar Presupuestos con prefijo y ver la vista previa, exportar con campos), y una nota de que la numeración de DNX se fija desde Alboom en la etapa 8.
- [ ] Verificación completa: vitest de fotoffice, tsc fotoffice + compramelafoto + clickaton + fotorank, build fotoffice (borrar `.next/cache`). Commit `Campos y numeración: documento de migración`.
