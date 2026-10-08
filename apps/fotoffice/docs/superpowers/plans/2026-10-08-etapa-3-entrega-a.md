# Etapa 3 · Entrega A (Pedido, plan de cuotas y cobros) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desde un presupuesto aceptado se confirma un pedido con su plan de cuotas, salido de las opciones de pago de ¿Cuánto Cobro?. Los cobros manuales:
- se imputan a las cuotas;
- impactan en Caja;
- emiten un recibo X numerado con enlace público;
- se anulan con contramovimiento.

Los rubros de ingresos y costos pasan a tener dos niveles.

**Architecture:**
- **Datos:** tablas nuevas `Fotoffice*` y columnas que admiten nulo en tablas `Fotoffice*` propias. Ninguna columna en tablas compartidas.
- **Cálculo:** puro en `lib/pedidos/*`, con pruebas.
- **Lo que se reutiliza:**
  - Caja: `recordMovement`/`reverse`/`auto-deposit` de `lib/cash`, con `sourceModule="pedidos"`;
  - numeración, con una clave nueva `RECIBO`;
  - plantillas y automáticos con topes;
  - el patrón del enlace público con token del presupuesto;
  - listado 0.2, ficha 0.3, el adaptador de permisos y el motor de etapas (`SENA_COBRADA`).

**Tech Stack:** Next.js 16 App Router, Prisma, Vitest 3 (base en memoria `lib/circuitos/base-en-memoria.ts`), Tailwind v4 `--fo-*`, lucide-react, pnpm, `@repo/cuanto-cobro-core` (ya es dependencia de FOTOFFICE).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-08-etapa-3-pedidos-y-cobranzas-design.md` (§2 Entrega A, §3, §4.1 A, §4.2, §5, §6).

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-etapa-3-pedidos` desde `origin/main`, worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Dependencias:** ninguna nueva.
- **Base de datos:**
  - Una sola migración a mano: `packages/db/prisma/migrations/20261022120000_fotoffice_etapa_3_pedidos/migration.sql`.
  - Contenido, sólo esto:
    - tablas nuevas `FotofficePedido`, `FotofficePedidoCuota`, `FotofficeCobro`, `FotofficeCobroImputacion` y `FotofficeRubro`;
    - columnas que admiten nulo: `FotofficePresupuestoVersion.paymentOptions JSONB`, `FotofficePresupuestoVersion.chosenPaymentOptionId TEXT`, `FotofficePresupuestoAjustes.paymentOptions JSONB` y `FotofficeProductoCatalogo.incomeCategoryId TEXT` (FK a `CashCategory` con `ON DELETE SET NULL`).
  - **Nunca** columnas en `CashCategory`, `CashMovement`, `Product`, `Client` ni `Workspace`. Las relaciones inversas de Prisma no son columnas.
  - Estados como texto con CHECK: pedido `CONFIRMADO | EN_CURSO | COMPLETADO | CANCELADO`; medio del cobro `EFECTIVO | TRANSFERENCIA | MERCADO_PAGO | TARJETA | OTRO`, los mismos de `CashMovement.paymentMethod`.
  - Dinero en `DECIMAL(12,2)`. Fechas de vencimiento y de evento en `DATE`.
  - Únicos:
    - `FotofficePedido(workspaceId, number)`, `FotofficePedido.presupuestoId` y `FotofficePedido.accessTokenHash`;
    - `FotofficeCobro.cashMovementId`, `FotofficeCobro.voidCashMovementId`, `FotofficeCobro.providerPaymentRef`, `FotofficeCobro.receiptTokenHash`, `FotofficeCobro(workspaceId, receiptNumber)` y `FotofficeCobro(workspaceId, idempotencyKey)`;
    - `FotofficeCobroImputacion(cobroId, cuotaId)`;
    - `FotofficeRubro.categoryId`.
  - La migración **no se aplica** en esta rama: se aplica en producción en la publicación, antes de fusionar. Documento `packages/db/docs/MIGRACION-ETAPA-3-PEDIDOS.md`, **sin staging**.
- **Permisos** (sistema de roles de main, vía el adaptador `lib/access/policy.ts`):
  - módulo `orders` ("Pedidos"): pasa a `AVAILABLE` con `route: "/pedidos"` y `dependsOn: ["quotes"]`;
  - Ver para leer; Gestionar para confirmar, cobrar, anular, editar el plan y cambiar el estado;
  - rubros: con el permiso existente de configurar Caja (`cash.configure`);
  - margen y costos: sólo con `configurar` o `verDinero`.
- **Seguridad:**
  - las páginas públicas del pedido y del recibo **nunca** reciben costos, notas internas ni datos de otros pedidos;
  - token HMAC con hash SHA-256, igual que `lib/presupuestos/enlace.ts`;
  - freno por IP;
  - `noindex`;
  - registros sin datos personales (sólo ids y códigos).
- **Aislamiento:** `workspaceId` siempre sale de la sesión, o del token en lo público. Todo id que llega del cliente se valida contra el workspace.
- **Opción de pago por omisión:**
  - si la organización no configuró opciones, se ofrece un solo plan "Hasta N cuotas sin interés", con `N = min(6, meses completos entre hoy y la fecha del evento)` y mínimo 1;
  - sin fecha de evento, N = 6;
  - contado: 1 cuota que vence el día de la confirmación.
- **Plan de cuotas:**
  - mensual desde el día de confirmación: la cuota i vence el mismo día del mes i−1, acotado al último día del mes;
  - si la última vencería después de la fecha del evento, las N cuotas se reparten parejas entre la confirmación y el día del evento, redondeando a días;
  - los importes se reparten en partes iguales a centavos y la última absorbe la diferencia;
  - la suma de las cuotas tiene que dar el total exacto del pedido.
- **Recibo:**
  - leyenda fija "Documento no válido como factura";
  - importe en letras en español (por ejemplo, "ciento veinte mil pesos con 50/100").
- **Caja:** cada cobro crea un `CashMovement` INGRESO con:
  - `sourceModule = "pedidos"` y `sourceRef = <id del cobro>`;
  - `clientId` del pedido;
  - `categoryId` = rubro de ingreso del pedido;
  - la cuenta del depósito automático según el medio.

  Anular usa el contramovimiento existente con su motivo.
- **Hora y moneda:** `America/Argentina/Buenos_Aires`. Montos en ARS con dos decimales en la base y sin decimales al mostrar, salvo en el recibo, que va con centavos (es-AR).
- **Textos:** español rioplatense.
- **Verificación:**
  - vitest;
  - tsc de las 4 apps con `NODE_OPTIONS=--max-old-space-size=8192`, mirando el código de salida **y** la salida;
  - build;
  - borrar `.next/cache`;
  - no commitear `tsbuildinfo`.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final.

---

### Task 1: Tablas y cálculos puros

**Files:**
- `packages/db/prisma/schema.prisma`, la migración y su prueba de fuente (seguir el patrón de las pruebas de migración de la Etapa 2);
- `apps/fotoffice/lib/pedidos/{constantes,opciones-pago,plan-cuotas,imputacion,numero-a-letras}.ts` y sus pruebas.

- [ ] Modelos según la spec §4.1 A y las Global Constraints. `FotofficeCobro` suma `idempotencyKey String?` con el único por workspace. Correr `prisma validate` y `generate`.
- [ ] `opciones-pago.ts`:
  - portar de `apps/compramelafoto/lib/cuantocobro/payment/payment-options-calc.ts` y `normalize-payment-options.ts` las funciones puras `buildPaymentOptionsSnapshot`, `normalizePaymentOptions` y `parsePaymentOptionsSnapshot`, con sus ayudantes (sin el proveedor de índices por red), usando los tipos de `@repo/cuanto-cobro-core`. **No** modificar CompraMeLaFoto;
  - sumar `opcionPorOmision({ total, fechaEvento, hoy })` y `opcionesParaPresupuesto(ajustes, total, fechaEvento, hoy)`, que devuelve las de la organización o la de omisión;
  - cada opción lleva un id estable: `"contado"` o el `id` del plan.
- [ ] `plan-cuotas.ts`:
  - `generarPlan({ total, cuotas, desde, fechaEvento })` → `{ position, dueDate, amountArs }[]`;
  - `validarPlan(cuotas, total)`;
  - `planDesdeOpcion(opcion, …)`.

  Pruebas: redondeo, fin de mes, tope por evento, evento pasado, total cero.
- [ ] `imputacion.ts`: `imputarAutomatico(cuotasConSaldo, importe)` reparte de la más vieja a la más nueva y rechaza si supera el saldo total; `validarImputacionManual`.
- [ ] `numero-a-letras.ts`: enteros hasta 999.999.999 y centavos "con NN/100".
- [ ] Commit `Pedidos: tablas y cálculos de opciones de pago y cuotas (SQL sin aplicar)`.

### Task 2: Opciones de pago en el presupuesto

**Files:** `lib/presupuestos/{ajustes,versiones,editor,publico,vista-publica,aceptacion}.ts`, la configuración `app/workspace/configuracion/presupuestos`, el editor `app/(shell)/presupuestos/[id]`, la página pública del presupuesto y sus pruebas.

- [ ] **Ajustes:** `paymentOptions`, con un editor de contado y planes al estilo ¿Cuánto Cobro?: contado sí o no y descuento %; planes con N cuotas, interés `none` o `manual` y nota comercial.
  - `index_suggested` se muestra **sólo** si la opción ya venía guardada **[decisión: el índice consulta la red y no se porta]**.
  - Se valida con `normalizePaymentOptions`.
- [ ] **Presupuesto:**
  - el borrador toma las opciones de los ajustes y se pueden editar;
  - al congelar la versión se guarda `paymentOptions` = la instantánea calculada sobre el total de la versión, con `opcionesParaPresupuesto` y la fecha del evento de la consulta;
  - el texto libre `paymentProposal` sigue igual.
- [ ] **Página pública:**
  - muestra las opciones con el importe por cuota;
  - al aceptar, el cliente elige una con un radio; por omisión, la primera;
  - se guarda `chosenPaymentOptionId` en la misma transacción atómica de la aceptación, validado contra la instantánea;
  - nunca muestra costos.
- [ ] Pruebas:
  - congelado;
  - elección válida e inválida;
  - sin opciones configuradas, se usa la de omisión;
  - aceptación atómica intacta.
- [ ] Commit `Presupuestos: opciones de pago de ¿Cuánto Cobro? y elección al aceptar`.

### Task 3: Rubros de dos niveles

**Files:** `lib/rubros/{rubros,semilla}.ts` y pruebas; la pantalla de rubros de Caja (buscar la existente de `CashCategory`, `lib/cash/category-form.ts`); el informe por rubro (`lib/cash/category-report.ts`); la ficha del producto del catálogo (`lib/catalogo/perfil.ts`).

- [ ] **Perfil `FotofficeRubro`:**
  - padre y código;
  - un solo nivel: el padre no puede tener padre ni ser el mismo rubro;
  - el padre tiene el mismo `kind` y el mismo workspace;
  - permiso `cash.configure`.
- [ ] **Pantalla de rubros:**
  - agrupados por padre, ordenados por código;
  - campo "Rubro padre" y "Código".
- [ ] **Informe por rubro:** suma también por padre, mostrando el subtotal del padre y los hijos debajo, sin cambiar los totales actuales.
- [ ] **Semilla del plan de DNX** (sólo `esSlugDnx`, idempotente: crea lo que falta, por nombre):
  - **Ingresos:**
    - "3.1 Estudio Fotográfico", padre de:
      - 3.1.1 Bodas;
      - 3.1.2 Eventos Gral;
      - 3.1.3 Sesión fotográfica;
      - 3.1.4 Álbumes;
      - 3.1.5 Impresiones/ampliaciones;
      - 3.1.6 Cumpleaños de 15;
      - 3.1.7 Cumpleaños Infantiles.
  - **Costos (EGRESO):**
    - "4.0 La Isla", padre de:
      - 4.0.1 Fotolibros;
      - 4.0.2 Impresiones;
      - 4.0.3 Cuadros.
    - "4.1 Costos Directos", padre de:
      - 4.1.1 Alquiler de Equipamientos;
      - 4.1.3 Videógrafos Freelancers;
      - 4.1.5 Fotógrafos Freelancers;
      - 4.1.7 Maquillaje/Cabellos;
      - 4.1.8 Modelos;
      - 4.1.9 Viajes.
  - El nombre del rubro es el texto sin el código. El código va en `FotofficeRubro.code`.
  - Se corre desde un botón "Cargar plan de cuentas de DNX", visible sólo para DNX en la pantalla de rubros.
- [ ] **Producto del catálogo:**
  - `incomeCategoryId` con un selector de rubros de ingreso;
  - si hay `incomeLabel` y no hay id, se sugiere el rubro con ese nombre.
- [ ] Pruebas y commit `Caja: rubros de dos niveles y plan de cuentas de DNX`.

### Task 4: Núcleo del pedido

**Files:**
- `lib/pedidos/{acceso,confirmar,pedidos,plan,estado}.ts` y pruebas;
- `app/actions/pedidos.ts`;
- `lib/modules/registry.ts` (módulo `orders`);
- `lib/listado/registro.ts` (registro del listado `orders`);
- `lib/numeracion` (sin cambios para `PEDIDO`).

- [ ] **`acceso.ts`:** adaptador del módulo `orders`, igual a `lib/presupuestos/acceso.ts`.
- [ ] **`confirmarPedido(ctx, presupuestoId, planAjustado?)`**, en una transacción:
  - presupuesto ACEPTADO del workspace y sin pedido;
  - copia `items`/`totals` de la versión aceptada;
  - el total es el de la opción elegida: financiado si tiene interés, con descuento si es contado;
  - copia la fecha del evento y una etiqueta de la consulta (categoría + nombre);
  - asigna el número `PEDIDO`;
  - arma el plan (`planDesdeOpcion` o `planAjustado` validado);
  - `pedidoPorConfirmar=false`;
  - rubro de ingreso: el del primer ítem de catálogo que tenga `incomeCategoryId`;
  - responsable: el del presupuesto.

  Una carrera la gana uno solo (único `presupuestoId`): el otro recibe `{ok:false, error:"ya tiene pedido", pedidoId}`.
- [ ] **Alta manual desde un contacto:** ítems de catálogo o libres con los mismos validadores de ítems de presupuestos, un total y una opción de pago (contado o N cuotas).
- [ ] **Estados:**
  - `CONFIRMADO → EN_CURSO → COMPLETADO`, a mano;
  - `CANCELADO` desde cualquiera salvo `COMPLETADO`, con motivo obligatorio;
  - no se vuelve de `CANCELADO`.
- [ ] **Editar el plan:**
  - cuotas sin imputaciones: libres;
  - con imputaciones: el importe no baja de lo imputado;
  - la suma tiene que dar el total.
- [ ] **Lecturas:** saldo por cuota y del pedido, y estado de cada cuota (`PAGADA`, `PARCIAL`, `VENCIDA`, `PENDIENTE`, `CANCELADA`), con la hora de Argentina.
- [ ] Pruebas:
  - aislamiento;
  - carrera;
  - copia;
  - plan;
  - estados;
  - permisos Ver y Gestionar.
- [ ] Commit `Pedidos: confirmar desde el presupuesto, alta manual, estados y plan`.

### Task 5: Cobros y recibos

**Files:**
- `lib/pedidos/{cobros,recibos,enlace}.ts` y pruebas;
- `lib/numeracion/secuencias.ts`: clave `RECIBO`, con `{ prefix: "", withYear: false, digits: 1, nextValue: 1 }`;
- `lib/plantillas`: tipo `PEDIDO`, variables y automático;
- `lib/circuitos`: emitir `SENA_COBRADA`.

- [ ] **`registrarCobro(ctx, { pedidoId, importe, fecha, medio, imputaciones?, adjuntoId?, idempotencyKey })`**, en una transacción:
  - valida el pedido, que no esté `CANCELADO`, y el importe, que tiene que ser mayor que 0 y no superar el saldo;
  - imputa automático o manual;
  - asigna el número `RECIBO`;
  - crea el token del recibo;
  - registra el `CashMovement` con las funciones existentes de `lib/cash`, según las Global Constraints;
  - si es el primer cobro vigente: pasa `CONFIRMADO → EN_CURSO` y emite `SENA_COBRADA` al motor con la consulta del pedido, si tiene.

  La misma `idempotencyKey` devuelve el cobro existente.
- [ ] **`anularCobro(ctx, cobroId, motivo)`:**
  - contramovimiento con la función existente de reversa;
  - `voidedAt`, `voidReason` y `voidCashMovementId`;
  - las imputaciones dejan de contar;
  - una segunda vez no hace nada.
- [ ] **Enlaces:** del pedido y del recibo, con HMAC y hash (copiar el patrón de `lib/presupuestos/enlace.ts`, con un propósito distinto en el HMAC para que un token no sirva en el otro).
- [ ] **Plantillas:**
  - tipo `PEDIDO`;
  - variables `[pedido_numero]`, `[pedido_enlace]`, `[pedido_saldo]`, `[recibo_numero]`, `[recibo_enlace]`, `[recibo_importe]`;
  - automático `RECIBO_DE_PAGO`, encendido por omisión: al registrar un cobro, correo al contacto con los topes y la regla de una vez por dirección de `lib/plantillas/automaticos.ts`. Nunca frena el cobro: va con `after()`;
  - plantilla inicial de DNX "Tu pedido", con `[pedido_enlace]`.
- [ ] Pruebas:
  - Caja idempotente;
  - parcial;
  - varias cuotas;
  - saldo excedido;
  - anular dos veces;
  - recibo numerado;
  - `SENA_COBRADA` sólo con el primero;
  - el pedido cancelado rechaza cobros;
  - el token del recibo no abre el pedido.
- [ ] Commit `Pedidos: cobros con imputación, Caja, recibo numerado y anulación`.

### Task 6: Pantallas internas

**Files:**
- `app/(shell)/pedidos/{page,nuevo,[id]}`;
- `components/pedidos/*`;
- botón en `app/(shell)/presupuestos/[id]`;
- tarjetas en la ficha del contacto y de la consulta;
- menús;
- `app/workspace/configuracion/pedidos` (rubro de ingreso por omisión, sólo lectura de las plantillas con enlace a Plantillas).

- [ ] **Lista estándar** (0.2):
  - columnas: número, contacto, evento, estado, total, cobrado, saldo, próximo vencimiento;
  - filtros: estado, con saldo y con vencidas.
- [ ] **Ficha** (0.3):
  - evento, ítems, plan de cuotas con estado, cobros con recibo e historial;
  - acciones: "Registrar cobro" (diálogo con importe sugerido, fecha, medio, adjunto y reparto), "Anular cobro" (motivo), "Editar plan", "Cambiar estado", "Copiar enlace del cliente", "Enviar por correo" y "WhatsApp" (`wa.me`).
- [ ] **Presupuesto aceptado:**
  - "Confirmar pedido" abre una vista previa del plan, editable, y confirma;
  - si ya tiene pedido, muestra el enlace al pedido.
- [ ] **Tarjetas "Pedidos"** en contacto y consulta, con el botón "Nuevo pedido" en el contacto.
- [ ] Pruebas de acciones y de fuente: sin `@repo/db` en componentes de cliente y sin margen para quien no tiene permiso.
- [ ] Build y commit `Pedidos: lista, ficha, cobro y confirmación desde el presupuesto`.

### Task 7: Páginas públicas del pedido y del recibo

**Files:** `app/w/[workspaceSlug]/pedido/[token]`, `app/w/[workspaceSlug]/recibo/[token]`, `lib/pedidos/{publico,vista-publica}.ts` y pruebas. Seguir el patrón de `app/w/[workspaceSlug]/presupuesto/[token]` y de `lib/presupuestos/publico.ts`.

- [ ] **Pedido:**
  - marca, número, evento, ítems y totales;
  - plan con estado y saldo;
  - lista de recibos con su enlace.
  - Sin costos ni notas internas.
- [ ] **Recibo:**
  - número, fecha, cliente, concepto, importe en números y en letras, medio y cuotas imputadas;
  - leyenda "Documento no válido como factura";
  - si está anulado, sello "ANULADO";
  - botón "Imprimir / Guardar PDF" con CSS de impresión.
- [ ] Freno por IP y `noindex`. Token inválido o revocado → página "Enlace no disponible".
- [ ] Pruebas:
  - de fuente: sin costos, y los selects públicos no leen campos internos;
  - de datos: tokens cruzados, otro workspace y anulado.
- [ ] Commit `Pedidos: enlace del cliente y recibo imprimible`.

### Task 8: Documento y verificación

- [ ] `packages/db/docs/MIGRACION-ETAPA-3-PEDIDOS.md` **sin staging**, con:
  - en negrita, qué pantallas leen cada tabla y columna;
  - checksum de `migration.sql`;
  - consultas de verificación;
  - vuelta atrás;
  - configuración de DNX: `PEDIDO` en 2025095, `RECIBO` desde 1, encender `orders`, cargar el plan de cuentas;
  - prueba en producción: aceptar un presupuesto de prueba, confirmar, cobrar en efectivo, abrir el recibo desde otro navegador, anular, cancelar el pedido y ver Caja.
- [ ] Verificación completa: vitest, tsc de las 4 apps, build y borrar `.next/cache`.
- [ ] Commit `Pedidos: documento de migración de la entrega A`.
