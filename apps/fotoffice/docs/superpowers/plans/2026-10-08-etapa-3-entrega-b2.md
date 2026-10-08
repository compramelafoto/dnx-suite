# Etapa 3 · Entrega B2 (pagar una cuota con Mercado Pago) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el cliente pague una cuota de su pedido con Mercado Pago, desde el enlace del pedido, y que el pago se registre solo como cobro, con su recibo y su movimiento en Caja.

**Architecture:**
- Mismo circuito que la Tienda:
  - Checkout Pro con el token de la organización (`resolveWorkspaceCollector`);
  - referencia externa propia;
  - webhook propio que responde siempre 200 y le pregunta el pago a Mercado Pago;
  - verificación a la vuelta del comprador.
- El cobro se registra con la misma lógica de la Entrega A (`registrarCobro`), en una variante "del sistema", sin usuario.
- **Sin migración:** la idempotencia la da el único `FotofficeCobro.providerPaymentRef`, que ya existe.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-08-etapa-3-pedidos-y-cobranzas-design.md` §2 Entrega B 1.

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-etapa-3-entrega-b2` desde `origin/main` (84e193bb), worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Base y dependencias:** sin migración y sin dependencias nuevas.
- **Referencia externa:** `fo-pedcuota:<cuotaId>`. El webhook ignora cualquier pago cuya referencia no empiece así.
- **Comisión de plataforma: 0 en esta entrega** **[decisión]**. El PR 357 va a unificar las comisiones de Mercado Pago y de plataforma para todos los cobros. Hasta entonces, un pedido no retiene `marketplace_fee`, así no queda una retención sin asiento en el libro de comisiones.
- **Importe:** el saldo de la cuota en el momento de crear la preferencia, con dos decimales. Se rechaza si el saldo es 0, si el pedido está `CANCELADO` o si la organización no tiene cobros habilitados.
- **Acreditación (`acreditarPagoMp`):**
  - sólo pagos `approved`;
  - el pedido tiene que ser de la organización cuyo token leyó el pago;
  - el cobro va con `method = MERCADO_PAGO`, `paidAt` = `date_approved` (o ahora), `providerPaymentRef` = id del pago;
  - `feeArs` = la suma de `fee_details` de tipo `mercadopago_fee` y `netArs` = bruto − comisión, cuando vienen; si no, `null`;
  - se imputa primero a la cuota de la referencia y el resto de la más vieja a la más nueva;
  - el movimiento de Caja va por el bruto, igual que en la Entrega A;
  - se manda el recibo automático.
- **Idempotencia:** si ya hay un cobro con ese `providerPaymentRef`, no se hace nada. El único de la base frena la carrera; P2002 se trata como "ya acreditado".
- **Pago que supera el saldo del pedido:** por ejemplo, un pago doble. No se acredita. Queda un aviso en el registro, sólo con códigos, y una tarea del sistema para el responsable del pedido: "Pago de Mercado Pago sin aplicar: devolver o aplicar a mano", si existe el mecanismo de tareas que usa la aceptación del presupuesto. **[decisión: nunca crear saldo negativo]**
- **Pedido cancelado:** el pago aprobado tampoco se acredita, y genera la misma tarea.
- **Sin Caja o sin cuenta:** el cobro no se puede registrar (regla de la Entrega A). Se avisa con la misma tarea; el webhook igual responde 200.
- **Seguridad de la página pública:** la acción "Pagar cuota" valida el token del pedido y que la cuota sea de ese pedido, con freno por IP. Nunca expone el token de Mercado Pago. La vuelta (`?pago=ok&payment_id=`) no se cree: se le pregunta a Mercado Pago.
- **Variable `[cuota_link_pago]`:** el enlace del pedido con `?pagar=<cuotaId>`. La página resalta esa cuota y su botón.
- **Textos:** español rioplatense, "dinero".
- **Verificación:** vitest completo; tsc de fotoffice con `NODE_OPTIONS=--max-old-space-size=8192`, mirando el código de salida **y** la salida; `next build --webpack`; borrar `.next/cache`; no commitear tsbuildinfo.
- **Commits:** con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Cobro del sistema, preferencia y webhook

**Files:**
- `lib/pedidos/mp.ts` y sus pruebas, con funciones puras para la referencia, los hechos del pago y la comisión;
- `lib/pedidos/cobros.ts`: variante `registrarCobroDelSistema`, que comparte el núcleo de `registrarCobro`;
- `app/api/payments/mp/pedidos-webhook/route.ts`.

- [ ] **Funciones puras:**
  - `referenciaCuota(cuotaId)`;
  - `cuotaDeReferencia(raw)`;
  - `hechosDelPago(pago)`: id, monto, fecha y comisión desde `rawSanitized.fee_details`.
- [ ] **`registrarCobroDelSistema`:**
  - el mismo núcleo que el cobro manual: candado del pedido, Caja, número de recibo, imputación con la cuota preferida, `SENA_COBRADA`, `EN_CURSO`;
  - actor "Sistema" (`createdByUserId` nulo);
  - idempotente por `providerPaymentRef`;
  - no duplicar la lógica: extraer el núcleo y que las dos funciones lo usen.
- [ ] **`iniciarPagoCuota`:** abre la preferencia según las Global Constraints. `notificationUrl` es `/api/payments/mp/pedidos-webhook`. Las vueltas van a la página pública del pedido, con su token.
- [ ] **`verificarPagoCuota`:** para la vuelta del comprador, igual que `checkStoreOrderPayment`.
- [ ] **Webhook:** igual que `tienda-webhook`. Las organizaciones candidatas son las que tienen pedidos `CONFIRMADO` o `EN_CURSO` (distintas, hasta 20).
- [ ] Pruebas:
  - lo puro;
  - acreditar una vez;
  - repetido;
  - pago excedente y pedido cancelado, que no acreditan y crean la tarea;
  - imputación con cuota preferida;
  - fuente del webhook: responde siempre 200 y nunca confía en el cuerpo.
- [ ] Commit `Pedidos: cobro de cuotas con Mercado Pago (preferencia y aviso)`.

### Task 2: Botón en el enlace del cliente y variable

**Files:** página pública `app/w/[workspaceSlug]/pedido/[token]`, `lib/pedidos/publico.ts`, una acción pública con freno por IP, `lib/plantillas/variables.ts` y el contexto.

- [ ] **Botón "Pagar con Mercado Pago"** en cada cuota con saldo, sólo si la organización tiene cobros habilitados y el pedido no está cancelado. Redirige al checkout.
- [ ] **A la vuelta:**
  - `?pago=ok&payment_id=…` llama a `verificarPagoCuota` y muestra "¡Gracias! Registramos tu pago" con el enlace al recibo;
  - `pendiente` muestra "Tu pago está en proceso";
  - `error` muestra "No se pudo completar el pago".
- [ ] **`?pagar=<cuotaId>`** resalta esa cuota.
- [ ] **Variable `[cuota_link_pago]`** en las plantillas de pedido, recordatorio y recibo.
- [ ] Pruebas:
  - fuente: el token de Mercado Pago nunca llega al navegador;
  - una cuota de otro pedido se rechaza;
  - el pedido cancelado no muestra el botón.
- [ ] Commit `Pedidos: pagar una cuota desde el enlace del cliente`.

### Task 3: Documento

- [ ] Sección "Entrega B2" en `packages/db/docs/MIGRACION-ETAPA-3-PEDIDOS.md`:
  - sin SQL;
  - el webhook nuevo;
  - qué hace falta: la organización con Mercado Pago conectado en Configuración → Cobros;
  - la comisión de plataforma en 0 hasta el PR 357;
  - prueba en producción con un pago real chico, que después se anula y se devuelve en Mercado Pago.
- [ ] Commit `Pedidos: documento de la entrega B2`.
