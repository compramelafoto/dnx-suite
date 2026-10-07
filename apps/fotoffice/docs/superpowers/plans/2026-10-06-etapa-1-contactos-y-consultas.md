# Etapa 1 · Contactos y Consultas — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada consulta atada a su contacto, con categorías por grupo (Boda/Evento/Trabajo), datos del evento, origen, valor, participantes, altas manuales/rápidas/web/CSV, aviso al responsable, siguiente acción editable, acciones en lote y contactos ampliados.

**Architecture:**
- Tablas nuevas sólo de FOTOFFICE alrededor de `ServiceSalesLead` y `Client`, que no reciben columnas:
  - `FotofficeConsulta` (1:1 con la consulta);
  - catálogos: categorías, orígenes y roles de participante;
  - participantes;
  - `FotofficeContactoPerfil` (1:1 con el cliente);
  - ajustes de aviso.
- Un único camino de alta (`lib/consultas/alta.ts`) lo usan:
  - el formulario manual y el alta rápida;
  - el formulario web;
  - la importación.
  - También lo usa el enganche que ata las consultas viejas.
- Las pantallas reutilizan el listado (0.2), la ficha (0.3), el motor de etapas (0.4), los campos y la numeración (0.5) y las plantillas (0.6).

**Tech Stack:** Next.js 16 App Router, Prisma (`packages/db/prisma/schema.prisma`), Vitest 3 (base en memoria `apps/fotoffice/lib/circuitos/base-en-memoria.ts`), Tailwind v4 `--fo-*`, lucide-react, pnpm.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-06-etapa-1-contactos-y-consultas-design.md`

## Global Constraints

- **Rama y worktree:**
  - rama `feat/fotoffice-etapa-1-consultas`, desde `origin/main` después del PR 402 (renombre a Consultas y fecha del evento);
  - worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-1`.
- **Dependencias:** pnpm; **ninguna dependencia nueva**.
- **Base de datos:**
  - Ninguna columna en tablas existentes. Sólo las tablas nuevas del spec §4.1: `FotofficeConsulta`, `FotofficeConsultaCategoria`, `FotofficeOrigen`, `FotofficeRolParticipante`, `FotofficeConsultaParticipante`, `FotofficeContactoPerfil`, `FotofficeConsultaAjustes`.
  - Migración a mano `packages/db/prisma/migrations/20261017120000_fotoffice_etapa_1_consultas/migration.sql`. **No se aplica.**
  - Nada de `prisma migrate` / `db push` remotos; `prisma validate` / `generate` sí.
  - Documento `packages/db/docs/MIGRACION-ETAPA-1-CONSULTAS.md`, **sin staging**.
- **Permisos (sistema de roles de main, vía el adaptador `puede`):**
  - Consultas = módulo `service-leads`: Ver para leer, Gestionar para crear, editar y operar en lote;
  - datos del contacto = módulo de Clientes;
  - configurar = dueño o administrador (`canManageWorkspaceSettings`);
  - plata (valor): visible con Ver en Consultas **[decisión: el valor estimado no es dinero cobrado]**.
- **Aislamiento:** `workspaceId` siempre de la sesión. Todo id que llega del cliente se valida contra el workspace.
- **Valores:**
  - grupos `BODA`, `EVENTO`, `TRABAJO_CON_FECHA`, `TRABAJO_SIN_FECHA`;
  - categorías de contacto `CONTACTO`, `CLIENTE`, `PROVEEDOR`, `COLABORADOR`.
- **Semillas de DNX** (publicSlug `dnx-estudio`; verificar el slug real en la base de código o en el seed de 0.4):
  - las 21 categorías del spec y de `docs/alboom/09`, con su grupo;
  - 8 orígenes;
  - 16 roles de participante.
- **Otras organizaciones:** categorías equivalentes a los 9 `eventType` actuales, un origen "Otro" y ningún rol.
- **Topes:** importación de 2.000 filas; enganche de 50 consultas por llamada.
- **Alta:** cada paso va separado y nunca deshace el alta. El orden es número → circuito → aviso y tarea → respuesta automática (ésta sólo desde el formulario web).
- **Hora y fechas:** `America/Argentina/Buenos_Aires`. Una fecha de calendario guardada a medianoche UTC se lee como fecha, con el ayudante que dejó el PR 402.
- **Idioma:** textos en español rioplatense. Contactos y socios usan el vocabulario del workspace.
- **Verificación:**
  - pruebas: `pnpm --filter fotoffice exec vitest run <ruta>`;
  - tsc: `NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit`, mirando el código de salida **y** la salida;
  - el build, igual;
  - borrar `.next/cache`;
  - no commitear `apps/*/tsconfig.tsbuildinfo`.
- **Commits y publicación:** commits en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final.

---

### Task 1: Tablas, migración y catálogos puros

**Files:** schema, migration.sql, `lib/consultas/constantes.ts` (grupos, campos por grupo, categorías de contacto, semillas como datos puros) + pruebas de fuente de la migración.

- [ ] **Modelos** según spec §4.1. Únicos e índices:
  - (workspaceId, name) en cada catálogo;
  - `leadId` único en `FotofficeConsulta`;
  - `clientId` único en `FotofficeContactoPerfil`;
  - `workspaceId` único en `FotofficeConsultaAjustes`;
  - único (consultaId, clientId, roleId) en participantes.
- [ ] **CHECKs** de `group` y `category`.
- [ ] **FKs:**
  - a `ServiceSalesLead` y `Client`, con Cascade;
  - catálogos SetNull o Restrict según corresponda;
  - Workspace con Cascade.
- [ ] **`CAMPOS_POR_GRUPO`:**
  - BODA = fecha y hora, invitados, novios, ceremonia, recepción, ciudad;
  - EVENTO = fecha y hora, invitados, lugar, ciudad;
  - TRABAJO_CON_FECHA = fecha y hora, lugar;
  - TRABAJO_SIN_FECHA = ninguno.
- [ ] **Mapa `eventType` (9 actuales) → categoría equivalente.** Leer los 9 en `lib/service-leads/constants` o en el formulario.
- [ ] **Verificar:** `prisma validate`/`generate`; tsc de fotoffice, compramelafoto, clickaton y fotorank.
- [ ] **Commit** `Consultas: tablas de la etapa 1 (SQL sin aplicar)`.

### Task 2: Contacto de la consulta y perfil ampliado

**Files:** `lib/consultas/contacto.ts`, `lib/contactos/perfil.ts` + pruebas.

- [ ] **`contactoParaConsulta(tx, workspaceId, { nombre, email?, telefono? })`:**
  - reutiliza `lib/clients/find-or-create.ts` y `match.ts`;
  - busca primero por correo y después por teléfono normalizado; si hay varios, el más reciente;
  - si no encuentra, crea el `Client` y su perfil con `CONTACTO`;
  - devuelve `{ clientId, creado, posibleDuplicado }`.
- [ ] **Perfil:** `perfilDe(workspaceId, clientIds[])` en lote y `guardarPerfil(ctx, clientId, datos)`, que valida y registra en `ClientAudit` como el resto de la ficha.
- [ ] **`marcarClienteSiGana(tx, clientId)`:** pasa de `CONTACTO` a `CLIENTE`; no toca las otras categorías.
- [ ] **Pruebas:** coincidencia por correo, por teléfono o ninguna; aislamiento; varios candidatos; perfil y auditoría.
- [ ] **Commit** `Consultas: contacto obligatorio y perfil ampliado del cliente`.

### Task 3: Catálogos, ajustes y semillas

**Files:** `lib/consultas/{categorias,origenes,participantes,ajustes,semillas}.ts` + pruebas.

- [ ] **Catálogos:**
  - altas, bajas y cambios, con permiso `configurar`;
  - archivar contra borrar (sólo si nunca se usó);
  - el grupo no cambia si la categoría está usada;
  - reordenar.
- [ ] **Ajustes:** responsable de consultas nuevas (debe tener Gestionar en Consultas), correo sí/no, tarea sí/no.
- [ ] **`asegurarCatalogosIniciales(workspaceId, slug)`:**
  - idempotente: conteo afuera y re-chequeo adentro;
  - DNX recibe sus semillas; el resto, las equivalentes;
  - pasa los `ServiceLeadForm` existentes a su categoría equivalente, guardada en un mapa por formulario, sin tocar columnas.
  - **[decisión]** Si `ServiceLeadForm` no admite guardar la categoría sin columna nueva, la equivalencia se resuelve en código por `eventType` en cada alta.
- [ ] **Pruebas** de todo lo anterior y del aislamiento.
- [ ] **Commit** `Consultas: categorías con grupo, orígenes, roles y ajustes`.

### Task 4: Alta única, aviso y enganche

**Files:** `lib/consultas/{alta,aviso,fechas,enganche}.ts` + pruebas; plantilla del sistema nueva `CONSULTA_AVISO_EQUIPO` en `lib/plantillas` (0.6: semilla y automático, canal Correo).

- [ ] **`altaDeConsulta(ctx | sistema, datos, { origenDelAlta: "MANUAL" | "RAPIDA" | "WEB" | "IMPORTACION" })`:**
  - en una transacción: contacto + `ServiceSalesLead` + `FotofficeConsulta` + participantes;
  - fuera de la transacción, cada paso aislado:
    1. número (`numerarConsultaNueva`);
    2. circuito (enganche de 0.4 para esa consulta);
    3. aviso y tarea (`aviso.ts`);
    4. respuesta automática (sólo WEB, `responderConsultaNueva`).
  - Devuelve el id y avisos como "fecha superpuesta" o "posible duplicado".
- [ ] **Aviso:**
  - correo interno con la plantilla del sistema `CONSULTA_AVISO_EQUIPO` (no cuenta en el tope de 200) al responsable de ajustes, o al dueño si no hay;
  - tarea "Responder consulta" que vence hoy a las 23:59, hora de Buenos Aires;
  - nunca lanza error.
- [ ] **`fechasSuperpuestas(workspaceId, fecha, excluirId?)`:** consultas abiertas del mismo día de calendario.
- [ ] **Enganche:**
  - por lotes de 50 consultas sin `FotofficeConsulta`;
  - ata contacto y categoría, copia `eventDate` y `eventLocation`;
  - idempotente;
  - se llama donde ya corren los enganches de 0.4 y 0.5.
- [ ] **El formulario público** (`app/actions/service-lead.ts`) pasa a usar `altaDeConsulta(..., WEB)`. Conserva el freno por IP, el número y la respuesta automática ya existentes, y el orden.
- [ ] **Pruebas:**
  - orden y aislamiento de cada paso;
  - la respuesta automática sólo sale en WEB;
  - aviso con y sin responsable;
  - el aviso no cuenta en el tope;
  - superposición de fechas;
  - el enganche corre una sola vez.
- [ ] **Commit** `Consultas: alta única con aviso al equipo y enganche de las existentes`.

### Task 5: Nueva consulta, alta rápida y ficha

**Files:** `app/(shell)/consultas/nueva/*`, alta rápida en `components/circuitos/tablero.tsx`, ficha `app/(shell)/consultas/[id]`, `app/actions/consultas.ts`.

- [ ] **Formulario "Nueva consulta":**
  - buscador de contacto o contacto nuevo;
  - categoría, con los campos de su grupo;
  - origen, valor, responsable, nota;
  - avisos de posible duplicado y de fecha superpuesta.
- [ ] **Alta rápida** en la primera columna del tablero: nombre, teléfono o correo, y categoría.
- [ ] **Ficha:**
  - columna de datos: contacto, categoría, datos del grupo, origen, referente, valor, cierre previsto, responsable;
  - siguiente acción editable (`stageDueAt` + registro en el historial);
  - participantes: agregar o quitar, con contacto + rol;
  - notas, etiquetas y adjuntos del contacto, sólo para leer, con un enlace a su ficha.
- [ ] **Acciones** `"use server"`, sólo async, con guardas antes de leer.
- [ ] **Pruebas:** acciones y permisos; pruebas de fuente (guarda antes de leer; componentes cliente sin `@repo/db`).
- [ ] **Build** y **commit** `Consultas: nueva consulta, alta rápida y ficha completa`.

### Task 6: Lista, tablero y acciones en lote

**Files:** `lib/service-leads/listado.tsx`, `components/circuitos/{tablero,tarjeta}.tsx`, `app/actions/listado.ts` (lote).

- [ ] **Lista:**
  - columnas: categoría, origen, valor, responsable;
  - filtros: categoría, origen, responsable, siguiente acción (vencida, hoy, esta semana).
- [ ] **Lote** (Gestionar): asignar responsable, fijar siguiente acción, cerrar como perdida con motivo, mover a otro circuito.
  - Cada acción queda registrada en la bitácora de 0.2 y en el historial de cada consulta.
- [ ] **Tablero:** total de valor por columna; la tarjeta muestra categoría, fecha del evento (con el ayudante de fecha) y valor.
- [ ] **Pruebas**, incluido el presupuesto de ids conjunto (`lib/listado/presupuesto.ts`).
- [ ] **Commit** `Consultas: columnas, filtros, total por columna y acciones en lote`.

### Task 7: Contacto ampliado en Clientes

**Files:** ficha del cliente (tarjeta "Consultas" y datos ampliados), `lib/clients/listado.tsx` (filtros por categoría de contacto, cumpleaños del mes), importación de clientes ampliada.

- [ ] **Tarjeta "Consultas"** en la ficha del cliente: número, categoría, fecha, etapa o resultado, valor, y botón "Nueva consulta para este contacto".
- [ ] **Datos ampliados** editables con Gestionar en Clientes.
- [ ] **Lista de Clientes:** columna y filtro de categoría de contacto; filtro "cumple este mes".
- [ ] **La importación de clientes** acepta los datos nuevos y la categoría.
- [ ] **Pruebas** y **commit** `Clientes: datos ampliados, categoría y sus consultas`.

### Task 8: Configuración → Consultas e importación de consultas

**Files:** `app/workspace/configuracion/consultas/*`, `app/(shell)/consultas/importar/*`, `lib/consultas/importar.ts`.

- [ ] **Configuración:**
  - pestañas Categorías (con grupo), Orígenes, Roles de participante y Avisos;
  - patrón de Configuración → Campos;
  - entrada en los menús;
  - permiso `configurar`.
- [ ] **Importación:**
  - subir CSV y vista previa con errores por fila;
  - confirmar: hasta 2.000 filas, cada una por `altaDeConsulta(..., IMPORTACION)`, sin avisos ni respuesta automática;
  - sin duplicar: correo + categoría + fecha del evento;
  - queda registrada en la bitácora.
- [ ] **Pruebas** y **build**.
- [ ] **Commit** `Consultas: configuración e importación desde CSV`.

### Task 9: Documento de migración y verificación

- [ ] **`packages/db/docs/MIGRACION-ETAPA-1-CONSULTAS.md`** con la estructura de los anteriores y **sin staging**:
  - qué hace;
  - en negrita, qué pantallas leen cada tabla;
  - checksum;
  - verificación de sólo lectura;
  - vuelta atrás;
  - prueba en producción.
- [ ] **Verificación completa:**
  - vitest de fotoffice;
  - tsc de las 4 apps;
  - build de fotoffice;
  - borrar `.next/cache`.
- [ ] **Commit** `Consultas: documento de migración de la etapa 1`.
