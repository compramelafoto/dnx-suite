# Etapa 02 — Experiencia pública y checkout comprensible

**Implementación:** 01  
**Fecha:** 2026-08-01  
**Estado:** DONE (con validación Brick en staging pendiente de claves MP reales)

---

## 1. Rutas intervenidas

| Ruta | Cambio |
|---|---|
| `/mi-cuenta` | Encabezado, estados traducidos, próximo paso, CTAs |
| `/mi-cuenta/inscripciones/[id]` | Jerarquía, estados, sin jerga/backend/FotoRank sync/IDs técnicos |
| `/maratones/[slug]/inscripcion` | Consentimientos legibles + botones contextuales (wizard) |
| `/maratones/[slug]/inscripcion/resumen/[registrationId]` | Resumen humano, descuento, checkout sin infraestructura |
| `/maratones/[slug]/inscripcion/pago/{exito\|pendiente\|error}` | Resultados diferenciados vía `PaymentReturnView` |

---

## 2. Componentes intervenidos

- `CheckoutPayButton.tsx`
- `CardPaymentBrickCheckout.tsx`
- `PublicRegistrationWizard.tsx`
- `PaymentReturnView.tsx`
- `PaymentReturnPoller.tsx`
- `WelcomeCardShareCard.tsx` / `WelcomeCardShareActions.tsx`
- `CredentialPrintActions.tsx`
- `PromptPhotoUpload.tsx`
- `ResendConfirmationButton.tsx`
- `participant-email.ts` (copy email alineado)
- `post-payment-public-copy.ts`
- Repos summary DTO (`subtotalAmount` / `discountAmount`; SKU oculto al público)

---

## 3. Componentes / módulos compartidos creados

| Pieza | Path |
|---|---|
| Presentación de estados públicos | `lib/public-ux/status-presentation.ts` |
| Errores públicos seguros | `lib/public-ux/public-errors.ts` |
| Copy checkout | `lib/public-ux/checkout-public-copy.ts` |
| Tarjeta de estado | `components/account/PublicStatusCard.tsx` |
| Tests | `lib/public-ux/*.test.ts` |

---

## 4. Estados traducidos

Inscripción, pago, retorno de pago, placa de bienvenida, consignas, envío de foto, fulfillment (si visible), credencial, foto de perfil, identidad/check-in source.

Reutiliza labels admin (`status-labels.ts`) y añade descripción + próximo paso + tono.

---

## 5. Textos técnicos eliminados (superficie pública)

- Enums crudos (`CONFIRMED`, `PENDING_PAYMENT`, `APPROVED`, `LOCKED`, `GENERATED`…)
- webhook / reconciliación / Split 1:N / DNX Payments / Card Payment Brick (copy propio)
- «backend», «Dashboard del participante», «Cuenta DNX» en CTA primario
- Flag `VENUE ADDRESS HUMAN CONFIG REQUIRED` en UI/email
- SKU en resumen público
- Sync FotoRank / reloj servidor / IDs internos en mi inscripción

---

## 6. Mensajes de error modificados

- Retorno sin token → `publicCheckoutError` (sin incentivar doble pago)
- Upload foto → `publicUploadError`
- Poller postpago → mensaje sin «proveedor»

---

## 7. Cambios responsive

- Contenedores `min-w-0` + `overflow-x-auto` controlado en Brick (`data-testid="card-brick-viewport"`)
- Resumen/checkout en una columna en mobile (grid `lg:grid-cols-2`)
- CTAs `min-h-11` + `w-full` en mobile (cuenta, postpago, placa, QR, reenviar)
- Padding compacto en resumen

---

## 8. Resultado Brick por resolución

| Ancho | Resultado wrappers propios | Resultado SDK MP |
|---|---|---|
| 320 | `min-w-0` + overflow controlado; sin `min-w` forzado propio | Requiere claves MP / smoke staging |
| 360 | Idem | Idem |
| 375 | Idem | Idem |
| 390 | Idem | Idem |
| 414 | Idem | Idem |
| 430 | Idem | Idem |
| Desktop | OK estructural | Idem |

**Nota:** No se declara “Brick usable al 100%” solo porque compila. La usabilidad del iframe/SDK debe validarse en staging con `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` y flag Brick activo. Tests unitarios cubren wrappers y ausencia de jerga.

---

## 9. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| `npm run test:public-ux` | PASS (15) |
| `npm run test:card-brick` | PASS (7) |
| `post-payment-ux.selfcheck` | PASS |
| `email-idempotency.selfcheck` | PASS |
| `npm run check-types` | PASS |
| ESLint archivos tocados | PASS (tras fix hooks) |
| `npm run build` | PASS |
| E2E inscripción/checkout | No ejecutados (requieren entorno + datos) |

### Fallas previas ajenas (build)

Durante `next build`, Prisma reportó en generación estática:

`ClickatonEdition.coverImageVerticalUrl` no existe en la DB local actual.

No bloqueó el build (exit 0). Ajeno a Etapa 02 (schema/migración local).

---

## 10. Riesgos pendientes

1. Validación visual real del Brick con SDK en 320–430 px (staging).  
2. LEGAL_REVIEW del checkbox único (ver `legal-review-consents.md`).  
3. Selfchecks/emails que asumían mayúsculas antiguas ya actualizados; vigilar otros asserts externos.  
4. Promocode humano en resumen: se muestra descuento monetario; el código de promo no viaja aún en el DTO público (oportunidad futura sin cambiar API HTTP).  
5. Admin / finanzas / cronograma quedan para etapas posteriores.

---

## 11. Confirmación de alcance

- No se modificaron modelos Prisma, migraciones, APIs HTTP, permisos, rutas ni lógica de cobro/split/webhooks.  
- No se cambió el significado ni la persistencia de consentimientos.  
- No commit / push / deploy.
