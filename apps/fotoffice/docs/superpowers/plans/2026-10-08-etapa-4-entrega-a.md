# Etapa 4 · Entrega A (Proyectos) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada pedido confirmado cree sus proyectos de trabajo (uno por regla de producto), con el flujo de etapas y tareas del motor, plazos planificados desde el evento, equipo con roles, y pantallas de lista, tablero y ficha.

**Architecture:**
- Tablas nuevas `Fotoffice*`.
- El recorrido, las etapas y las tareas son del motor de etapas existente (`lib/circuitos`), con un adaptador nuevo para el sujeto `PROYECTO` y la clase `TRABAJO`.
- Tablero, ficha e informe del motor se parametrizan por sujeto y clase sin cambiar Consultas.
- La creación se engancha en la transacción de `confirmarPedido`.
- Pantallas con listado 0.2 y ficha 0.3.

**Tech Stack:** Next.js 16 App Router, Prisma, Vitest 3 (base en memoria `lib/circuitos/base-en-memoria.ts`), Tailwind v4 `--fo-*`, pnpm.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-08-etapa-4-proyectos-y-agenda-design.md` (§2 Entrega A, §3, §4, §5).

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-etapa-4-proyectos` desde `origin/main`, en el worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`, que se reutiliza.
- **Dependencias:** ninguna nueva.
- **Base de datos:**
  - Una sola migración a mano: `packages/db/prisma/migrations/20261025120000_fotoffice_etapa_4_proyectos/migration.sql`.
  - Tablas nuevas:
    - `FotofficeProyecto`, con los campos de la spec §3.1. Únicos `(workspaceId, number)` y `(pedidoId, pedidoItemIndex, circuitId)`, este último sólo cuando `pedidoId` no es nulo.
    - `FotofficeProductoProyecto`: workspaceId, productId, circuitId, ownerUserId?, daysFromEvent INT, nameTemplate?, order.
    - `FotofficeProyectoRol`: workspaceId, name; único `(workspaceId, name)`.
    - `FotofficeProyectoParticipante`: userId? o clientId? (exactamente uno, con CHECK), roleId?, note?.
    - `FotofficeProyectoNota`.
    - `FotofficeProyectoAdjunto`, con la misma forma de almacenamiento que `FotofficeAttachment`: clave en R2 privada, nombre, tamaño, tipo y estado.
    - `FotofficeProyectoEtapaPlan`: proyectoId, stageId, plannedDueDate DATE; único `(proyectoId, stageId)`.
  - **Ninguna columna** en tablas existentes.
  - CHECK de `FotofficeMessageTemplate.entityType`: se reemplaza conservando sus 6 valores actuales (`GENERAL`, `CLIENTE`, `SOCIO`, `CONSULTA`, `PRESUPUESTO`, `PEDIDO`) y sumando `PROYECTO`. Hay que verificar la lista exacta vigente en el SQL de la Etapa 3.
  - La migración no se aplica en esta rama. Documento `packages/db/docs/MIGRACION-ETAPA-4-PROYECTOS.md`, sin staging.
- **Permisos:**
  - módulo `projects` ("Proyectos"): pasa a `AVAILABLE`, con `route: "/proyectos"` y `dependsOn: ["orders"]`;
  - Ver para leer y Gestionar para editar, igual que el adaptador de `lib/pedidos/acceso.ts`;
  - las reglas por producto se editan con `sales.catalog`, igual que los costos-plantilla.
- **Fechas:**
  - `baseDate` = `eventDate` del pedido o, si no tiene, el día de confirmación (Argentina);
  - `finalDueDate` = `baseDate` + `daysFromEvent` de la regla;
  - plan por etapa: la etapa i vence en `baseDate` + Σ días de las etapas 1..i del flujo;
  - el vencimiento de una tarea modelo es el plan de su etapa + los días de la tarea;
  - el atraso son los días entre el plan de la etapa actual y hoy, si es positivo.
  - Todo en `America/Argentina/Buenos_Aires`.
- **Creación:**
  - un proyecto por regla de cada ítem de catálogo del pedido; la cantidad no multiplica;
  - los combos suman las reglas de sus componentes además de las propias;
  - nombre por plantilla `{contacto} · {producto}`, con las variables `{contacto}`, `{producto}`, `{evento}` y `{pedido}`;
  - número `PROYECTO`;
  - recorrido del motor en la primera etapa del flujo, con las tareas modelo;
  - responsable: el de la regla o, si no tiene, el del pedido;
  - se usa el mismo `tx` de `confirmarPedido`;
  - la vista previa permite destildar.
- **Textos:** español rioplatense; "dinero", nunca "plata".
- **Verificación:**
  - vitest completo;
  - tsc de fotoffice con `NODE_OPTIONS=--max-old-space-size=8192`, mirando el código de salida **y** la salida;
  - si cambia el schema: `prisma validate`/`generate` y tsc de clickaton, compramelafoto y fotorank;
  - `next build --webpack`;
  - borrar `.next/cache`;
  - no commitear tsbuildinfo.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final.

---

### Task 1: Tablas y cálculos puros

**Files:** schema, migración y su prueba de fuente; `lib/proyectos/{constantes,fechas,reglas,nombre}.ts` y sus pruebas.

- [ ] Modelos y SQL según las Global Constraints. Correr `validate`, `generate` y tsc de las 4 apps.
- [ ] `fechas.ts` (puro): `fechaBase`, `planDeEtapas(etapas, base)`, `vencimientoDeTarea`, `atraso(plan, hoy)`.
- [ ] `reglas.ts` (puro): `proyectosDelPedido(items, reglas, combos)` devuelve una lista de { pedidoItemIndex, productId, circuitId, ownerUserId?, daysFromEvent, nameTemplate }. Excluye los ítems opcionales y los de texto libre, igual que `cuentasDesdeCostos`.
- [ ] `nombre.ts` (puro): aplica la plantilla de nombre con un tope de 200 caracteres.
- [ ] Commit `Proyectos: tablas y cálculos de fechas y reglas (SQL sin aplicar)`.

### Task 2: Motor de etapas con sujeto PROYECTO

**Files:**
- `lib/circuitos/sujetos/proyecto.ts` y su registro en `sujetos/index.ts`;
- `CLASE_INICIAL` en `recorridos.ts`;
- `tablero.ts`, `ficha.ts`, `informe.ts` y `eventos.ts` parametrizados por sujeto y clase;
- pruebas.

- [ ] **Adaptador `PROYECTO`:**
  - existe: el proyecto es del workspace;
  - nombre: el del proyecto;
  - ruta: `/proyectos/<id>`;
  - `alCambiarEtapa`: si el plan existe, las tareas nuevas usan el vencimiento planificado.
- [ ] **Parametrizar** sin cambiar el comportamiento de Consultas: las funciones públicas reciben `{ tipoSujeto, clase }` con el valor por omisión actual. Las pruebas existentes tienen que seguir pasando sin cambios.
- [ ] **`crearTareasDeEtapa`:** acepta una función de vencimiento opcional. Proyectos la usa con el plan; Consultas sigue igual.
- [ ] Pruebas:
  - un recorrido de proyecto completo: mover, retroceder, terminar, cancelar;
  - las tareas con el plan;
  - Consultas sin cambios.
- [ ] Commit `Motor de etapas: sujeto PROYECTO y vistas parametrizadas`.

### Task 3: Reglas por producto y creación desde el pedido

**Files:**
- `lib/proyectos/{reglas-catalogo,crear}.ts` y sus pruebas;
- sección "Proyecto que genera" en la ficha del producto (Ventas → Catálogo), siguiendo los costos-plantilla de `lib/catalogo/costos.ts`;
- enganche en `lib/pedidos/confirmar.ts` y en su vista previa (`vistaPreviaConfirmacion` y el componente de confirmar);
- "Agregar proyecto" en la ficha del pedido;
- aviso de `SENA_COBRADA` a los proyectos del pedido en `lib/pedidos/cobros.ts`.

- [ ] **Reglas por producto:**
  - flujo: circuito TRABAJO activo del workspace;
  - responsable: miembro del equipo, opcional;
  - días desde el evento: entero de −365 a 365;
  - plantilla de nombre;
  - permiso `sales.catalog`;
  - pueden ser varias por producto.
- [ ] **Al confirmar**, dentro del `tx`, por cada entrada de `proyectosDelPedido` que no se haya destildado:
  1. crear el proyecto, su número y su plan;
  2. abrir el recorrido en la primera etapa con las tareas;
  3. un flujo sin etapas o archivado se saltea, y la vista previa lo avisa.

  Ser idempotente con el único.
- [ ] **Vista previa:** lista "Proyectos que se van a crear", con un tilde cada uno, y la acción recibe los índices destildados.
- [ ] **"Agregar proyecto":** desde la ficha del pedido, con flujo a elección y nombre; misma creación, sin ítem (`pedidoItemIndex` nulo).
- [ ] **`SENA_COBRADA`:** al primer cobro, además de la consulta, `notificarEvento` para cada proyecto abierto del pedido.
- [ ] Pruebas:
  - uno por regla;
  - combo;
  - destildado;
  - reintento sin duplicar;
  - flujo archivado;
  - sin evento;
  - permisos;
  - aislamiento.
- [ ] Commit `Proyectos: reglas por producto y creación al confirmar el pedido`.

### Task 4: Núcleo del proyecto

**Files:** `lib/proyectos/{acceso,proyectos,participantes,notas,adjuntos,semillas}.ts` y sus pruebas; `lib/modules/registry.ts`; `lib/listado/registro.ts`; las acciones en `app/actions/proyectos.ts`.

- [ ] **`acceso.ts`:** igual que el de pedidos, con el módulo `projects`.
- [ ] **Editar datos:**
  - nombre, responsable, delegado, fecha final y descripción;
  - suspender y reanudar con motivo: el suspendido no aparece en vencidos ni en "Mis tareas";
  - reasignar tareas en lote a otro responsable.
- [ ] **Participantes:** usuario del equipo o contacto del workspace, con rol (validado en el workspace) y nota.
- [ ] **Notas y adjuntos:** los adjuntos reusan el almacenamiento R2 privado y el flujo de subida de la ficha 0.3 (`lib/ficha`/adjuntos), adaptados a la tabla nueva.
- [ ] **Semilla de DNX** (`esSlugDnx`, idempotente): los 16 roles:
  - Fotógrafo Principal;
  - Fotógrafo Secundario;
  - Asistente;
  - Filmaker;
  - Maquilladora;
  - Maquilladora 2;
  - Cliente;
  - Salón;
  - DJ;
  - Catering;
  - Mesa Dulce;
  - Alquiler de Pantalla;
  - Músicos;
  - Shows;
  - Operador de Plataforma;
  - Otro.

  Verificar los nombres exactos en `docs/alboom/09`.
- [ ] Módulo `projects` disponible y registro del listado `projects`.
- [ ] Pruebas y commit `Proyectos: datos, suspender, equipo, notas y adjuntos`.

### Task 5: Pantallas

**Files:** `app/(shell)/proyectos/{page,tablero,[id]}`, `components/proyectos/*`, tarjetas en pedido, consulta y contacto, inicio ("Mis entregas de la semana"), menú.

- [ ] **Lista estándar:**
  - columnas: número, nombre, contacto, flujo, etapa, fecha final, atraso, responsable y estado;
  - filtros: flujo, etapa, responsable, vencidos, suspendidos y terminados;
  - acciones en lote: responsable, suspender y reanudar.
- [ ] **Tablero** por flujo (selector de flujo), con el tablero del motor parametrizado.
- [ ] **Ficha:**
  - cabecera con estado, atraso y fecha final;
  - recorrido con etapas, plan y proyección;
  - tareas con responsable y tilde;
  - participantes;
  - pedido vinculado;
  - notas, adjuntos y campos personalizados `PROYECTO`.
- [ ] **Tarjetas** "Proyectos" en la ficha del pedido (con "Agregar proyecto"), de la consulta y del contacto.
- [ ] **"Mis entregas de la semana"** en el inicio: proyectos propios con fecha final en los próximos 7 días o vencidos.
- [ ] Pruebas de fuente: sin `@repo/db` en el cliente. Commit `Proyectos: lista, tablero, ficha y tarjetas`.

### Task 6: Documento y verificación

- [ ] `packages/db/docs/MIGRACION-ETAPA-4-PROYECTOS.md` con:
  - tablas;
  - qué pantallas leen cada una;
  - checksum;
  - verificación;
  - vuelta atrás;
  - encender el módulo `projects` en DNX;
  - prueba en producción: regla en un producto, confirmar un pedido de prueba, ver el proyecto, mover etapas, tildar tareas, suspender y cancelar.
- [ ] Verificación completa y commit `Proyectos: documento de migración de la entrega A`.
