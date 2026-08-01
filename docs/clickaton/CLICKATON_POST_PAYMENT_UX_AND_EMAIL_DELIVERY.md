# Clickatón — Post-payment UX + email delivery (10G.9)

**Fecha:** 2026-07-31  
**Dominio:** https://maratonfotografica.com  
**Edición:** `clickaton-argentina-2026`  
**Acción legal:** ninguna nueva (Terms v2 + hechos ya aprobados).

---

## 1) Inscripción LIVE auditada (read-only)

| Campo | Valor |
|-------|-------|
| Registration | `cms9mpquu0001l104fi0ltw8m` |
| Participante | Maria belen Cordoba · IG `belensaldana40` |
| Código | `CKA26-00002` |
| Payment | APPROVED |
| Registration | CONFIRMED |
| Credential | ACTIVE |
| Talle | S · remera incluida |
| Welcome Card | GENERATED |
| User DNX | id 7 · `hasPassword=true` |
| EmailQueue | id 2 · status SENT · attempts 1 |
| Resend ID | `39b7a548-a15a-4e4d-aa1e-22f1d219c873` |

**Hallazgo crítico de ruteo:** la cola envió a `cl***@example.test` (sink de test), **no** al Gmail del participante (`be***@gmail.com`). Por eso el mensaje aparece en Resend pero el participante no lo recibe.

Causa: `resolveRecipient` en Staging/dev redirigía a fallback/sink cuando faltaba `CLICKATON_EMAIL_ALLOW_ANY`. En Production la audiencia ahora **siempre** usa el email real del participante.

---

## 2) Diagnóstico Resend (mensaje real)

| Campo | Valor |
|-------|-------|
| Recipient (cola) | sink `example.test` (incorrecto) |
| Recipient (inscripción) | Gmail real del participante |
| Subject | Inscripción confirmada — Clickatón Argentina 2026 |
| From | (runtime `EMAIL_FROM` en Vercel — encrypted) |
| Resend ID | `39b7a548-a15a-4e4d-aa1e-22f1d219c873` |
| Status API local | **UNKNOWN** — `RESEND_API_KEY` Production no se pudo leer en pull local (valor vacío / Sensitive) |
| Clasificación operativa | **MISDELIVERED_TO_TEST_SINK** (no es inbox-placement del Gmail real) |

No se declara DELIVERED al participante: el servidor destino del sink no es su bandeja.

Tras deploy del fix + reenvío seguro → re-clasificar el nuevo messageId.

---

## 3) UX post-pago

Pantalla `/maratones/[slug]/inscripcion/pago/exito`:

- Título `¡TU INSCRIPCIÓN ESTÁ CONFIRMADA!`
- Subtítulo primera edición
- Sello **PAGO APROBADO**
- Datos: nombre, Instagram, número, estado, talle, remera, email
- QR grande (token ACTIVE existente) + Descargar / Ver credencial
- Acreditación Fontanarrosa · Rosario · 19/09/2026 · 14:00–16:00 / charla 16:00–16:30
- Flag `VENUE ADDRESS HUMAN CONFIG REQUIRED` (sin dirección postal inventada)
- Cronograma v2 + aviso captura 16:00–20:00
- CTA Cuenta DNX (activar vs ir a cuenta)
- Aviso email + **REENVIAR EMAIL** (token + rate limit)
- Acciones priorizadas + Bases y Condiciones

Copy compartido: `lib/registration/ui/post-payment-public-copy.ts`.

---

## 4) Reenvío seguro

- Action: `resendConfirmationEmailAction` / admin `adminResendConfirmationEmailAction`
- Reglas: token válido propio · máx. 3 / 15 min · audit `EMAIL_RESEND` · nueva idempotency `:resend:{ts}`
- No crea Registration / QR / credential nuevos
- Falla de email **no** desconfirma

---

## 5) Email rediseñado

- Marca `#F9B114`, encabezado confirmación, sello PAGO APROBADO
- Acreditación + cronograma + CTAs
- Links Production: `https://maratonfotografica.com`
- QR: botón **VER MI QR DE ACREDITACIÓN** (sin adjunto pesado)

---

## 6) Deliverability (audit no destructivo)

| Check | Estado |
|-------|--------|
| DKIM / SPF | Esperado PASS en dominio From (verificar en Resend domain) |
| DMARC | **RECOMMENDED** — no aplicar p=reject automáticamente |
| From | `EMAIL_FROM` Production (encrypted) — preferir `noreply@maratonfotografica.com` |
| Webhook eventos | **RESEND DELIVERY EVENT WEBHOOK MISSING** |
| Tracking | default Resend; sin cambios DNS en esta etapa |

---

## 7) Tests

```bash
pnpm exec tsx scripts/post-payment-ux.selfcheck.ts
pnpm exec tsx scripts/email-idempotency.selfcheck.ts
pnpm exec tsx scripts/resend-rate-limit.selfcheck.ts
```

---

## 8) Veredictos

```text
CLICKATON POST-PAYMENT EXPERIENCE READY   # tras deploy UX + fix recipient + reenvío
RESEND DELIVERY EVENT WEBHOOK MISSING     # observabilidad pendiente
CLICKATON EMAIL DELIVERY ACTION REQUIRED  # inscripción CKA26-00002: reenviar a Gmail real
```

No aplica `EMAIL DELIVERED — INBOX PLACEMENT ISSUE` al caso Belén: el correo **no** fue a su casilla.

---

## 9) Deploy

| Campo | Valor |
|-------|-------|
| Deploy | `dpl_GoVdDjHqGxzSqDBUkfm4nXWA1uZM` |
| Alias | https://maratonfotografica.com |
| Ready | READY |

Secrets Production (`RESEND_API_KEY`, `EMAIL_FROM`, `DATABASE_URL`) están como **Sensitive** en Vercel: no se pueden leer vía `vercel env pull` / `env run` desde ops local. El reenvío a Belén debe hacerse **en runtime Production** (admin **Reintentar envío** o botón REENVIAR del participante).

## 10) Acciones humanas pendientes

1. ~~Deploy Production del fix recipient + UX.~~ **DONE**
2. Admin → inscripción `CKA26-00002` → **Reintentar envío** (obligatorio: el envío original fue al sink `.test`).
3. Confirmar en Resend el nuevo messageId (to = Gmail real) y clasificar DELIVERED/BOUNCED/…
4. Implementar webhook Resend (etapa siguiente) sin bloquear inscripciones.
5. Completar dirección postal Fontanarrosa en configuración humana cuando esté confirmada.

---

**Fin 10G.9**
