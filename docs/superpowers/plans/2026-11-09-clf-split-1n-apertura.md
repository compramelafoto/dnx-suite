# CLF Split 1:N — apertura a todos los fotógrafos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (ejecución nativa en esta sesión). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que el cobro dividido Split 1:N de CLF pueda abrirse a todos los fotógrafos el lunes 16/11/2026: consentimiento desde el panel (receptor guardado en CLF) y un plan B «Pagar con Mercado Pago» en `/pagar/[orderId]`.

**Architecture:** Sin migraciones: se reutilizan las tablas `DnxPaymentRecipient` (una por usuario de CLF) y `DnxSplitConsent` (receiver_id + estado), que ya existen en la base de producción de CLF (verificado 09/11: columnas iguales al schema, 0 filas). Un módulo nuevo `lib/split-1n-consentimiento/` invita y consulta estados con el adaptador existente de `@repo/payments` (sin tocar el paquete). La configuración del piloto pasa a cargarse con `cargarConfigPiloto()` (async), que suma los receptores ACTIVE de CLF al mapa de entorno y admite «todos los álbumes». El plan B agrega el estado `CHECKOUT_PRO` a la marca del piloto: sólo se puede pasar desde `PENDIENTE` con una escritura condicionada, y `create-preference` se niega a crear un Checkout Pro para un pedido del piloto en cualquier otro estado.

**Tech Stack:** Next.js (app router, server actions), Prisma, `@repo/payments` (MercadoPagoSplitConsentAdapter), `node:test` vía tsx.

## Global Constraints

- Todo apagado por defecto. Interruptores nuevos: `DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED` (panel + invitación + leer receptores de CLF) y `DNX_CLF_SPLIT_1N_TODOS_LOS_ALBUMES` (reemplaza la lista de álbumes). Ambos exigen `DNX_CLF_SPLIT_1N_PILOTO_ENABLED=true` para cobrar. La invitación además exige `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED=true` (gate del adaptador, sin cambios).
- `packages/payments` no se modifica (lo usa Clickatón).
- Nada se enciende en Vercel ni se escriben datos de producción en esta tarea.
- Textos en español claro; «dinero», nunca «plata».
- Un problema del piloto nunca impide una venta: ante error, Checkout Pro.
- El mapa de entorno `DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS` gana sobre CLF (es la corrección manual).

## Review Focus

1. Pedido en `COBRANDO`/`EN_REVISION` (cobro incierto) y el comprador pide «Pagar con Mercado Pago» → se niega; no puede haber dos cobros. Test en Task 4.
2. Doble clic / dos pestañas: tarjeta y plan B a la vez → sólo uno gana por la escritura condicionada. Test en Task 4 (decisión pura) + `create-preference` bloqueado si la marca no es `CHECKOUT_PRO`.
3. Dos usuarios de CLF con la misma cuenta de Mercado Pago (mismo receiver_id) → el segundo recibe un error claro, sin pisar al primero. Test en Task 2.
4. La base sin las tablas / Prisma falla al leer receptores → el piloto sigue con el mapa de entorno, nunca lanza. Test en Task 3.
5. Consentimiento cancelado en Mercado Pago pero ACTIVE en CLF → `pagar.ts` ya consulta en vivo y devuelve `CONSENTIMIENTO_NO_ACTIVO`; ahora además ofrece el plan B y actualiza el estado guardado. Test en Task 2 (aplicar estados consultados).

---

### Task 1: Configuración — «todos los álbumes» y receptores de CLF

**Files:**
- Modify: `apps/compramelafoto/lib/split-1n-piloto/config.ts`
- Create: `apps/compramelafoto/lib/split-1n-piloto/receptores-clf.ts`
- Modify: `lib/split-1n-piloto/elegibilidad.ts`, `desvio.ts`, `pagar.ts`, `lib/split-1n-carrito-evento/crear.ts`, `pagar-grupo.ts`
- Test: `apps/compramelafoto/lib/split-1n-piloto/piloto.test.ts`

**Interfaces (produce):**
- `PilotoConfig` gana `todosLosAlbumes: boolean` y `receptoresDesdeClf: boolean`.
- `albumEnPiloto(config: PilotoConfig, albumId: number): boolean`
- `combinarReceptores(config: PilotoConfig, desdeClf: Map<number,string>): PilotoConfig` (puro; entorno gana)
- `cargarConfigPiloto(): Promise<PilotoConfig>` en `receptores-clf.ts` (lee ACTIVE de CLF si `receptoresDesdeClf`; ante error devuelve la config de entorno).

- [ ] Tests: `todosLosAlbumes` sólo con `"true"`; `albumEnPiloto` verdadero para cualquier álbum con `todosLosAlbumes`; `combinarReceptores` respeta el entorno ante conflicto; `evaluarElegibilidadPiloto` con `todosLosAlbumes` y álbum fuera de la lista → ok.
- [ ] Implementar; reemplazar `resolvePilotoConfig()` por `await cargarConfigPiloto()` en desvío, pagar y carrito.
- [ ] `pnpm run test:split-1n-piloto` verde. Commit.

### Task 2: Consentimiento — servicio (TDD con dependencias inyectadas)

**Files:**
- Create: `apps/compramelafoto/lib/split-1n-consentimiento/{config.ts,servicio.ts,repositorio.ts,mp.ts,consentimiento.test.ts}`

**Interfaces (produce):**
- `resolveConsentimientoConfig(env)` → `{ enabled: boolean }` (`DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED`).
- `type EstadoConsentimiento = "SIN_PEDIR" | "PENDING" | "ACTIVE" | "REJECTED" | "CANCELED" | "EXPIRED"`.
- `type VistaConsentimiento = { estado; correo: string|null; inviteUrl: string|null; actualizadoEn: string|null }`.
- `pedirInvitacion(deps, { userId, correo }) → { ok: true; vista } | { ok: false; codigo; mensaje }`
- `actualizarEstado(deps, { userId, forzar? }) → VistaConsentimiento` (consulta MP si pasó ≥ 60 s desde `lastCheckedAt` o `forzar`).
- `aplicarEstadosConsultados(repo, consultas: Array<{receiverId; status}>)` (best effort desde `pagar.ts`).
- `deps = { repo: RepositorioConsentimiento; mp: ClienteConsentimientoMp; ahora: () => Date }`.

- [ ] Tests: correo inválido → `CORREO_INVALIDO`; ya ACTIVE → no invita; invita y guarda receiver + inviteUrl + PENDING; MP no devuelve el correo en `succeeded` → busca en `list` y si no está → `MP_RECHAZO`; receiver de otro usuario → `CUENTA_DE_OTRO_USUARIO`; `actualizarEstado` respeta los 60 s; estado desconocido no rompe.
- [ ] Implementar `repositorio.ts` (Prisma: upsert de `DnxPaymentRecipient` por userId, `DnxSplitConsent` PRODUCTION/MERCADOPAGO/APPLICATION, `invitationReference`=inviteUrl, `primaryProviderAccountReference`=owner) y `mp.ts` (adaptador con token de plataforma, `assertLiveCollectorAccount`).
- [ ] Tests verdes (agregar el archivo al script `test:split-1n-piloto`). Commit.

### Task 3: Consentimiento — API y pantalla del panel

**Files:**
- Create: `apps/compramelafoto/app/api/split-1n/consentimiento/route.ts` (GET estado con refresco, POST invitar), `components/mercadopago/CobroDivididoCard.tsx`
- Modify: `app/fotografo/configuracion/ConfiguracionClient.tsx`, `app/organizador/(panel)/comisiones/page.tsx` (o su cliente)
- Modify: `lib/bot/guia/conocimiento.ts` (CLAUDE.md de CLF)

- [ ] GET/POST devuelven 404 si el interruptor está apagado; requieren sesión. La tarjeta no se muestra si el GET da 404.
- [ ] `test:bot` verde, `tsc` limpio. Commit.

### Task 4: Plan B — «Pagar con Mercado Pago»

**Files:**
- Modify: `lib/split-1n-piloto/snapshot.ts` (estado `CHECKOUT_PRO`), Create: `lib/split-1n-piloto/plan-b.ts` (`puedePasarACheckoutPro(estadoPedido, marca)` puro + server action `pasarPedidoACheckoutPro(pedidoId)`)
- Modify: `app/api/payments/mp/create-preference/route.ts` (409 `SPLIT_1N_PILOTO` si hay marca y estado ≠ `CHECKOUT_PRO`), `app/pagar/[orderId]/page.tsx`, `PagarClient.tsx`, `lib/split-1n-piloto/pagar.ts` (mensaje si ya eligió Checkout Pro)

- [ ] Tests: sólo `PENDIENTE` con pedido PENDING/FAILED puede pasar; `COBRANDO`, `EN_REVISION`, `ACREDITADA`, `PAGADO`, PAID → no; `CHECKOUT_PRO` → idempotente (sí, para reabrir el link).
- [ ] Server action: `updateMany` condicionado a `split1nPiloto.estado = PENDIENTE` (o ya `CHECKOUT_PRO`); luego el cliente llama a `create-preference` y redirige a `initPoint`.
- [ ] Página: botón secundario siempre visible en `PENDIENTE`; destacado tras un error; en `CHECKOUT_PRO` muestra «Continuar con Mercado Pago».
- [ ] Tests + tsc. Commit.

### Task 5: Documentación, revisión y PR

- [ ] `docs/payments/mp-split-1n-plan-implementacion.md`: sección de apertura (variables, orden de encendido 11/11 y 16/11, pendientes).
- [ ] Revisión con subagente opus; corregir; PR a `main`; fusionar en verde.
