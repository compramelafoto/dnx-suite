# Etapa 2 · Entrega A (Catálogo y presupuesto) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Presupuestos de consulta con ítems de catálogo o calculados con ¿Cuánto Cobro?, versiones inmutables, enlace público con aceptación y evidencia, conectados al motor de etapas; catálogo con combos y costos-plantilla.

**Architecture:**
- **Datos:** tablas nuevas `Fotoffice*` alrededor de `Product`, `ServiceSalesLead`/`FotofficeConsulta` y `Client`, sin columnas nuevas.
- **Cálculos puros:** totales y el adaptador de `@repo/cuanto-cobro-core` viven en `lib/presupuestos/*.ts`, con pruebas.
- **Versiones:** cada envío congela una versión con instantáneas.
- **Enlace público:** un token con hash y una página pública sin sesión.
- **Reutiliza:**
  - numeración (`PRESUPUESTO`);
  - plantillas (variables nuevas);
  - motor de etapas (`PRESUPUESTO_ENVIADO` y `PRESUPUESTO_ACEPTADO`);
  - listado (0.2), ficha (0.3) y el adaptador de permisos.

**Tech Stack:** Next.js 16 App Router, Prisma, Vitest 3 (base en memoria `lib/circuitos/base-en-memoria.ts`), Tailwind v4 `--fo-*`, lucide-react, pnpm, `@repo/cuanto-cobro-core` (ya existe en el monorepo).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-07-etapa-2-catalogo-y-presupuestos-design.md` (§2 Entrega A, §3, §4, §5).

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-etapa-2-presupuestos` desde `origin/main`, worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-2`.
- **Dependencias:** pnpm; **ninguna dependencia nueva**. `@repo/cuanto-cobro-core` ya es un paquete del monorepo: si FOTOFFICE no lo declara, se agrega como dependencia de workspace (`workspace:*`). Esto no toca el lockfile de terceros; se verifica con `pnpm install --frozen-lockfile` después del cambio.
- **Base de datos:**
  - ninguna columna en tablas existentes; sólo las tablas de la Entrega A del spec §4.1, sin `FotofficePropuestaModelo`;
  - migración a mano `packages/db/prisma/migrations/20261020120000_fotoffice_etapa_2_presupuestos/migration.sql`. **No se aplica.** Documento `packages/db/docs/MIGRACION-ETAPA-2-PRESUPUESTOS.md`, **sin staging**.
- **Permisos** (sistema de roles de main vía el adaptador):
  - módulo `quotes` (pasa a disponible): Ver para leer y Gestionar para armar y enviar;
  - costo y margen sólo con `configurar` (dueño y administradores) **o** `verDinero`;
  - catálogo con la acción existente `sales.catalog`.
- **Seguridad:**
  - la página pública y el navegador de quien no tiene permiso **nunca** reciben costos ni márgenes;
  - el token se guarda con hash SHA-256;
  - freno por IP en la vista y en la aceptación;
  - registros sin datos personales.
- **Aislamiento:** `workspaceId` siempre sale de la sesión, o del token en la página pública. Todo id que llega del cliente se valida contra el workspace.
- **Valores y estados:**
  - `BORRADOR`, `ENVIADO`, `VISTO`, `ACEPTADO`, `RECHAZADO`, `VENCIDO` (texto + CHECK);
  - modos de precio: `LISTA` y `CALCULO`;
  - validez por omisión: 15 días.
- **Hora y moneda:** `America/Argentina/Buenos_Aires`; montos en ARS con dos decimales en la base y sin decimales al mostrar (es-AR).
- **Textos:** español rioplatense.
- **Verificación:**
  - vitest;
  - tsc con `NODE_OPTIONS=--max-old-space-size=8192`, mirando el código de salida **y** la salida;
  - build;
  - borrar `.next/cache`;
  - no commitear `tsbuildinfo`.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final.

---

### Task 1: Tablas y cálculo puro

**Files:** schema, migration.sql + prueba de fuente; `lib/presupuestos/{constantes,totales,calculo-cuanto-cobro}.ts` + pruebas.

- [ ] Modelos del spec §4.1 (Entrega A), con único, índices, FKs y CHECKs de estado.
- [ ] `calcularTotales(items, descuentoGlobal)`:
  - subtotal;
  - descuentos por ítem y global, en % o en $;
  - los opcionales se muestran aparte y no suman al total;
  - redondeo a 2 decimales.
- [ ] `itemDesdeCalculo(resultadoMotor, entrada)`: adaptador puro del resultado de `cuanto-cobro-core` a un ítem con su instantánea de cálculo. Leer la API real del paquete.
- [ ] Verificar `prisma validate` y `generate`, y tsc de las 4 apps.
- [ ] Commit `Presupuestos: tablas y cálculo de totales (SQL sin aplicar)`.

### Task 2: Catálogo ampliado

**Files:** `lib/catalogo/{perfil,combos,costos}.ts` + pruebas; secciones nuevas en la ficha del producto de Ventas → Catálogo.

- [ ] Perfil 1:1: en lista de precios y rubro de ingreso.
- [ ] Combos:
  - componentes del mismo workspace, sin ciclos;
  - muestra la suma de los componentes y el ahorro.
- [ ] Costos-plantilla:
  - proveedor = contacto del workspace (se ofrecen los de categoría Proveedor);
  - concepto, importe, fijo o por unidad, días desde el evento.
- [ ] Permisos con `sales.catalog`. Costo y margen sólo con ese permiso.
- [ ] Semilla de DNX: las 11 categorías de producto como categorías del catálogo, sólo si no existen.
- [ ] Pruebas y commit `Catálogo: combos, costos-plantilla y datos para presupuestos`.

### Task 3: Núcleo del presupuesto

**Files:** `lib/presupuestos/{presupuestos,versiones,ajustes,acceso,semillas}.ts` + pruebas; `app/actions/presupuestos.ts`.

- [ ] Crear el presupuesto de una consulta del workspace:
  - si no hay consulta, se crea una con `altaDeConsulta(..., "MANUAL")` y su contacto;
  - responsable;
  - validez desde los ajustes.
- [ ] Borrador editable: ítems, descuentos, condiciones, propuesta de pago.
- [ ] Al pasar a versión, copia profunda con instantáneas.
- [ ] Editar un presupuesto enviado crea la versión siguiente y revoca el token de la anterior.
- [ ] Estado `VENCIDO` calculado al leer (y marcable en lote).
- [ ] Rechazar.
- [ ] Número `PRESUPUESTO` al primer envío.
- [ ] Ajustes por workspace (validez, condiciones, propuesta de pago, seguimiento, que se usa en la Entrega B), con permiso `configurar`.
- [ ] Permisos con el adaptador. Costo y margen sólo con `configurar` o `verDinero`.
- [ ] Pruebas (aislamiento, versiones, carreras) y commit `Presupuestos: borradores, versiones, ajustes y permisos`.

### Task 4: Editor, lista y tarjetas

**Files:** `app/(shell)/presupuestos/{page,nuevo,[id]}`, `components/presupuestos/*`, tarjetas en la ficha de la consulta y del contacto, menú.

- [ ] Editor:
  - buscador del catálogo (combos incluidos), ítem de texto libre, sección, opcional;
  - cantidad, precio, descuento;
  - **selector de precio "Lista / ¿Cuánto Cobro?" por ítem**, con un panel de cálculo que usa el motor (el cálculo puro corre en el navegador si el paquete lo permite; si no, en una acción del servidor) y pega el precio sugerido;
  - **"Armar con ¿Cuánto Cobro?"**: asistente que genera ítems;
  - totales en vivo;
  - costo y margen sólo con permiso: la página no los pasa al navegador si no corresponde.
- [ ] Lista estándar (0.2):
  - columnas: número, contacto, consulta, estado, total, vence, responsable;
  - filtros por estado y vencidos;
  - lote "marcar vencidos".
- [ ] Tarjetas "Presupuestos" en la ficha de la consulta y del contacto, con el botón "Nuevo presupuesto".
- [ ] Pruebas de acciones y de fuente (sin `@repo/db` en el navegador y sin costos para quien no tiene permiso).
- [ ] Build y commit `Presupuestos: editor con precio de lista o calculado, lista y tarjetas`.

### Task 5: Envío, enlace público y aceptación

**Files:** `lib/presupuestos/{envio,enlace,aceptacion,vistas}.ts`, página pública, variables y plantillas en `lib/plantillas`, eventos en `lib/circuitos`.

- [ ] Enviar:
  - congela la versión, crea el token (hash) y le pone vencimiento (validez + margen);
  - estado `ENVIADO`;
  - número;
  - plantilla (correo con `enviarCorreo` o WhatsApp) con variables nuevas `[presupuesto_numero]`, `[presupuesto_enlace]`, `[presupuesto_total]`, `[presupuesto_vence]` y el tipo de plantilla `PRESUPUESTO`;
  - plantillas iniciales de DNX "Propuesta para tu evento" (reemplaza la de 0.6 con el enlace real);
  - evento `PRESUPUESTO_ENVIADO` al motor.
- [ ] Página pública `/<slug>/presupuesto/<token>` (seguir el patrón de rutas públicas del sitio y de la Tienda):
  - marca, ítems por sección, opcionales marcados, totales, validez, condiciones, propuesta de pago;
  - "Acepto" (nombre + tilde), "Tengo dudas" (WhatsApp), "Descargar PDF" (vista de impresión);
  - estados para vencido, reemplazado y aceptado;
  - freno por IP.
- [ ] Vistas: cada apertura queda registrada; la primera pone el estado `VISTO` y crea la tarea "Presupuesto visto" para el responsable.
- [ ] Aceptar:
  - atómico, una sola vez por versión;
  - guarda la evidencia: fecha, nombre, IP con hash, navegador;
  - estado `ACEPTADO` y `pedidoPorConfirmar`;
  - evento `PRESUPUESTO_ACEPTADO` al motor (entra a `EVENTOS_CONECTADOS`);
  - si la consulta estaba perdida, se reabre como ganada (spec §5);
  - aviso al responsable (tarea + correo interno con tope).
- [ ] Pruebas:
  - nunca hay costos en la página pública (fuente y datos);
  - carrera de aceptación;
  - token inválido, revocado o vencido;
  - eventos del motor.
- [ ] Commit `Presupuestos: envío, enlace público, vistas y aceptación`.

### Task 6: Configuración, módulo y documento

- [ ] `app/workspace/configuracion/presupuestos`: validez, condiciones, propuesta de pago y seguimiento (los días, que se usan en la Entrega B). Entrada en los menús.
- [ ] Módulo `quotes`: de PLANNED a disponible en el registro. Se enciende junto con Consultas, o se pide igual que los demás módulos (el administrador de la plataforma enciende).
- [ ] Documento `packages/db/docs/MIGRACION-ETAPA-2-PRESUPUESTOS.md` **sin staging**, con:
  - en negrita, qué pantallas leen cada tabla;
  - checksum;
  - consultas de verificación;
  - vuelta atrás;
  - prueba en producción: armar, enviar, abrir el enlace desde otro navegador, aceptar, ver la consulta ganada y "Pedido por confirmar";
  - recordatorio de configurar la numeración de Presupuestos de DNX en 2025262.
- [ ] Verificación completa:
  - vitest;
  - tsc de las 4 apps;
  - build;
  - borrar `.next/cache`.
- [ ] Commit `Presupuestos: configuración, módulo y documento de migración`.
