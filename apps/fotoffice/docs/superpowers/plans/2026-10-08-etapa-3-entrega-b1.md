# Etapa 3 · Entrega B1 (cuentas a pagar, recordatorios, informes y checklist) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada pedido confirmado genere sus cuentas a pagar a proveedores desde los costos-plantilla, que el cliente reciba un recordatorio antes de cada vencimiento, que haya informes de "a cobrar", "cobrado" y "a pagar", y que el pedido tenga su checklist.

**Architecture:**
- Tablas nuevas `Fotoffice*`. Reutiliza:
  - Pedidos (Entrega A): `confirmarPedido`, `planesDe`, saldos y estados de cuota, enlace del pedido;
  - Caja: `recordCashMovement`, reversa, depósito automático, rubros de dos niveles;
  - plantillas y automáticos con topes;
  - el patrón de cron de `presupuestos-seguimiento`;
  - listado 0.2 y ficha 0.3.
- El link de Mercado Pago por cuota queda para la **Entrega B2**, que se apoya en el PR 357 (cobros de MP → Caja) cuando esté en main. En B1 el recordatorio lleva el enlace del pedido.

**Tech Stack:** Next.js 16 App Router, Prisma, Vitest 3 (base en memoria `lib/circuitos/base-en-memoria.ts`), Tailwind v4 `--fo-*`, pnpm.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-08-etapa-3-pedidos-y-cobranzas-design.md` (§2 Entrega B 2–5, §4.1 B, §5, §6).

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-etapa-3-entrega-b` desde `origin/main` (7eb5e885), worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Dependencias:** ninguna nueva.
- **Base de datos:**
  - Una migración a mano: `packages/db/prisma/migrations/20261024120000_fotoffice_etapa_3_cuentas_a_pagar/migration.sql`. Va después de `20261023100000_fotoffice_propuesta_borrador_auto` (de otra sesión).
  - Tablas nuevas:
    - `FotofficeCuentaPagar`:
      - `workspaceId`, `pedidoId?`, `supplierClientId?`, `costoPlantillaId?`;
      - `concept`, `amountArs DECIMAL(12,2) > 0`, `dueDate DATE?`, `costCategoryId?` (FK `CashCategory`, SET NULL);
      - `paidAt?`, `paidMethod?`, `paidCashMovementId?` (único);
      - `voidedAt?`, `voidReason?`, `createdByUserId?`, fechas.
    - `FotofficeCuotaRecordatorio`: `workspaceId`, `cuotaId` (FK CASCADE), `dueDate DATE`, `sentAt`. Único `(cuotaId, dueDate)`.
    - `FotofficePedidoAjustes`:
      - `workspaceId` (único);
      - `reminderDays INT DEFAULT 1` (CHECK 0–30), `reminderEnabled BOOLEAN DEFAULT false`;
      - `incomeCategoryId?`;
      - `checklistTemplates JSONB?`;
      - `updatedAt`.
    - `FotofficePedidoTarea`: `workspaceId`, `pedidoId` (FK CASCADE), `position`, `title`, `doneAt?`, `doneByUserId?`, fechas.
  - **Ninguna columna** en tablas existentes, incluidas las `Fotoffice*` de la Entrega A.
  - CHECK de texto para `paidMethod`, con los 5 medios de Caja.
  - No se aplica en esta rama: se aplica en producción antes de fusionar. Documento `packages/db/docs/MIGRACION-ETAPA-3-PEDIDOS.md`, con una sección nueva "Entrega B1".
- **Caja:**
  - Pagar una cuenta crea un `CashMovement` EGRESO con:
    - `sourceModule = "pedidos-pagos"` y `sourceRef = <id de la cuenta>`;
    - `clientId` = proveedor;
    - `categoryId` = rubro de costo;
    - la cuenta del depósito automático según el medio.
  - Anular el pago usa la reversa existente con motivo.
  - Caja no deja anular por su cuenta los movimientos `pedidos-pagos` ni su contramovimiento, igual que con `pedidos`.
  - Sumar `"pedidos-pagos"` a `MOVEMENT_SOURCES` con la etiqueta "Pagos a proveedores".
- **Permisos:**
  - módulo `orders`: Ver para leer, Gestionar para crear, editar, pagar y anular;
  - Configuración → Pedidos: `configurar`;
  - importes de cuentas a pagar, margen real e informe "A pagar": sólo con `configurar` o `verDinero` (`veCostosDePedido`).
- **Recordatorios:**
  - tarea programada diaria a las 13:00 UTC (10:00 de Argentina), protegida con `CRON_SECRET` como las demás;
  - sólo cuotas con saldo de pedidos sin cancelar, en organizaciones con `reminderEnabled`, cuyo vencimiento es dentro de `reminderDays` días (de hoy en adelante, hora de Argentina);
  - una vez por `(cuota, vencimiento)`: si se mueve el vencimiento, vuelve a avisar;
  - plantilla automática `RECORDATORIO_CUOTA` por correo, con los topes de `lib/plantillas/automaticos.ts`, sin el freno de 24 h por dirección (es transaccional, igual que el recibo);
  - como máximo 200 por corrida;
  - el registro sólo guarda códigos.
- **Semillas de DNX** (`esSlugDnx`, idempotentes):
  - `FotofficePedidoAjustes` con `reminderDays=1` y `reminderEnabled=true`;
  - plantillas de checklist "Pedidos con Contrato" y "Pedidos Simple", con las tareas de `docs/alboom/09` sin el duplicado.
- **Hora y moneda:** `America/Argentina/Buenos_Aires`; ARS es-AR.
- **Textos:** español rioplatense; "dinero", nunca "plata".
- **Verificación:**
  - vitest completo;
  - tsc de fotoffice con `NODE_OPTIONS=--max-old-space-size=8192`, mirando el código de salida **y** la salida;
  - `next build --webpack`;
  - borrar `.next/cache`;
  - no commitear `tsbuildinfo`;
  - si cambia el schema: `prisma validate`/`generate` y tsc de clickaton, compramelafoto y fotorank.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final.

---

### Task 1: Tablas y cálculo de cuentas a pagar

**Files:** schema, migración y su prueba de fuente; `lib/pedidos/costos.ts` (puro) y sus pruebas.

- [ ] Modelos y SQL según las Global Constraints. Correr `prisma validate` y `generate`, y tsc de las 4 apps.
- [ ] `cuentasDesdeCostos({ items, costos, combos, fechaEvento })` (puro):
  - por cada ítem de catálogo del pedido, toma los costos-plantilla de su producto;
  - si el producto es combo, los de cada componente × la cantidad del componente;
  - el importe es por unidad × cantidad del ítem, o fijo una vez por ítem;
  - el vencimiento es la fecha del evento + `daysFromEvent`; sin fecha de evento, `null`;
  - el concepto es el del costo, con el nombre del producto;
  - sin costos, lista vacía; importes en centavos.
- [ ] Commit `Pedidos: tablas de cuentas a pagar, recordatorios, ajustes y checklist (SQL sin aplicar)`.

### Task 2: Cuentas a pagar

**Files:** `lib/pedidos/cuentas-pagar.ts` y pruebas; enganche en `lib/pedidos/confirmar.ts`; `lib/cash/constants.ts`; bloqueo en Caja; acciones; sección "Costos y pagos" en la ficha del pedido; pantalla `/pedidos/a-pagar`.

- [ ] **Al confirmar el pedido**, en la misma transacción, se crean las cuentas con `cuentasDesdeCostos`. El rubro de costo queda vacío y se elige al pagar.
- [ ] **"Generar costos"** en la ficha: para los pedidos sin cuentas, por ejemplo los confirmados antes de B1. Es idempotente y no duplica si ya hay alguna.
- [ ] **Editar y agregar:**
  - proveedor (contacto del workspace), concepto, importe, vencimiento y rubro de costo (EGRESO del workspace);
  - sólo mientras la cuenta no esté pagada;
  - borrar sólo si no está pagada.
- [ ] **Pagar:** fecha, medio, rubro (obligatorio) y comprobante opcional del proveedor. Va en una transacción con el pedido bloqueado e idempotencia por clave.
- [ ] **Anular el pago:** con motivo. La cuenta vuelve a pendiente y Caja recibe el contramovimiento.
- [ ] **Ficha del pedido:**
  - costos con su estado (pendiente, vencida, pagada);
  - "Margen real" = cobrado − costos pagados;
  - "Margen previsto" = total − costos;
  - todo sólo con `veCostosDePedido`.
- [ ] **Pantalla "A pagar":** listado estándar con proveedor, concepto, pedido, vencimiento, importe y estado. Filtros: vencidas, próximos 30 días, por proveedor y pagadas.
- [ ] Pruebas:
  - combos;
  - por unidad contra fijo;
  - sin fecha de evento;
  - Caja idempotente;
  - anular dos veces;
  - Caja bloquea `pedidos-pagos`;
  - permisos;
  - aislamiento.
- [ ] Commit `Pedidos: cuentas a pagar desde los costos, pago y anulación`.

### Task 3: Configuración de Pedidos y recordatorios

**Files:**
- `app/workspace/configuracion/pedidos`;
- `lib/pedidos/ajustes.ts`, `lib/pedidos/recordatorios.ts` y pruebas;
- `app/api/cron/pedidos-recordatorios/route.ts` y `vercel.json`;
- plantilla automática `RECORDATORIO_CUOTA` (semilla y edición en Configuración → Plantillas → Automáticos);
- variables `[cuota_vence]` y `[cuota_importe]`.

- [ ] **Configuración → Pedidos:**
  - días antes del recordatorio (0–30) y encendido;
  - rubro de ingreso por omisión, que se usa al confirmar si ningún ítem tiene rubro;
  - plantillas de checklist (Task 5);
  - enlaces a Plantillas y Numeración;
  - entrada en el menú de configuración.
- [ ] **Recordatorios** según las Global Constraints. El texto lleva `[pedido_enlace]`; `[cuota_link_pago]` llega en B2.
- [ ] **Ruta del cron:** autenticación igual que `presupuestos-seguimiento`, `maxDuration` y contadores sin datos personales.
- [ ] Pruebas:
  - ventana de días con la hora de Argentina;
  - una vez por cuota y vencimiento;
  - un vencimiento movido vuelve a avisar;
  - no avisa con el pedido cancelado, sin saldo ni con el recordatorio apagado;
  - topes;
  - la ruta exige el secreto.
- [ ] Commit `Pedidos: configuración y recordatorio de cuotas`.

### Task 4: Informes

**Files:** `lib/pedidos/informes.ts` y pruebas; `app/(shell)/pedidos/informes/page.tsx`; entrada en el menú de Pedidos.

- [ ] **"A cobrar":** vencido, esta semana (lunes a domingo, hora de Argentina) y total, con detalle por cliente y la antigüedad de la deuda vencida (0–30, 31–60 y más de 60 días).
- [ ] **"Cobrado este mes":** total y por medio de pago, con los cobros vigentes del mes calendario de Argentina. Se puede elegir otro mes.
- [ ] **"A pagar":** próximos 30 días y vencidas, por proveedor. Sólo con `veCostosDePedido`.
- [ ] Los montos en ARS los ve sólo quien tiene `verDinero` o `configurar`; el resto ve "Sin permiso para ver montos".
- [ ] Pruebas de cálculo y de permisos. Commit `Pedidos: informes de a cobrar, cobrado y a pagar`.

### Task 5: Checklist del pedido

**Files:** `lib/pedidos/checklist.ts` y pruebas; ficha del pedido; Configuración → Pedidos (editor de plantillas); semilla de DNX; `confirmarPedido` y la vista previa.

- [ ] **Plantillas de checklist** en `FotofficePedidoAjustes.checklistTemplates`: hasta 10 plantillas, cada una con nombre y hasta 40 tareas de 200 caracteres como máximo.
- [ ] **Al confirmar**, se elige una plantilla (opcional; por omisión, la primera) y se copian sus tareas al pedido.
- [ ] **En la ficha:**
  - tildar y destildar, guardando quién y cuándo;
  - agregar y quitar tareas;
  - "Aplicar plantilla" si el pedido no tiene tareas.
- [ ] **Semilla de DNX:** "Pedidos con Contrato" y "Pedidos Simple", con las tareas que figuran en `apps/fotoffice/docs/alboom/09-*.md` (rama `docs/fotoffice-crm-alboom`). Si el documento no las detalla, usar: "Enviar contrato", "Contrato firmado", "Cobrar seña", "Confirmar horarios y lugar", "Asignar equipo", "Evento realizado", "Entregar material" para Contrato, y la misma lista sin las dos de contrato para Simple.
- [ ] Pruebas y commit `Pedidos: checklist con plantillas`.

### Task 6: Documento y verificación

- [ ] Sección "Entrega B1" en `packages/db/docs/MIGRACION-ETAPA-3-PEDIDOS.md` con:
  - tablas nuevas y qué pantallas las leen;
  - checksum;
  - verificación;
  - vuelta atrás;
  - el cron nuevo;
  - cómo encender los recordatorios;
  - prueba en producción: un pedido con un producto con costo, "A pagar", pagar, anular, recordatorio con la tarea a mano usando `CRON_SECRET`.
- [ ] Verificación completa y commit `Pedidos: documento de la entrega B1`.
