# Etapa 7 · Galería · Entrega A2 (Venta de fotos extra) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el cliente pueda comprar fotos extra dentro de su galería, con precios como Proof (incluidas,
por foto o por paquete, descuento único o progresivo), pagando con Mercado Pago de la organización; que
quede en Caja y que la descarga del original se habilite sola al acreditarse.

**Architecture:**
- Sobre la Entrega A1 (en producción, PR 484): `lib/galerias/*`, ficha del estudio, página pública.
- **Cobro:** el mismo circuito que las cuotas de pedidos y la tienda: Checkout Pro con el token de la
  organización (el dinero no pasa por DNX), webhook propio que **no confía en el cuerpo del aviso** (le pregunta
  a Mercado Pago con el token de la organización), vuelta del comprador que verifica, acreditación idempotente.
  Modelos: `lib/pedidos/mp.ts` (`iniciarPagoCuota`, `acreditarPagoMp`, `verificarPagoCuota`),
  `app/api/payments/mp/pedidos-webhook/route.ts`, `lib/store/payment.ts`, `lib/store/mp-payment.ts`,
  `packages/payments`.
- **Caja:** movimiento INGRESO como los cobros de pedidos (`registrarCobro` en `lib/pedidos/cobros.ts`):
  `sourceModule` propio `galerias`, `sourceRef` = id de la compra (único), rubro de ingreso de la galería o
  de los ajustes.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-10-etapa-7-galeria-design.md` §4.

## Global Constraints

- **Rama y worktree:** `feat/fotoffice-etapa-7-galeria-venta` desde `origin/main`, worktree
  `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Sin dependencias nuevas.**
- **Base de datos:** migración `packages/db/prisma/migrations/20261102120000_fotoffice_etapa_7_galeria_venta/migration.sql`
  (verificar que el nombre no choque con otra sesión), sólo sobre tablas `FotofficeGaleria*` (todas de la
  Entrega A1, sin datos de otras etapas) y tablas nuevas; sin líneas que no sean SQL; prueba de fuente; no se
  aplica en la rama; documento `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-A2.md` con checksum.
  - `FotofficeGaleria` suma: `includedCount` INT default 0 (≥ 0), `pricingMode` TEXT? (CHECK `POR_FOTO|PAQUETE`),
    `unitPriceArs` DECIMAL(14,2)? (> 0), `packageSize` INT? (≥ 2), `packagePriceArs` DECIMAL(14,2)? (> 0),
    `discountMode` TEXT default `'NINGUNO'` (CHECK `NINGUNO|UNICO|PROGRESIVO`), `discountPct` INT? (1–90),
    `discountRules` JSONB? (hasta 4 reglas `{pct 1–90, desde ≥ 2}`, validadas en código), `incomeCategoryId`
    TEXT? (FK `CashCategory` SET NULL). CHECK de coherencia: con `saleMode` `SELECCION` no se exige precio; con
    `SELECCION_Y_VENTA` o `VENTA` el modo de precio tiene que estar completo (por foto: precio; paquete: tamaño y
    precio).
  - `FotofficeGaleriaAjustes` suma: `defaultIncomeCategoryId` TEXT? (FK SET NULL).
  - **Nueva** `FotofficeGaleriaCompra`: workspaceId, galeriaId (CASCADE), galeriaClienteId (CASCADE), status
    (CHECK `PENDIENTE|PAGADA|CANCELADA`), extraCount INT, subtotalArs, discountArs, totalArs DECIMAL(14,2)
    (total > 0), pricingSnapshot JSONB (precios y descuento usados), mpPreferenceId?, providerPaymentRef?
    (único), paidAt?, feeArs DECIMAL(14,2)?, netArs DECIMAL(14,2)?, cashMovementId? (único, FK
    `CashMovement` SET NULL), createdAt, updatedAt. Índice `(galeriaClienteId, status)`.
  - **Nueva** `FotofficeGaleriaCompraFoto`: compraId (CASCADE), fotoId (CASCADE); único `(compraId, fotoId)`;
    índice `fotoId`.
- **Reglas de precio (cálculo puro, en centavos enteros):**
  - **extras** = fotos seleccionadas que no son incluidas ni ya pagadas. **Incluidas** = las primeras
    `includedCount` seleccionadas por fecha de selección (en `VENTA`, `includedCount` = 0).
  - **Por foto:** subtotal = extras × precio. **Por paquete:** paquetes = ⌈extras ÷ tamaño⌉; subtotal =
    paquetes × precio del paquete; el carrito avisa cuántas fotos más entran sin costo en el último paquete.
  - **Descuento único:** % sobre el subtotal. **Progresivo:** se aplica la regla de mayor `desde` que
    alcance la cantidad de extras (por foto) o de fotos de los paquetes (por paquete). Redondeo al centavo,
    nunca negativo.
  - **Compras previas:** una foto pagada no se vuelve a cobrar; si el cliente agrega más extras después,
    es otra compra con sólo las nuevas (los umbrales del descuento progresivo cuentan sólo esa compra).
- **Flujo del cliente:**
  - con extras > 0, la barra muestra el total y **"Pagar fotos extra"**; el repaso de "Enviar selección" no
    deja enviar mientras haya extras sin pagar (mensaje claro);
  - "Pagar" crea una `Compra PENDIENTE` con la foto de cada extra (instantánea) y abre Checkout Pro; si hay una
    pendiente con las mismas fotos y total, se reutiliza; si cambiaron, la vieja pasa a `CANCELADA`;
  - sin cobros configurados (sin token de Mercado Pago de la organización) el botón explica "La organización
    todavía no tiene los cobros habilitados. Escribile para pagar de otra forma." y el estudio puede
    **marcar pagada a mano** desde la revisión (con método y fecha, va a Caja igual);
  - en `VENTA` no hay "Enviar selección": la compra pagada es el final (el cliente queda `EN_REVISION`).
- **Acreditar** (webhook y vuelta): sólo pagos `approved` verificados con el token de la organización dueña de
  la galería; referencia externa `fo-galcompra:<compraId>`; idempotente por `providerPaymentRef`; el importe
  pagado tiene que ser ≥ total de la compra (si no, no acredita y deja evento + aviso al estudio); marca
  `PAGADA`, guarda comisión y neto como los cobros de pedidos, registra el movimiento de Caja si Caja está
  encendida (si no, la compra queda pagada igual y se registra un evento "sin Caja" + aviso al estudio);
  eventos; correo al cliente (copia con las fotos y el total) y aviso al estudio con `after()`. El webhook
  siempre responde 200.
- **Descarga del original:** si `downloadMode = SELECCIONADAS`: se pueden bajar los originales de las fotos
  **pagadas** y de las **incluidas una vez enviada la selección**; URL firmada GET de 5 minutos con
  `attachment` y el nombre original, generada por acción que valida token + foto; botón "Descargar" en esas
  fotos y "Descargar todas las mías" que baja de a una (el ZIP es de la Entrega B).
- **Estudio:** pestaña **Venta** en la ficha (modo de venta, incluidas, por foto/paquete, descuentos con hasta
  4 reglas, rubro de ingreso; vista previa del carrito con ejemplos 1, 5 y 20 extras); en la revisión del
  cliente: compras con estado, total, comisión, fecha y "Marcar pagada a mano"; en el listado y la ficha:
  total vendido. Ajustes: rubro de ingreso por omisión.
- **Seguridad:** todo por `workspaceId`; acciones públicas atadas al token; el precio **siempre** se calcula en
  el servidor; montos en centavos; nunca "plata"; datos personales fuera de los registros.
- **Verificación:** vitest completo; tsc de fotoffice con `NODE_OPTIONS=--max-old-space-size=8192` (código de
  salida y salida); prisma validate/generate; `next build --webpack` y `rm -rf apps/fotoffice/.next`.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Datos y cálculo de precios
**Files:** schema, migración y su prueba de fuente; `lib/galerias/{precios,compras-reglas}.ts` y sus pruebas.
- [ ] Columnas y tablas según las Global Constraints.
- [ ] `precios.ts`: validar configuración de venta; calcular carrito (incluidas, extras, por foto, por paquete
  con fotos que faltan para completar, único, progresivo, compras previas).
- [ ] `compras-reglas.ts`: qué fotos se pueden descargar en original; transiciones de la compra.
- [ ] Commit `Galería: precios de fotos extra y compras (SQL sin aplicar)`.

### Task 2: Configuración de venta en el estudio
**Files:** pestaña Venta, acciones, ajustes (rubro), resumen de compras en la revisión, "Marcar pagada a mano" con Caja, total vendido en listado y ficha; pruebas.
- [ ] Commit `Galería: configurar la venta de fotos extra y ver las compras`.

### Task 3: Carrito y pago del cliente
**Files:** `lib/galerias/{pago,acreditar}.ts`, `app/api/payments/mp/galerias-webhook/route.ts`, vuelta del comprador en la página pública, carrito en `components/galeria-publica/*`, correos; pruebas (webhook falso, repetido, de otra organización, importe menor, sin Caja, compra cancelada, reutilizar pendiente).
- [ ] Commit `Galería: el cliente paga las fotos extra con Mercado Pago`.

### Task 4: Descarga de originales y documento
**Files:** acción de descarga, botones en la página pública, `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-A2.md`; pruebas.
- [ ] Commit `Galería: descarga de originales comprados y documento de migración`.
