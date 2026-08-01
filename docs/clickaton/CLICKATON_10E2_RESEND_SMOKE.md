# Clickatón 10E.2 — Resend Production smoke y cierre de comunicaciones

**Fecha:** 2026-07-31  
**Dominio:** `https://maratonfotografica.com`  
**Deploy smoke:** `dpl_HWdRD7689x7UVFKKWgSeWuVYAosy`  
**Inscripciones:** `registrationEnabled=false`  
**Legal:** `LEGAL REVIEW REQUIRED`

---

## Veredicto

```text
PRODUCTION EMAIL PASS
```

Re-check 10E.3: smoke `PRODUCTION EMAIL SMOKE PASS` (confirmación + activación). DNS DKIM/SPF `send.` presentes.  
(Histórico: 10E.2.2 pasó por `HUMAN AUTH STEP REQUIRED` / domain verify; resuelto antes de 10E.3.)

### 10E.2.2 — MCP Web (parcial)

| Paso | Estado |
|------|--------|
| Playwright MCP | Arreglado spawn (`npx ENOENT` → path absoluto nvm). Quitado `--isolated` para persistir sesión MCP. |
| Resend Domains | Abierto → redirect **login** (`https://resend.com/login`). Sin sesión Chrome del usuario en el browser MCP. |
| Cloudflare DNS | No iniciado (bloqueado por auth Resend). |
| Smoke post-verify | Pendiente. |

**Intervención humana puntual:** iniciar sesión en Resend (y luego Cloudflare) en la ventana del browser MCP, sin pegar passwords en el chat. Después pedir continuar 10E.2.2.

DNS Cloudflare vía Wrangler OAuth: solo `zone (read)` — no alcanza para crear registros; hace falta UI MCP o token con `zone DNS edit`.

---

## Smoke ejecutado (Production runtime)

`POST https://maratonfotografica.com/api/cron/email-smoke`  
Confirm: `RESEND_SMOKE_10E2` · destinatario controlado `cuart.daniel@gmail.com`  
Auth ops: `CLICKATON_EMAIL_SMOKE_TOKEN` (no-sensitive; CRON Encrypted sigue ilegible vía CLI).

| Check | Resultado |
|-------|-----------|
| `RESEND_API_KEY` runtime | PRESENT |
| `EMAIL_FROM` | PRESENT → `Clickatón <noreply@maratonfotografica.com>` |
| `publicBase` | `https://maratonfotografica.com` |
| staging/localhost leak | none |
| Fecha evento en body | **19/09/2026** present |
| Subject confirmación | `Inscripción confirmada — Clickatón Argentina 2026` (sin `[TEST]`) |
| Envío confirmación | **FAIL** Resend 403 domain not verified |
| Activación DNX (`requestPasswordReset`) | token **created**; email **FAIL** mismo 403 |
| Links Production en HTML | PASS (no enviados) |

---

## Templates

| Template | Estado |
|----------|--------|
| `payment_confirmed` / free confirmed | EXISTS |
| `reservation_created` (pago pending / hold) | EXISTS |
| `hold_expired` | EXISTS |
| Activación / set-password (`Activá tu Cuenta DNX`) | EXISTS (`@repo/auth` isSetPassword) |
| pago rejected/failed dedicado | **MISSING** |
| refund/cancel dedicado | **MISSING** |

---

## Outbox / idempotencia

- `EmailQueue` + `paymentConfirmationIdempotencyKey(registrationId)` → 1 evento lógico / 1 send.
- Retry seguro hasta `maxAttempts`; `ALREADY_SENT` en reintento.
- Confirmación de pago **no bloquea** si falla mail (`notifyPaidRegistrationConfirmed` catch).
- Selfcheck: `scripts/email-idempotency.selfcheck.ts` → ok.

---

## UI feedback

`PaymentReturnView`: mensaje claro si audit `EMAIL_SENT` / `EMAIL_QUEUED` / sin audit; cobro independiente del mail.

---

## Bloqueo ops para destrabar

1. En Resend: Add + Verify domain `maratonfotografica.com`.
2. Publicar DNS (DKIM / SPF / opcional DMARC) en la zona del dominio.
3. Re-ejecutar smoke 10E.2 con el mismo endpoint.
4. Confirmar inbox + `last_event` delivered/accepted.

Hasta entonces: **no abrir inscripciones** · **no pago LIVE**.
