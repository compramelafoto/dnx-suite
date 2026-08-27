# FotOffice — Split de Pagos (1 a N): DESACTIVADO

**Fecha de la decisión:** 2026-08-26
**Estado:** `DISABLED / NOT CURRENTLY REQUIRED`
**Alcance:** únicamente Split (1 a N). **No afecta ningún otro cobro de FotOffice.**

---

## 1. Por qué

FotOffice todavía no tiene un caso productivo que requiera repartir un cobro entre
varios destinatarios. Mientras Orders API + Split (1 a N) siga en homologación con
Mercado Pago, mantener a FotOffice fuera evita:

- pedir habilitación independiente para su aplicación de Mercado Pago;
- duplicar homologaciones;
- duplicar consentimientos de partners;
- introducir Orders con split de forma prematura;
- condicionar los cobros que FotOffice **ya tiene** a una funcionalidad todavía no aprobada.

Contexto previo: Mercado Pago habilita el split **por aplicación, no por cuenta**, y la
aplicación de FotOffice no heredó esa habilitación.

---

## 2. Estado ANTES de esta revisión

**FotOffice nunca llegó a consumir Split (1 a N).** La auditoría del código no encontró
ningún wiring activo:

| Qué se buscó | Resultado |
| --- | --- |
| Dependencia `@repo/payments` en `apps/fotoffice/package.json` | **No existe** |
| Importaciones de Orders API / Split / consents / receivers / split rules | **Ninguna** |
| Provider `mercado_pago_orders` | **Ninguna referencia** |
| Feature flags `DNX_MP_ORDERS_1N_*` | **Ninguna referencia** |
| Variables de entorno de Split | **Ninguna** |
| Tests de Split | **Ninguno** |
| Documentación que declarara a FotOffice como consumidor | **Ninguna** |

Lo único que FotOffice tiene de Mercado Pago es un cobro convencional propio, sin split
(ver §4). Es decir: no hubo nada que desactivar — hubo que **impedir que se active por accidente**.

---

## 3. Estado DESPUÉS

Se agregó un guard explícito: `apps/fotoffice/lib/payments/split-1n.ts`.

```
FOTOFFICE_SPLIT_1N_ENABLED = false
FOTOFFICE_SPLIT_1N_STATUS  = "DISABLED_NOT_CURRENTLY_REQUIRED"
assertFotofficeSplit1nAllowed() → { ok: false, reason: "SPLIT_1N_DISABLED_FOR_FOTOFFICE" }
```

**Es una constante y no una variable de entorno a propósito.** El objetivo es que un env
mal configurado en staging o en Vercel no pueda hacer que FotOffice empiece a generar
Orders con split. Reactivarlo exige un cambio de código revisado.

El test `apps/fotoffice/lib/payments/split-1n.test.ts` falla si alguien:

- pone el interruptor en `true` sin actualizar la decisión;
- agrega `@repo/payments` a las dependencias de FotOffice;
- introduce en `app/`, `lib/` o `components/` cualquier símbolo de Split/Orders
  (`observeOrdersWebhook`, `buildMercadoPagoSplitOrderRequest`, `split_rules`,
  `receiver_type`, los flags `DNX_MP_ORDERS_1N_*`, etc.);
- rompe el cobro convencional de cursos.

---

## 4. Lo que NO cambió (crítico)

La desactivación de Split (1 a N) **no toca** ningún cobro de FotOffice:

| Cobro | Estado |
| --- | --- |
| Inscripciones a cursos presenciales (Checkout Pro) | **INTACTO** — `app/api/payments/mercadopago/course-enrollment/create-preference` + `lib/presential-courses/mercadopago.ts` |
| Webhook `payment` de esos cursos | **INTACTO** — `app/api/payments/mercadopago/webhook`, con verificación de firma y `GET /v1/payments/{id}` |
| Cuotas de socios, reservas, alquileres, tienda | **Sin impacto** — no dependen de Split |
| Cobros futuros que no requieran split | **Sin impacto** |

**Split (1 a N) es una CAPACIDAD de DNX Payments, no un requisito para usar DNX Payments.**
El día que FotOffice quiera pasar sus cobros a DNX Payments sin split, puede hacerlo sin
tocar este guard.

---

## 5. Arquitectura temporal resultante

```
@repo/payments (DNX Payments)
   │
   ├── Orders API              READY / HOMOLOGATION
   ├── Split de Pagos (1 a N)  READY / HOMOLOGATION
   ├── Card Payment Brick      READY / HOMOLOGATION
   ├── Refunds                 READY / HOMOLOGATION
   ├── Order Webhooks          READY / HOMOLOGATION
   └── GET Reconciliation      READY / HOMOLOGATION

Consumidores:
   Comprame la Foto  → consumidor de homologación (Brick + Orders sandbox)
   Clickatón         → preparado, detrás de flags OFF por defecto
   FotoRank          → integración diferida, sin checkout
   FotOffice         → SPLIT (1 a N) DISABLED · Checkout Pro propio INTACTO
```

Nada de la arquitectura compartida se eliminó. No se borró código compartido, no se
eliminaron contratos reutilizables, no se rompió `@repo/payments`, no se perdió capacidad futura.

---

## 6. Para reactivar (cuando haya un caso real)

1. Confirmar con Mercado Pago la arquitectura de aplicaciones — hoy `PENDING`
   (ver [confirmaciones de MP](./mp-split-1n-mercadopago-confirmations.md)).
2. Definir el caso de negocio: quién es owner, quiénes son partners, qué se reparte.
3. Poner `FOTOFFICE_SPLIT_1N_ENABLED = true` y actualizar el test del guard.
4. Agregar `@repo/payments` a las dependencias de la app.
5. Gestionar los consentimientos de partners (deben quedar `ACTIVE` antes de la Order).
