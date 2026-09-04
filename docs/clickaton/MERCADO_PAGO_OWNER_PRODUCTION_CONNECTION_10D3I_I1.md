# CLICKATÓN — ETAPA 10D3I-I1 — CONEXIÓN CONTROLADA DE LA CUENTA MERCADO PAGO OWNER REAL

**Fecha:** 2026-07-23
**Rama:** `migration-legacy-clf-to-monorepo`
**HEAD base:** `4c98e6b` (I0)
**Veredicto:** **IMPLEMENTADO — LISTO PARA AUTORIZACIÓN MANUAL DE OAUTH OWNER**
(también pendiente: configuración de app MP dedicada en panel Developers)

**OAuth real:** **NO EJECUTADO**
**Cuenta owner real:** **NO CONECTADA**
**Push / deploy / cobros:** **NO**

---

## 1. Decisión owner (resuelta)

> ### ⚠️ SUPERADO — no usar esta sección como referencia
>
> Lo que sigue quedó **obsoleto en dos pasos**:
>
> 1. **2026-07-31 — la cuenta.** El launch gate de inscripciones fijó como collector real a
>    `dnxfotografia@gmail.com` (`providerUserId 97484805`, PA canónico `pa_ba733fa7a35f4326`).
>    **No** se creó una cuenta exclusiva de Clickatón. Lo dedicado terminó siendo la
>    *aplicación*, no la *cuenta*.
>    Ver [`CLICKATON_REGISTRATION_SALES_LAUNCH.md`](./CLICKATON_REGISTRATION_SALES_LAUNCH.md) §"Identidades".
> 2. **2026-09-03 — la aplicación.** Se decidió centralizar el flujo Split 1:N de toda la suite
>    en una sola aplicación. La app dedicada de Clickatón deja de ser el camino para Split.
>    Ver [`../payments/mp-split-1n-mercadopago-confirmations.md`](../payments/mp-split-1n-mercadopago-confirmations.md).
>
> El resto del documento (hosts, redirects, notification URLs, gates de autorización manual)
> **sigue siendo válido** y describe lo que efectivamente se construyó.

**OPCIÓN B — CUENTA MERCADO PAGO EXCLUSIVA DE CLICKATÓN** *(superada — ver aviso arriba)*

- No personal de Daniel / Rodrigo / Tamara
- No DNX Estudio operativo
- No Comprame La Foto
- Autoridad operativa: identidad DNX autorizada (`DNXfotografia@gmail.com` como operador)
- **Sin binding automático por email**

Daniel mantiene roles separados:

1. `DNX_FINANCE_OWNER` — configuración / readiness / aprobaciones
2. Partner receiver 3400 bps — PaymentAccount receiver **posterior** (no en I1)

---

## 2. Developer App

**Decisión:** aplicación Mercado Pago **dedicada a Clickatón** (no reutilizar CLF).

> **Superado el 2026-09-03 para Split 1:N.** El flujo Checkout API + Orders + Split 1:N se
> centraliza en una única aplicación de la suite. Las variables `CLICKATON_MP_*` de abajo
> siguen vigentes para lo que ya está construido y en uso (OAuth owner, Checkout Pro), pero
> **no** son el camino para Split.

### Variables (nunca en Git)

| Variable | Uso |
|---|---|
| `CLICKATON_MP_CLIENT_ID` | App dedicada |
| `CLICKATON_MP_CLIENT_SECRET` | Secret (secret store) |
| `CLICKATON_MP_REDIRECT_URI` | Callback exacto del entorno |
| `CLICKATON_MP_WEBHOOK_SECRET` | Firma webhooks |
| `CLICKATON_MP_PUBLIC_KEY` | Si aplica Checkout |
| `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` | Vault PROD |
| `DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED` | Panel/API (default off) |
| `DNX_CLICKATON_MP_OWNER_OAUTH_MANUAL_AUTHORIZED` | Gate OAuth live |
| `DNX_CLICKATON_MP_OWNER_OAUTH_AUTHORIZATION_PHRASE` | Frase exacta |

### Checklist panel MP (Daniel)

1. Crear/seleccionar app dedicada Clickatón
2. Separar credenciales TEST vs PROD
3. Redirect staging (abajo)
4. Redirect producción (abajo)
5. Notification URLs (abajo)
6. Webhook secret propio
7. Revisar permisos mínimos
8. No compartir secret con frontend

---

## 3. Hosts y redirects

| Entorno | Host | Proyecto Vercel |
|---|---|---|
| Producción | `https://maratonfotografica.com` | `clickaton-dnxsuite` |
| Staging | `https://clickaton-staging.vercel.app` | `clickaton-staging` |

Redirects OAuth:

- Staging: `https://clickaton-staging.vercel.app/api/clickaton/payments/mercadopago/callback`
- Producción: `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback`

Código: `CLICKATON_MP_REDIRECTS` en `@repo/payments`.

---

## 4. Notification URLs

- Staging: `https://clickaton-staging.vercel.app/api/webhooks/dnx-payments`
- Producción: `https://maratonfotografica.com/api/webhooks/dnx-payments`

---

## 5. Scopes

Intent documentado (menor privilegio): `offline_access` + `read`.
`write` / `payments` opcionales si Orders delegados lo requieren.

**Realidad MP Connect:** la authorize URL clásica usa `client_id`, `response_type`, `platform_id`, `state`, `redirect_uri` (+ PKCE S256 cuando habilitamos). MP puede ignorar `code_challenge`; igual persistimos verifier cifrado y lo enviamos en el exchange.

---

## 6. OAuth implementado (dominio)

Módulo: `packages/payments/src/partner-onboarding/owner-oauth/`

| Pieza | Rol |
|---|---|
| `ClickatonOwnerOAuthService` | start / callback / revoke / reconnect |
| PKCE S256 | challenge + verifier cifrado |
| State | hash single-use, TTL 10 min, bound a user/FI/product/purpose/env/callback |
| Vault | AES-256-GCM (`origin: clickaton_owner_oauth`) |
| Duplicate gate | providerUserId único live |
| Replacement gate | cuenta distinta ≠ reconnect normal |
| Dual-control publish | challenge types (sin publicar) |

Rutas HTTP (flag OFF por defecto):

- `GET /api/clickaton/payments/mercadopago/connect`
- `GET /api/clickaton/payments/mercadopago/callback`
- `POST .../revoke`
- `POST .../reconnect`

Panel: `/admin/finanzas/cuenta-owner` → `notFound()` si flag OFF.

---

## 7. Gate de autorización manual

Antes de OAuth live hace falta la frase exacta:

```text
AUTORIZO CONECTAR LA CUENTA OWNER REAL EXCLUSIVA DE CLICKATÓN
```

Reflejada en env (`DNX_CLICKATON_MP_OWNER_OAUTH_*`). Sin ella: **NO EJECUTADO**.

---

## 8. FinancialIdentity / PaymentAccount owner

- Org FI: `organizationRef = clickaton:partners-production:mp-owner`
- `originApp = clickaton`
- `externalReference = dedicatedProduct=clickaton`
- Capability: `COLLECTOR`
- Environment: `PROD`
- Tokens solo en vault (`credentialReference`)
- **Nunca** `User.mp*` / `Lab.mp*`

---

## 9. Readiness post-owner (simulado / hidratado)

Con owner ACTIVE (cuando exista):

| Gate | Estado esperado I1 | Bloqueante |
|---|---|---|
| ownerDecisionDefined | true | Sí |
| oauthPartnerPathReady | true | Sí |
| vaultReady | true | Sí |
| ownerConnected / ownerVerified | true (si conectado) | Sí |
| partnerRodrigo* / partnerTamara* | false | Sí |
| agreement / distribution | false | Sí |
| productionFlagsOff | true | Sí |
| readyForMicroTransaction | false | — |
| readyForCutover | false | — |

Hoy (sin conexión real): owner gates false; path OAuth listo en código.

---

## 10. Migración

`20260723120000_dnx_clickaton_mp_oauth_state` → tabla `DnxMercadoPagoOAuthState`.

- Aplicada en **staging** (`clickaton_staging`) vía SQL aislado (sin aplicar migración Infospot WIP ajena).
- **No** aplicada a producción.
- No altera User/Lab.mp*.

---

## 11. Intervención humana pendiente

1. Configurar app MP dedicada + secrets en secret store
2. Daniel confirma frase exacta de autorización
3. Activar flag onboarding solo en ventana controlada
4. Login DNX + OAuth en cuenta exclusiva Clickatón
5. Verificar panel (enmascarado) + readiness
6. Apagar flag

**No automatizar login/CAPTCHA/2FA.**

---

## 12. Rollback

- Flag OFF
- Revoke owner (dominio)
- Checkout legacy intacto
- Orders/checkout DNX OFF

---

## 13. Limitaciones I1

- OAuth real no ejecutado
- App MP credentials no en este entorno
- HTTP routes aún requieren binding runtime Prisma+vault en ventana autorizada (dominio 100% testeado con mocks)
- Rodrigo/Tamara no conectados
- Sin DistributionVersion productiva
- Dual-control publish preparado, no usado

---

## 14. Próximo paso

Esperar:

1. Configuración app MP dedicada
2. Frase: `AUTORIZO CONECTAR LA CUENTA OWNER REAL EXCLUSIVA DE CLICKATÓN`

Luego, **sin iniciar I2**, completar conexión owner.
I2 (Rodrigo) solo tras owner **CONECTADA Y VERIFICADA**.
