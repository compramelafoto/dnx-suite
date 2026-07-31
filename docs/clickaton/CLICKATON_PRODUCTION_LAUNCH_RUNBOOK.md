# Clickatón — Runbook de lanzamiento Production

**Fecha:** 2026-07-30 (actualizado 10D.1)  
**Proyecto:** `clickaton-dnxsuite`  
**Dominio canónico:** `https://maratonfotografica.com`  
**DB Production (sanitizado):** Neon `ep-silent-haze-awfh50a5*` / `clickaton_production`  
**No usar:** Staging `ep-round-fog…` / `clickaton-staging`  
**Production Branch Vercel:** `main` (rama `migration-legacy-clf-to-monorepo` ≠ auto-Production)

**Estado 10D.1:** `PRODUCTION STORAGE BLOCKED` — ver `CLICKATON_FINAL_GO_NO_GO.md` + `CLICKATON_10D1_PRELAUNCH_REMEDIATION.md`.  
No abrir inscripciones ni cobro LIVE hasta cerrar R2, legal, OAuth Tammy y pago controlado.

---

## Orden de lanzamiento

### 0. Freeze + owners

- [ ] Owner técnico + owner legal + owner financiero (Tammy) disponibles.
- [ ] Canal de incidentes (WhatsApp/Slack) abierto.
- [ ] Confirmar ventana de lanzamiento (no viernes noche sin soporte).

### 1. Backup Production

- [x] Neon: branch `backup-before-clickaton-production-launch` (`br-proud-butterfly-awggsxia`).
- [x] Verificar nombre/proyecto/parent `production`.
- [ ] **STOP** si no hay backup verificable. *(cumplido en 10D.1)*

### 2. Migraciones

```bash
# Con DATABASE_URL / DIRECT_URL de Production (nunca Staging)
pnpm --filter @repo/db exec prisma migrate status
# Solo si limpio y aprobado:
pnpm --filter @repo/db exec prisma migrate deploy
```

- [x] `migrate deploy` 10D.1 — schema up to date (90).
- [x] Nunca `prisma db push`.

### 3. Validación de env Production

- [x] `CLICKATON_DNX_PAYMENTS_PROVIDER=manual` (valores LIVE `mercado_pago_production` **forbidden** en código).
- [ ] Confirmar runtime `DNX_SOCIAL_PUBLISHER_LIVE=false`.
- [ ] **R2 Production** configurado + smoke (BLOCKER 10D.1).
- [ ] `CLICKATON_PUBLIC_URL` / `APP_URL` / `AUTH_URL` = `https://maratonfotografica.com`.
- [ ] `CLICKATON_MP_REDIRECT_URI` exact =  
  `https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback`.

### 4. Deploy aplicación

- [x] Deploy Production 10D.1 `dpl_3SfbV8tbjwLNseaRwDWJWKwMjBgs` (kill switch UI).
- [x] Alias `maratonfotografica.com`.
- [x] Health: `ok:true`, host `ep-silent-haze…`, `publishedEditions: 1`.

### 5. Health + smoke cerrado

- [x] Landing `/` 200.
- [x] Ficha AR2026 200 + “Inscripciones próximamente”.
- [x] Webhook GET → 405.
- [ ] Admin login Google (humano).
- [x] Inscripciones **cerradas** (`registrationEnabled=false`).

### 6. Confirmación legal

- [ ] Pack: `CLICKATON_LEGAL_APPROVAL_PACK.md`.
- [ ] Obtener: **`LEGAL APPROVED FOR REGISTRATION`**.
- [ ] Publicar textos finales (no `*-test-v1`).
- [ ] Política reembolsos/cancelaciones publicada.

### 7. Email test Production

- [ ] Enviar email de prueba Resend (from verificado).
- [ ] Validar activación link con host Production.
- [ ] Outbox / retries OK.

### 8. Tammy OAuth LIVE (humano)

1. Tammy inicia sesión en Production (Google allowlist).  
2. Panel financiero Clickatón → **Conectar Mercado Pago**.  
3. Aprobar OAuth LIVE en MP.  
4. Validar automáticamente (sin loguear tokens):
   - callback OK;
   - mismo User.id DNX;
   - `DnxPaymentAccount` ACTIVE;
   - provider account id presente;
   - vault ok;
   - permisos financieros.

### 9. Configuración financiera edición

- [ ] Snapshot distribución: Tammy **100%** del distribuible.
- [ ] Gate LIVE verde (cuenta + webhook + vault).
- [ ] Daniel/Rodrigo sin % salvo decisión explícita.

### 10. Webhook + cron

- [ ] Notification URL Production registrada en app MP.
- [ ] Firma webhook OK.
- [ ] Cron `payments-reconciliation` activo (Bearer / Vercel cron).

### 11. Seed / edición AR2026 (aún cerrada)

- [x] Materializar `clickaton-argentina-2026` en Production.
- [x] Fecha única: **19/09/2026**.
- [x] Fases 25k / 30k / 35k.
- [x] Remera + talles + `stockLimit=100` (first-N).
- [x] `isPublished=true`; **`registrationEnabled=false`** hasta paso 13.
- [x] Ruta `/maratones/clickaton-argentina-2026` 200.

### 12. Smoke con inscripciones cerradas

- [x] Público no puede reservar/pagar (inscripción “no disponible”).
- [ ] Admin ve edición (humano).
- [x] Kill switch: `registrationEnabled=false` (UI “Inscripciones próximamente”).

### 13. Enable registrations (GO comercial)

- [ ] Checklist 10D sin BLOCKERS.
- [ ] Activar `registrationEnabled=true` + status `REGISTRATION_OPEN`.
- [ ] **No** abrir 6 ediciones a la vez.

### 14. Pago LIVE controlado (bajo riesgo)

- [ ] Una inscripción TEST controlada con dinero real mínimo (o política aprobada).
- [ ] Validar: order PAID, registration CONFIRMED, webhook y/o S2S, email, activación, QR.
- [ ] Refund/cancel según política de prueba (si aplica).
- [ ] No alterar catálogo/precios sin aprobación.

### 15. Monitor (primeras 2–4 h)

- [ ] Errores Vercel / logs webhook.
- [ ] Órdenes AWAITING vs PAID.
- [ ] Emails fallidos.
- [ ] Capacidad / first-N.
- [ ] Social publisher sigue OFF.

### 16. GO public / comunicación

- [ ] Solo después del pago controlado OK.
- [ ] Comunicar canal de soporte.

---

## Kill switch (sin deploy)

Cerrar inmediatamente nuevas reservas/checkouts:

1. Admin → edición → `registrationEnabled=false` (y/o status ≠ `REGISTRATION_OPEN`).  
2. Verificar landing: CTA “Inscripciones próximamente” / inscripción no disponible.  
3. **No** apagar webhooks ni panel admin.  
4. Pagos ya iniciados: dejar que webhook/reconcile terminen.

No existe hoy env `REGISTRATIONS_OPEN`; el switch operativo son **flags de edición**.

---

## Observabilidad (lookup rápido)

Buscar por (sanitizar PII en tickets):

| Clave | Dónde |
|-------|--------|
| Registration number / `visibleCode` (`CKA26-…`) | `ClickatonRegistration` |
| Email (hash/sanitizado) | `ClickatonRegistration.email` + `User.email` |
| DNX Payment Order id | `DnxPaymentOrder` + allocations |
| Mercado Pago payment / preference id | provider refs en order / webhook inbox |
| Correlation / request id | logs Vercel + `DnxPaymentAuditEvent` / webhook inbox |

Estados a correlacionar en un incidente:

1. Registration (+ paymentStatus)  
2. DNX Order (+ allocations)  
3. MP Payment / preference  
4. Webhook inbox (idempotencia)  
5. Email outbox / Resend  
6. Activation token / session  
7. QR / credential  
8. FotoRank sync (si aplica)

---

## Rollback

### Aplicación

- Vercel Rollback al deployment Production anterior sano (`vercel_rollback_release` / UI).

### DB

- Restaurar desde `backup-before-clickaton-production-launch` solo con plan escrito.
- Preferir forward-fix si hay pagos ya acreditados.

### Pagos

- **No borrar** `DnxPaymentOrder` / provider orders / inbox.
- Pausar nuevos checkouts vía kill switch.

### Inscripciones

- Preservar historial CONFIRMED / PENDING.
- No reutilizar números/QR.

### Email

- Pausar jobs/outbox si spam o bounce masivo.

### Social

- Mantener `DNX_SOCIAL_PUBLISHER_LIVE=false`.

---

## Contactos / evidencias a guardar

- Deploy ID + commit SHA.  
- Backup Neon name + timestamp.  
- Preference/payment IDs sanitizados del pago controlado.  
- Screenshot health host.  
- Acta legal `LEGAL APPROVED FOR REGISTRATION`.

---

## Referencias

- `docs/clickaton/CLICKATON_FINAL_GO_NO_GO.md`  
- `docs/clickaton/CLICKATON_10D1_PRELAUNCH_REMEDIATION.md`  
- `docs/clickaton/CLICKATON_LEGAL_APPROVAL_PACK.md`  
- `docs/clickaton/CLICKATON_COMMERCIAL_GO_LIVE_CHECKLIST.md`  
- `docs/clickaton/CLICKATON_10C3_MP_TEST_E2E_REPORT.md`  
- `docs/clickaton/RELEASE_10B2_PRODUCTION_INFRA_REPORT.md`
