# CLICKATÓN — ETAPA 10D3I-I0 — DISEÑO, GOBERNANZA Y PREFLIGHT PARA CUENTAS MERCADO PAGO REALES DE LOS SOCIOS

**Fecha:** 2026-07-23
**Rama:** `migration-legacy-clf-to-monorepo`
**HEAD base:** `024f47a` (H2 validado)
**Veredicto de etapa:** **IMPLEMENTADO — DECISIÓN DE OWNER PENDIENTE**
**Cuentas reales conectadas:** **NINGUNA**
**OAuth real:** **NO EJECUTADO**
**Push / deploy / producción:** **NO**

---

## 1. Diagnóstico

Las etapas C→H2 demostraron Financial Identity, vault, acuerdo TEST 34/33/33, Orders 1:N sandbox, observe/reconcile y checkout de inscripción DNX en staging. **No existe aún** un camino Clickatón OAuth → Financial Identity → vault para socios reales.

| Pieza | Estado |
|---|---|
| FI / PaymentAccount / Credential vault | Listo (dominio + schema) |
| EconomicAgreement + DistributionVersion | Listo (TEST staging intacto) |
| Finance grants (`DNX_FINANCE_OWNER`, etc.) | Listo |
| OAuth Mercado Pago (CLF) | Existe, **legacy** (`User.mp*` / `Lab.mp*` plaintext) |
| OAuth Clickatón → FI | **Falta** (I1+) |
| UI socio `/cuenta/cobros` | Diseño I0; no activada |
| Readiness productivo | **Implementado** (read-only + mocks) |
| Cuentas MP reales socios | **No conectadas** |
| Decisión cuenta owner/collector | **PENDIENTE DE DANIEL** |

Código I0: `packages/payments/src/partner-onboarding/`.

---

## 2. Decisión de cuenta owner

**Estado: PENDIENTE DE DANIEL**

### Hechos

- La autoridad financiera de suite se modela con grant `DNX_FINANCE_OWNER` (staging: Dani fixture).
- `DNXfotografia@gmail.com` aparece como admin allowlist / identidad operativa DNX, **no** como binding automático de seller MP owner en código.
- Documentación previa (10D1 / FI) indica que Clickatón debe usar una cuenta MP **específica del producto**, distinta del OAuth fotógrafo CLF / DNX Estudio genérico.
- El collector/owner de Orders 1:N es quien crea la orden y orquesta receivers; los socios son receivers con consentimiento.

### Opciones a decidir (sin conectar nada en I0)

| Opción | Descripción | Implicación |
|---|---|---|
| A | Cuenta MP productiva de **DNX Fotografía** (misma seller que admin) como owner/collector | Simplicidad operativa; riesgo de mezclar productos si no se aísla app/credenciales |
| B | Cuenta MP **Clickatón-específica** (recomendada por docs) como owner | Separación de producto; requiere crear/verificar seller + app redirects |
| C | Un socio (Daniel) como owner MP y además receiver | Posible, pero confunde rol societario vs autoridad financiera; requiere confirmación reforzada |

**Recomendación de diseño:** opción **B** (cuenta Clickatón-específica) + grant `DNX_FINANCE_OWNER` en el User DNX de Daniel (o identidad org Clickatón), **sin** que ser socio implique poder publicar % o cutover.

**Bloqueo I1:** no abrir OAuth owner hasta que Daniel elija A/B/C por escrito y se registre en checklist I1.

---

## 3. Identidades de los socios

| Socio | Rol societario | Representación FI | Rol en Distribution | Puede publicar % |
|---|---|---|---|---|
| Daniel | Socio + autoridad financiera candidata | `DnxFinancialIdentity` PERSON (o ORG Clickatón) primaria del User DNX | Owner/collector **y/o** participant según decisión owner | Solo con `DNX_FINANCE_OWNER` |
| Rodrigo | Socio | FI propia User DNX | Receiver participant | No |
| Tamara | Socio | FI propia User DNX | Receiver participant | No |

Reglas:

- Ser socio ≠ administrador financiero global.
- Una PaymentAccount LIVE `(provider, providerUserId, environment)` única en la suite.
- No reutilizar `User.mp*` / `Lab.mp*` de CLF.
- Scope productivo propuesto: `clickaton` / `PRODUCT` / `partners-production` (constante `CLICKATON_PRODUCTION_AGREEMENT_SCOPE`).
- Scope TEST `partners-10d3i-e` **intacto** (no mutar).

---

## 4. Roles y permisos

### Capacidades existentes (reutilizar)

| Capability / concepto | Uso |
|---|---|
| `DNX_FINANCE_OWNER` | Publicar DistributionVersion, modificar %, activar producción (con hard gates) |
| `DNX_FINANCE_ADMIN` | Ops finance suite |
| `PRODUCT_FINANCE_MANAGER` | Manager por `productKey` |
| `PRODUCT_FINANCE_VIEWER` | Lectura acuerdo |
| PARTICIPANT_SELF / `assign_own_payment_account` | Conectar cuenta propia |
| Admin Clickatón allowlist | **No** equivale a finance grant |

### Mapeo de nombres pedidos en I0

| Nombre pedido | Equivalente |
|---|---|
| `DNX_FINANCE_OWNER` | Ya existe |
| `CLICKATON_PARTNER` | Rol societario / participant self (no capability nueva) |
| `CLICKATON_FINANCE_VIEWER` | `PRODUCT_FINANCE_VIEWER` + productKey `clickaton` |
| `CLICKATON_AGREEMENT_ADMIN` | `DNX_FINANCE_OWNER` o `PRODUCT_FINANCE_MANAGER` clickaton |
| `PAYMENT_ACCOUNT_OWNER` | Ownership FI + PaymentAccount del User |
| `PAYMENT_ACCOUNT_CONSENT_GRANTOR` | Mismo User al aceptar OAuth/consent grant |

### Matriz

| Acción | Daniel (socio) | Rodrigo | Tamara | DNX_FINANCE_OWNER | Sistema |
|---|---:|---:|---:|---:|---:|
| Conectar su propia cuenta | Sí | Sí | Sí | Sí | No |
| Ver estado propio | Sí | Sí | Sí | Sí | Sí |
| Ver receiver ID completo | No | No | No | No | Sí |
| Ver access token | No | No | No | No | No |
| Modificar porcentajes | No* | No | No | Sí | No |
| Publicar DistributionVersion | No* | No | No | Sí | No |
| Activar producción | No* | No | No | Sí | No |
| Revocar cuenta propia | Sí | Sí | Sí | Sí | No |
| Revocar cuenta ajena | No | No | No | Sí | No |
| Consultar liquidaciones propias | Sí | Sí | Sí | Sí | Sí |
| Consultar liquidaciones globales | No | No | No | Sí | Sí |

\*Si Daniel también tiene grant `DNX_FINANCE_OWNER`, esas acciones las ejerce **como finance owner**, no por ser socio. Código: `PARTNER_PERMISSION_MATRIX` / `canPartnerPerform`.

---

## 5. Estados de conexión

Canónicos en `PartnerPaymentConnectionStatus`:

`NOT_CONNECTED` → `OAUTH_PENDING` → `CONNECTED_UNVERIFIED` → `VERIFIED` → `CONSENT_PENDING` → `ACTIVE`
(+ `EXPIRED` / `REVOKED` / `ERROR` / `DISABLED`)

Transiciones prohibidas (ejemplos): skip a `ACTIVE` sin OAuth; reactivar `REVOKED`→`ACTIVE` sin OAuth.

---

## 6. OAuth actual (auditoría)

### CLF (único flujo MP OAuth en repo)

- Rutas: `apps/compramelafoto/app/api/mercadopago/oauth/{start,callback,connect}`
- State UUID en DB, TTL ~10 min, one-shot
- **Sin PKCE**
- **Sin scopes explícitos** en authorize URL
- Tokens en **plaintext** `User.mpAccessToken` / `Lab.mp*`
- **No** escribe Financial Identity / vault

### Clickatón

- **Cero** rutas `mercadopago/oauth`
- Checkout H2 usa credentials TEST / Orders staging flags, no OAuth de socios

### Requisitos del callback futuro (I1+)

Nunca confiar solo en:

- email del frontend
- `userId` query
- provider user id del frontend
- receiver ID manual

Debe: validar sesión DNX + state firmado/single-use + exchange server-to-server + asociar a FI del usuario autenticado + vault.

---

## 7. Aplicación Mercado Pago (checklist manual — Daniel)

Sin ingresar al panel ni usar secretos en I0:

1. Verificar si existe una **única** Developer App DNX vs app Clickatón-específica.
2. Anotar nombre de app y producto asociado.
3. Separar credenciales **TEST** vs **PROD**.
4. Redirect URLs necesarias (propuestas):
   - staging: `https://<clickaton-staging-host>/api/mercadopago/oauth/callback`
   - prod: `https://<clickaton-prod-host>/api/mercadopago/oauth/callback`
5. Notification / webhook URL productiva (Orders observe) — distinta de TEST.
6. Obtener/rotar webhook secret (fuera de Git).
7. Política refresh/expiry documentada.
8. Confirmar que client secret solo vive en secret manager / env, nunca en repo.
9. No reutilizar redirect CLF para socios Clickatón sin revisión de app.

---

## 8. Scopes

Principio: menor privilegio. Clasificación en `CLICKATON_MP_SCOPE_REQUIREMENTS`:

| Scope | Clase | Notas |
|---|---|---|
| `offline_access` | obligatorio | refresh |
| `read` | obligatorio | identity / account id S2S |
| `write` / `payments` | opcional | solo si hace falta contexto seller |
| `wallet_balance` | innecesario | — |
| `full_admin` | riesgoso | nunca |

Nota: el OAuth CLF actual no envía scopes; I1 debe negociar scopes explícitos con la app MP.

---

## 9. Vault y tokens

- AES-256-GCM + key id + nonce + auth tag (módulo `credential-vault`)
- Persistencia: `DnxEncryptedCredential` + `credentialReference` opaco en PaymentAccount
- Nunca logs / frontend / docs / Git
- Refresh server-side; revocación invalida credential + estado cuenta
- **Prohibido** escribir tokens en `User.mp*` / `Lab.mp*` para partners Clickatón

---

## 10. Consentimientos

- Consent de participación económica + OAuth grant MP
- Estado ACTIVE requerido para readiness de receivers
- Revocación → bloquea nuevas órdenes productivas; **no** muta snapshots históricos
- Registro audit: `CONSENT_GRANTED` / `CONSENT_REVOKED`

---

## 11. Revocación y reconexión

| Evento | Efecto |
|---|---|
| Revoke propio | Cuenta → `REVOKED`; readiness falla; nuevas Orders prod bloqueadas |
| Revoke ajeno | Solo `DNX_FINANCE_OWNER` |
| Revoke en panel MP | Detectar en refresh/check; marcar EXPIRED/REVOKED |
| Reconexión | Nuevo OAuth completo; nuevo credential; no editar snapshot viejo |
| Owner revocado | Hard block operaciones productivas hasta reconexión reforzada |

---

## 12. Economic Agreement productivo

- Porcentajes **solo** en `EconomicAgreement` / `DistributionVersion` / rules
- No viven en OAuth ni PaymentAccount ni frontend
- Target BPS documentado: 3400/3300/3300 (`CLICKATON_PRODUCTION_TARGET_BPS`) — **no** publicar en I0
- Acuerdo TEST 10D3I-E **no se modifica**
- Snapshot por orden append-only e inmutable

---

## 13. DistributionVersion productiva

Proceso (I4):

1. Todas las cuentas requeridas `ACTIVE`
2. Consentimientos ACTIVE
3. Owner válido
4. Receivers válidos
5. Total 10000 bps
6. Moneda válida
7. Acuerdo aprobado
8. Preview
9. Confirmación reforzada (finance owner)
10. Publicación append-only
11. Auditoría `VERSION_PUBLISHED`
12. Versión publicada inmutable

**Quién publica:** solo actor con `DNX_FINANCE_OWNER` (recomendado: Daniel con grant). Segundo aprobador humano opcional fuera de banda hasta existir dual-control en código.

---

## 14. Readiness checker

Servicio: `evaluateClickatonProductionPaymentReadiness`
Input default: vacío (fail closed).
Simulado completo: solo tests (no implica cuentas reales).

| Gate | Estado simulado (default I0) | Bloqueante |
|---|---|---|
| ownerDecisionDefined | false | Sí |
| oauthPartnerPathReady | false | Sí |
| vaultReady | true | Sí |
| ownerConnected | false | Sí |
| ownerVerified | false | Sí |
| partnerRodrigoConnected | false | Sí |
| partnerRodrigoConsentActive | false | Sí |
| partnerTamaraConnected | false | Sí |
| partnerTamaraConsentActive | false | Sí |
| agreementExists | false | Sí |
| distributionPublished | false | Sí |
| totalBpsValid | false | Sí |
| webhookConfigured | false | Sí |
| webhookSecretConfigured | false | Sí |
| productionFlagsOff | true | Sí |
| legacyCheckoutAvailable | true | No |

`readyForMicroTransaction` / `readyForCutover` = **siempre false** en I0.

---

## 15. Hard gates

Ningún flujo productivo si falta: owner, receiver, consentimiento, versión publicada, 10000 bps, webhook, secret, host esperado, confirmación explícita, feature flag productivo, auditoría. Flags create/observe/checkout OFF hasta etapas I6–I9.

---

## 16. UI

### Socio (diseño; ruta sugerida `/cuenta/cobros`)

Mostrar: estado, nombre parcial, email enmascarado, fechas, consentimiento, capacidad recibir, errores, conectar/reconectar/revocar, historial básico.
No mostrar: tokens, receiver completo, %, credenciales ajenas.
Copy: `PARTNER_ACCOUNT_UI_MESSAGES`.

### Panel financiero (diseño)

Estado owner/receivers, consent, última validación, readiness, versión, bloqueos, auditoría, verificar — sin secretos.
Copy: `FINANCE_PANEL_UI_MESSAGES`.

---

## 17. Threat model (mínimo)

| Riesgo | Impacto | Control existente | Pendiente |
|---|---|---|---|
| OAuth CSRF | Alto | State one-shot CLF | PKCE + state firmado Clickatón |
| Account substitution | Crítico | FI unique providerUserId | Binding sesión+FI en callback Clickatón |
| Callback replay | Alto | State consumido CLF | Mismo en path Clickatón |
| Token leak | Crítico | Vault FI | No reusar plaintext CLF |
| Wrong receiver | Crítico | S2S id en TEST | Verificación LIVE + readiness |
| Duplicate account | Alto | Unique live provider | Enforce en connect |
| Rogue % change | Crítico | Finance grants + versioning | UI sin inputs %; audit |
| Owner replacement | Crítico | — | Confirmación reforzada I1 |
| Revoked/stale consent | Alto | Status + readiness | Cron/check refresh |
| Prod/test mix | Crítico | env en PaymentAccount | Gates + flags |
| Accidental live tx | Crítico | Flags OFF | I0–I5 sin create prod |
| Malicious frontend payload | Alto | — | Ignorar ids/emails del client |
| Insider access | Alto | Grants | Least privilege + audit |

---

## 18. Plan I1→I9 (no ejecutar)

| Etapa | Objetivo |
|---|---|
| **I1** | Conexión controlada owner real (tras decisión) |
| **I2** | Conexión Rodrigo |
| **I3** | Conexión Tamara |
| **I4** | Acuerdo + DistributionVersion productiva |
| **I5** | Dry-run productivo sin cobro |
| **I6** | Microtransacción real controlada |
| **I7** | Webhook HTTP real + reconcile |
| **I8** | Rollout limitado |
| **I9** | Cutover productivo |

Fallback: checkout vigente hasta cutover; flags OFF permiten revert sin tocar cobros legacy.

---

## 19. Checklists manuales

### Daniel

- [ ] Decidir cuenta owner (A/B/C) por escrito
- [ ] Verificar/crear Developer App MP
- [ ] Redirect + notification URLs
- [ ] Webhook secret en secret store
- [ ] Credenciales PROD fuera de Git
- [ ] Iniciar OAuth owner (solo I1+)
- [ ] Convocar Rodrigo / Tamara
- [ ] Aprobar DistributionVersion (I4)
- [ ] Aprobar microtransacción (I6)
- [ ] Aprobar cutover (I9)

### Rodrigo / Tamara

- [ ] Login User DNX propio
- [ ] Abrir “Cuenta de cobro”
- [ ] Autorizar **solo** su cuenta MP
- [ ] Verificar estado ACTIVE
- [ ] No compartir contraseñas/tokens
- [ ] Avisar si revocan permisos en MP

---

## 20. Auditoría

Eventos: `OAUTH_STARTED`, `OAUTH_CALLBACK_RECEIVED`, `ACCOUNT_CONNECTED`, `ACCOUNT_VERIFIED`, `CONSENT_GRANTED`, `CONSENT_REVOKED`, `TOKEN_REFRESHED`, `ACCOUNT_RECONNECTED`, `ACCOUNT_REVOKED`, `DISTRIBUTION_READY`, `DISTRIBUTION_BLOCKED`, `VERSION_PUBLISHED`. Sin secretos ni PII innecesaria.

---

## 21. Límites I0

- Sin OAuth real / sin cuentas reales / sin tokens reales
- Sin DistributionVersion productiva
- Sin cobros / microtx / deploy / push
- Sin mutar acuerdo TEST ni snapshots E/H2
- Sin activar FI ONLY / PREFER / Orders / checkout DNX
- Sin modificar `User.mp*` / `Lab.mp*`

---

## 22. Preguntas pendientes

1. ¿Cuál es la cuenta MP owner/collector productiva (A/B/C)?
2. ¿App Developer única DNX o app Clickatón dedicada?
3. ¿Dual-control humano para publish DistributionVersion además del grant?
4. ¿Redirect hosts exactos staging/prod Clickatón?
5. ¿Daniel actúa solo como finance owner o también como receiver en el split 34%?

---

## 23. Código I0

| Archivo | Rol |
|---|---|
| `packages/payments/src/partner-onboarding/*` | Estados, gobernanza, readiness, UI copy, tests |
| Export `@repo/payments` | `evaluateClickatonProductionPaymentReadiness`, matrices |

---

## Referencias

- FI: `docs/dnx-payments/financial-identity-domain.md`
- Acuerdo TEST: `docs/clickaton/ECONOMIC_AGREEMENT_1N_STAGING_10D3I_E.md`
- Orders F/G/H/H2: docs `ORDERS_*` / `REGISTRATION_CHECKOUT_*`
