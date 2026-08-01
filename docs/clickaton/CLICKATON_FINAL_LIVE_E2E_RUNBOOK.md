# Clickatón — Runbook E2E LIVE controlado (única corrida)

**Edición:** Clickatón Argentina 2026 (`clickaton-argentina-2026`)  
**Dominio:** `https://maratonfotografica.com`  
**Fecha evento:** 19/09/2026 (`America/Argentina/Cordoba`)  
**Legal gate:** exige frase humana `LEGAL APPROVED FOR REGISTRATION`  
**Estado al redactar (10E.4):** capacidad LIVE + Welcome Card share **listas**; flag LIVE **OFF**; **NO ejecutar** cobro hasta Legal + armado explícito.

---

## Premisas (no negociables)

1. **Una sola** inscripción/pago LIVE de prueba controlada (cuenta interna).  
2. Inscripciones permanecen **cerradas al público** hasta GO explícito post-E2E (o se abren solo el tiempo mínimo del E2E con kill switch listo).  
3. No cambiar allocations durante el E2E (Plan B: DNX 100%).  
4. Social publisher LIVE permanece **OFF**.  
5. Destinatario de cobro: `dnxfotografia@gmail.com` / PA `pa_ba733fa7…` / **100%** / env **PROD**.

---

## Preflight obligatorio (T-0, sin cobrar)

Marcar cada ítem antes de abrir checkout LIVE:

| # | Check | Esperado | Stop si… |
|---|--------|----------|----------|
| 1 | Legal | `LEGAL APPROVED FOR REGISTRATION` | Falta frase |
| 2 | `registrationEnabled` | `true` solo durante ventana E2E | Queda abierto sin GO |
| 3 | Fase de precio vigente | **$25.000** (ventana 01–20/08/2026 AR) | Monto ≠ 25000 |
| 4 | Remera first-N | stockLimit 100 + deadline ≤30/08 23:59:59.999 AR | Beneficio mal cableado |
| 5 | Allocation ACTIVE | DNX `dnxfotografia@gmail.com` **100%** | recipient/≠100% |
| 6 | PA collector | `pa_ba733fa7…` ACTIVE + PROD | TEST/sandbox |
| 7 | Provider | `CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_production` | Staging / TEST |
| 7b | LIVE flag | `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=true` **solo tras Legal** | Flag ON sin Legal |
| 8 | Callbacks | `https://maratonfotografica.com/maratones/.../pago/{exito\|pendiente\|error}` | staging/localhost |
| 9 | Webhook | `…/api/webhooks/dnx-payments` Production | URL incorrecta / secret mismatch |
| 10 | Email | Resend dominio verified (evidencia 10E.2) | 403 domain |
| 11 | Social LIVE | `DNX_SOCIAL_PUBLISHER_LIVE≠true` | Auto-publish ON |
| 12 | Welcome Card share UX | `/mi-cuenta/inscripciones/{id}#placa` preview/descarga/share | Sin asset / 403 |

**Proyección orden (sin cobro):** precio $25.000 → recipient DNX / `dnxfotografia` → allocation 100% → env PROD.  
Preflight: `CLICKATON_LIVE_PREFLIGHT=1 pnpm exec tsx scripts/run-live-preflight-10e4.ts`  
También: `preflightClickatonLivePayments` / `dryRunEditionCheckoutPlanAction`. **No** usar `prepare-10c3-manual-checkout` para LIVE.

### Activación LIVE flag (solo post-Legal)

1. Confirmar frase `LEGAL APPROVED FOR REGISTRATION`.  
2. En Vercel Production:  
   - `CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_production`  
   - `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=true`  
3. Redeploy Production.  
4. Preflight → `liveExecution: ON` + `READY_CONFIGURATION`.  
5. Ejecutar E2E único.  
6. **Inmediatamente** volver flag a `false` (o quitar) si no hay GO de ventas público.

---

## Funnel E2E (orden exacto)

```text
Landing (/)
→ Maratón AR2026 → Inscribirme
→ Datos personales
→ Instagram
→ Remera incluida (copy first-100 / 30-08) + talle (XS–5XL / code XXXL=3XL)
→ Consentimientos (bases, privacidad, imagen, social no-auto)
→ Resumen $25.000
→ Mercado Pago LIVE (collector dnxfotografia)
→ APPROVED
→ Webhook DNX Payments (Production)
→ DnxPaymentOrder PAID + allocations snapshot 100% DNX
→ Registration CONFIRMED + visibleCode
→ Beneficio first-N (si cupo/deadline OK) → fulfillment remera
→ Credencial + QR
→ Email confirmación (Resend) + Activación Cuenta DNX (/recuperar set-password)
→ Welcome Card GENERATED (R2)
→ Panel usuario (/mi-cuenta/inscripciones/{id}#placa) — preview / Descargar / Compartir
→ Panel financiero edición (orden conciliable)
→ Conciliación: MP payment id ↔ order ↔ registration
```

---

## Ejecución (solo después de Legal Approved + unblock LIVE)

1. Confirmar preflight T-0 completo.  
2. Habilitar temporalmente `registrationEnabled=true` (ventana mínima).  
3. Ejecutar funnel con usuario controlado (email interno).  
4. Completar pago LIVE real **una vez**.  
5. Verificar webhook → PAID → CONFIRMED en &lt; N minutos.  
6. Verificar email + activación + QR + first-N item.  
7. Verificar panel financiero: recipient/monto/env.  
8. **Cerrar** `registrationEnabled=false` si el GO público no está autorizado.  
9. Documentar IDs: registrationId, orderId, providerPaymentId, messageId email (sanitizados).

---

## Stop conditions (abort inmediato)

Detener y **no reintentar** cobro si:

- recipient ≠ `dnxfotografia@gmail.com` / PA ≠ `pa_ba733fa7…`
- allocation ≠ 100% DNX
- environment ≠ PROD / LIVE
- monto ≠ precio vigente de fase ($25.000 en ventana actual)
- callback o webhook ≠ Production (`maratonfotografica.com`)
- aparece sandbox / test user / preferencia TEST
- order no queda conciliable (sin payment id / status inconsistente)
- `live_mode` rechazado por gates o `LIVE_MODE_FORBIDDEN` inesperado
- se dispara publicación social LIVE

**Rollback / contención**

1. `registrationEnabled=false` inmediato.  
2. No publicar social.  
3. Si cobro LIVE ya ocurrió: registrar orden; refund solo con procedimiento legal/ops (no automatizar en esta etapa).  
4. Dejar audit trail (registration audit + payment order + webhook logs).  
5. Reabrir solo con nuevo GO escrito.

---

## Post-E2E (no parte del cobro)

- Welcome Card: validar GENERATED + R2; share manual si UX ya no está blocked.  
- Templates email rejected/refund: deuda post-launch (no bloquean E2E si confirmación OK).  
- Tammy 100%: solo tras OAuth ACTIVE + republicar distribución (fuera de este E2E).

---

## Frases de control

| Momento | Frase requerida |
|---------|-----------------|
| Antes de abrir regs/cobro público | `LEGAL APPROVED FOR REGISTRATION` |
| Antes del único pago LIVE E2E | Preflight T-0 PASS + unblock LIVE código/runtime |
| Abort | Cualquier stop condition → cerrar regs + documentar |
