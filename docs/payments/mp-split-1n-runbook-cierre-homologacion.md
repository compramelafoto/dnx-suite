# Runbook — cerrar la homologación de Split 1:N

**Fecha:** 2026-09-03
**Ticket MP:** `IXFS-16376`
**Base:** [checklist auditado](./mp-split-1n-checklist-oficial-auditoria.md) · [plan de implementación](./mp-split-1n-plan-implementacion.md)

Los bloques van en orden de dependencia. Dentro de cada bloque, los pasos también.
**Ningún paso mueve dinero hasta el bloque F**, que está separado a propósito.

> ## Cómo funciona el proceso, según MP (2026-09-15)
>
> Marilyn lo aclaró y conviene tenerlo presente al leer todo lo que sigue:
>
> 1. **Las revisiones se hacen en ambiente de test**, con órdenes de prueba. Ahí se alinea el
>    desarrollo con el checklist.
> 2. **El video de la experiencia de pago también se evalúa en test.**
> 3. **El Order ID productivo es el registro final**, para revalidar que lo trabajado en test
>    quedó disponible en producción.
>
> Es decir: **los bloques D y E son el trabajo de verdad, y no cuestan un peso.** El bloque F es
> una formalidad de cierre que llega cuando MP ya aprobó todo.
>
> Encaja con cómo está construido: la superficie `/homologacion/compra` funciona **sólo en
> preview** —el guard la bloquea cuando `VERCEL_ENV=production`—, que es justo el ambiente donde
> MP quiere ver las pruebas.

---

## Bloque A — Ahora mismo, sin depender de nadie

### A1. ✅ HECHO — commitear el trabajo del 2026-09-03
Rama **`feat/mp-split-1n-webhook-order-y-antifraude`**, dos commits:

| Commit | Contenido |
|---|---|
| `3cdf678b` | Port del webhook `order` + correcciones fail-closed + `payer-profile.ts` + `external_code` + limpieza de `integration_data` + documentación |
| `f597e2c6` | Vista de comprador para el video (E1) |

El trabajo de referidos y registro quedó **fuera del commit**, sin tocar.

### A2. Responder a Marilyn
Una sola cosa pendiente de nuestro lado en el ticket: confirmar `processing_mode`.
**Respuesta:** correcto, es `automatic` fijo; no manejamos captura manual.
Conviene aprovechar el mismo mensaje para avisar que vamos a renombrar la app (B1).

---

## Bloque B — Panel de Mercado Pago *(lo hacés vos)*

### B1. Renombrar la aplicación
`Comprame la Foto` → **`DNX Suite`**. MP ya confirmó que no tiene impacto: su tracking va por
ID de aplicación, que no cambia. En el checklist ya nos registran con ese nombre.

### B2. La notification URL única
No se puede declarar más de una. **Es esta, con `www`:**

```
https://www.compramelafoto.com/api/webhooks/dnx-payments
```

> ⚠️ **Sin `www` no sirve.** `compramelafoto.com` responde **308 y redirige** al dominio
> canónico; muchos emisores de webhooks no siguen redirecciones y la notificación se perdería
> en silencio. Verificado el 2026-09-15.

Por qué ese host:
- Es el dominio más estable de la suite.
- Es donde vive la superficie de homologación, y MP nos registra como integrador ahí.
- El endpoint ya existe en `main` (portado el 2026-09-03).

**Aclaración importante, para no asustarse:** esta URL única aplica **sólo al tópico `order` de
la app DNX Suite**. Clickatón sigue recibiendo sus notificaciones de Checkout Pro en su propio
endpoint y su propia app, sin cambios. Recién cuando algún producto además de CLF empiece a
crear Orders 1:N habrá que hacer que este endpoint despache al producto correcto según el
`external_reference` — hoy es observe-only y no produce efectos.

### B3. Configurar la notificación
- Cargar la URL de B2.
- Suscribir **únicamente** el tópico `order`. No `payment`.
- Separar credenciales TEST y PROD.

### B4. Copiar el webhook secret
Es el de la app que firma. **No confundir el del panel con el del flujo por API** — el checklist
avisa expresamente sobre esa confusión.

---

## Bloque C — Variables de entorno *(Vercel, proyecto de Comprame la Foto)*

Para que el endpoint funcione y no falle cerrado:

| Variable | Valor | Para qué |
|---|---|---|
| `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED` | `true` | Sin esto el endpoint responde 200 e ignora todo |
| `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` | **`false`** | Si está en `true`, el guard bloquea el receptor |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | Token TEST de la app DNX Suite | Sin esto no hay `GET` y el pipeline marca `GET_ORDER_NOT_CONFIGURED` |
| `MERCADOPAGO_TEST_PUBLIC_KEY` | Public key TEST | Card Payment Brick |
| `MERCADOPAGO_WEBHOOK_SECRET` | El de B4 | Validación de firma. **Ojo con el nombre:** el handler lee esta variable, no `DNX_PAYMENTS_WEBHOOK_SECRET`. Y si ya había una cargada de la época de Checkout Pro, hay que reemplazarla por la de la app DNX Suite |
| `DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED` | `true` | Habilita la superficie del Brick |

**El token del `GET` tiene que ser el de la misma app que creó la Order.** Un `GET` con el token
de otra cuenta devuelve `Order not found`: eso fue exactamente lo que rompió la prueba de agosto.

---

## Bloque D — Prueba punta a punta del webhook

Produce la evidencia **"GET a la orden post-webhook"** del checklist.

> **Dónde se corre.** La superficie que crea la orden vive **sólo en preview** (en producción
> devuelve 404 a propósito). El receptor del webhook, en cambio, **sí corre en producción** y ya
> está respondiendo — verificado el 2026-09-15: contesta `WEBHOOK_INVALID_SIGNATURE`, lo que
> confirma que el endpoint está desplegado, el flag de observe encendido, el de producción
> apagado y el secreto cargado.

1. Entrar a `/admin/homologacion-mp-split-1n` en el entorno configurado. (Para el video del bloque E, la ruta es `/homologacion/compra`.)
2. Correr el escenario `OWNER_PLUS_2` (owner + 2 partners = 3 receptores). Cubre de una vez la evidencia **"Split con múltiples partners"** — **ya obtenida el 2026-09-17**, ver [auditoría §8](./mp-split-1n-checklist-oficial-auditoria.md).

   > **Ojo con el pagador.** Si la Order sale con el email y nada más, Mercado Pago la rechaza
   > con `high_risk` aunque el titular sea `APRO`. La identificación tiene que viajar desde el
   > Brick hasta la Order.
3. Pagar con tarjeta de prueba. El `payer.email` debe terminar en `@testuser.com` — los fixtures ya cumplen.
4. Verificar en los logs del endpoint que la respuesta traiga:
   - `WEBHOOK_RECEIVED: true`
   - `SIGNATURE_VALID: true`
   - `GET_ORDER_CALLED: true`
   - `GET_ORDER_ID_MATCHES_WEBHOOK: true`
   - `RECONCILIATION: "PASS"`
   - `BUSINESS_EFFECT: "NONE_OBSERVE_ONLY"`
5. Guardar la captura o el snippet del `GET /v1/orders/{id}` posterior a la notificación.

**Si aparece `GET_ORDER_NOT_CONFIGURED`:** falta el token de C. No es un fallo de Mercado Pago.
**Si no llega ninguna notificación:** recién ahí corresponde reportarle el `order_id` a Marilyn,
que es lo que quedó comprometido en el ticket.

---

## Bloque E — Video del flujo de pago aprobado

El checklist pide un video **continuo y sin cortes**, desde la perspectiva del comprador:
selección del producto → checkout con Card Payment Brick → carga de la tarjeta → confirmación →
**retorno al comercio** con el mensaje de resultado final, y que se vea la orden en
`processed / accredited`.

**El problema:** la superficie actual vive en `/admin/...` y se ve administrativa. Tiene el Brick,
pero le faltan los dos extremos del recorrido.

### E1. ✅ HECHO — vista de comprador
Ruta **`/homologacion/compra`** (`apps/compramelafoto/app/homologacion/compra/`).

Tres pasos: elegir la foto → pagar con el Card Payment Brick → resultado con el botón de
retorno al comercio. Usa **el mismo Brick y la misma server action** que la superficie admin,
que no cambió. Mismos guards: sandbox, flag explícito, producción bloqueada; fuera de
homologación devuelve 404.

**Verificado:** typecheck de la app en 0 errores y los pasos 1 y 2 renderizados en local. El
Brick quedó vacío en esa prueba porque se usó una public key inventada — con la credencial TEST
real renderiza. Esa parte se comprueba recién en el bloque D.

### E2. Grabar
Una sola toma, sin cortar, mostrando el recorrido completo.

---

## Bloque F — Orden productiva *(decisión tuya, mueve dinero real)*

MP exige **al menos un Order ID real con `live_mode: true`** para cerrar. No hay forma de
evitarlo: es el último requisito de la lista de evidencias.

**Nada de este bloque se ejecuta sin tu autorización expresa.**

> **La superficie del video no sirve para esto.** `/homologacion/compra` se bloquea a
> propósito cuando `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` está encendida (ver
> `assert-safe-environment.ts`): las dos banderas son mutuamente excluyentes por diseño,
> para que la pantalla del video nunca pueda mover dinero real. Por eso la orden de cierre
> tiene su propia superficie, `/admin/cierre-split-1n`, con sus propios frenos.

### F1. Decidir el caso — DECIDIDO (2026-11-04): Club 9 de Julio

Reemplaza al caso de Marcos Piaggio del 28/10. Se eligió un caso con ventas reales y
semanales: el Club 9 de Julio (Rafaela) organiza los partidos y sus fotógrafos venden en
CLF. Hoy la plataforma cobra todo y el club pide retiros por transferencia
(`EventOrganizerCommission`, `HELD_BY_PLATFORM`).

| Rol | Quién | % del total pagado | Con una foto de $3.000 (paga $3.450) |
|---|---|---|---|
| Owner (cobrador) | La plataforma | 13,04 % | ~$450 — el 15 % sobre el precio |
| Partner — organizador | Club 9 de Julio | 43,48 % | ~$1.500 |
| Partner — fotógrafo | El fotógrafo del partido | 43,48 % | ~$1.500 |

**Por qué 13,04 % y no 15 %:** la plataforma cobra el 15 % como recargo sobre el precio,
pero Mercado Pago reparte sobre el total que paga el comprador. 15/115 ≈ 13,04 %.
Coincide con las ventas del club en CLF: al 50 %, $119.880 de plataforma sobre $799.200
de precio.

`DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_A` es el fotógrafo y `_RECEIVER_B` el organizador.

**El monto.** Mercado Pago **no** fija un mínimo para esta operación; el único mínimo que
puede aplicar es el del medio de pago (Marilyn Urrego, 2026-10-30). Lo que hay que mirar no
es el total sino **la porción más chica del reparto**: con el reparto del club la porción más chica es la de la plataforma (13,04 %). El valor por
omisión es $3.450, con tope duro de $5.000.

**Quién paga — confirmado por Mercado Pago.** Tiene que ser **un tercero con tarjeta
propia, distinto de los tres que reciben el reparto**. No alcanza con que no sea el
collector: tampoco puede ser el fotógrafo ni el club.

Se declara en `DNX_CLF_SPLIT_1N_CIERRE_PAYER_EMAIL`. La pantalla avisa si no está declarado,
y el servidor **rechaza la orden** si el correo del pagador coincide con el de alguno de los
receptores — los compara contra los que devuelve la consulta del consentimiento, que es la
única fuente que sabe a qué cuenta pertenecen.

Conviene que la persona esté presente: la pantalla corre en la máquina local y la tarjeta la
carga quien paga.

### F2. Consentimientos en producción

> **BLOQUEADO POR LA CREDENCIAL (2026-10-31, causa hallada el 2026-11-02).**
>
> | Operación | Resultado |
> |---|---|
> | `GET /v1/split-consent` | 200, lista vacía |
> | `POST /v1/split-consent` | **403 `Operation not allowed`** |
>
> El 31/10 esto se leyó como una falta de permisos de Mercado Pago y se le escaló a Marilyn,
> que lo derivó a su equipo. **Era un error de diagnóstico.** `GET /users/me` con ese mismo
> token devuelve:
>
> ```
> id: 3141372692 | nickname: TESTUSER313600323196489184 | email: test_user_…@testuser.com
> ```
>
> Es un **usuario de prueba**. Mercado Pago emite sus credenciales con prefijo `APP_USR-`,
> igual que las productivas, así que el control `token.startsWith("TEST-")` no los ve. Un
> usuario de prueba lee la lista de consentimientos pero no puede crear consentimientos
> reales: de ahí el 403, y de ahí que la lectura funcionara.
>
> La aplicación sí era la correcta (`MP_CLIENT_ID` = `6578882958889626`, DNX Suite). Haber
> verificado la aplicación y no la **cuenta** fue lo que sostuvo el error durante dos días.
>
> **Lo que falta para desbloquear F2 y F3:** la credencial productiva de la cuenta real que
> cobra, en `MP_ACCESS_TOKEN`. Nada que Mercado Pago tenga que habilitar.
>
> Desde ahora `assertLiveCollectorAccount` (`live-account-guard.ts`) consulta `GET /users/me`
> antes de cualquier escritura productiva y frena si la cuenta es de prueba. El ensayo sin
> `--confirm` informa de quién es la cuenta antes de tocar nada:
>
> ```
> "status": "CUENTA_RECHAZADA",
> "errorCode": "MP_CUENTA_DE_PRUEBA",
> "message": "La credencial es de una cuenta de prueba de Mercado Pago (TESTUSER3136…)"
> ```


Cada partner necesita su `split-consent` en `ACTIVE` **antes** de crear la Order. Se otorga
del lado de Mercado Pago; la plataforma solo manda la invitación.

Primero hacen falta los correos de **las cuentas de Mercado Pago** de los dos partners —
pueden no ser los mismos con los que entran a CLF.

```bash
DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED=true \
pnpm --filter @repo/payments exec tsx src/cli/prod-split-consent-invite.ts -- \
  --email=<correo-del-fotografo> --email=<correo-del-referidor> --confirm
```

Sin `--confirm` hace una pasada en seco. Devuelve, por cada uno, el `receiver_id` y el
`inviteUrl` que hay que hacerle llegar. Cuando los dos estén `ACTIVE`, seguir.

### F3. Ventana controlada

La pantalla corre **en local contra credenciales productivas**: no se despliega. Así la
orden es real pero no queda ninguna superficie que mueva dinero expuesta en el sitio.

1. Cargar en el entorno local, además del token productivo:

   | Variable | Qué es |
   |---|---|
   | `DNX_CLF_SPLIT_1N_CIERRE_PRODUCCION_ENABLED` | `true` solo para esta operación |
   | `DNX_CLF_SPLIT_1N_CIERRE_OWNER_USER_ID` | `user_id` de Mercado Pago de la cuenta cobradora |
   | `DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_A` | `receiver_id` del fotógrafo (lo da F2) |
   | `DNX_CLF_SPLIT_1N_CIERRE_RECEIVER_B` | `receiver_id` del referidor (lo da F2) |
   | `DNX_CLF_SPLIT_1N_CIERRE_MONTO_CENTAVOS` | opcional; por omisión 300000 ($3.000) |
   | `DNX_CLF_SPLIT_1N_CIERRE_PAYER_EMAIL` | **el tercero que paga**; sin esto el pagador sería el admin |

2. `pnpm --filter compramelafoto dev` y entrar a `/admin/cierre-split-1n` con sesión de admin.
3. Pagar con una tarjeta real. La pantalla verifica los dos consentimientos **antes** de
   cobrar: si alguno no está `ACTIVE`, no crea nada.
4. Copiar el Order ID entero y verificar `live_mode: true`. Queda también en
   `.local/cierre-split-1n/ultima.json`.
5. **Apagar `DNX_CLF_SPLIT_1N_CIERRE_PRODUCCION_ENABLED`.**

### F4. Revertir

Reembolso total vía `POST /v1/orders/{id}/refund`, que ya está implementado y probado. En
una orden con split el cuerpo lleva `splits` de primer nivel, nunca `transactions`.

---

## Bloque G — Entrega a Mercado Pago

Paquete final con las cuatro evidencias que pide el checklist:

| Evidencia | De dónde sale |
|---|---|
| Video del flujo de pago aprobado | Bloque E |
| Split con múltiples partners (owner + 2) | ✅ **YA OBTENIDA** el 2026-09-17 — orden `ORDTST01M2R3…`, `PROCESSED_ACCREDITED`, 3 receptores. Ver [auditoría §8](./mp-split-1n-checklist-oficial-auditoria.md) |
| GET a la orden post-webhook | Bloque D, paso 5 |
| Order ID productivo con `live_mode: true` | Bloque F |

---

## Resumen de quién hace qué

| Bloque | Quién |
|---|---|
| ~~A1 commit · E1 vista de comprador~~ | ✅ **Hechos el 2026-09-03** |
| A2 responder · B1–B4 panel · C variables | Vos |
| D prueba punta a punta | Vos ejecutás, yo verifico la evidencia |
| E2 grabar | Vos |
| F orden productiva | **Vos decidís y autorizás** |
| G entrega | Vos, con el paquete que armo |

### El camino más corto

B → C → D te deja con **dos de las cuatro evidencias** y sin gastar un peso. E suma la tercera.
F es la única que requiere dinero real, y conviene dejarla para el final, cuando todo lo demás
ya esté verificado.
