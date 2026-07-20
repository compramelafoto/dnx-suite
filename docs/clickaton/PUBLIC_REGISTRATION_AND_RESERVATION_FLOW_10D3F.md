# Clickatón — 10D3F — Flujo público de inscripción y reserva

**Estado:** flujo público productivo hasta reserva (`PENDING_PAYMENT` + holds).  
**Fuera de alcance:** Mercado Pago, DNX Payments, checkout, webhooks, confirmación de pago, email, QR, acreditación, entidad Order.

## Objetivo

Permitir a una persona:

1. Abrir una edición pública
2. Elegir sede y entrada
3. Ver precio/cupo/productos (servidor)
4. Completar datos y consentimientos
5. Crear inscripción con snapshot + holds temporales
6. Ver un resumen seguro
7. Quedar lista para checkout (10D3G)

## Modelo real

| Concepto | Realidad |
| -------- | -------- |
| Inscripción | `ClickatonRegistration` |
| Orden | **No existe** — soft refs diferidos |
| Items | `ClickatonRegistrationItem` (snapshot) |
| Cupo | `ClickatonCapacityHold` |
| Stock | `ClickatonStockHold` + `reservedStock` (no decremento definitivo) |
| Consent | `acceptedTermsAt`, `acceptedImageAt` (sin versionado de bases) |
| Idempotencia | `paymentIdempotencyKey` + audit `PUBLIC_IDEMPOTENCY` |
| Resumen seguro | HMAC access token (sin `publicToken` en schema) |

## Gaps

| Capacidad | Estado | Impacto | Resolución |
| --------- | ------ | ------- | ---------- |
| Listar edición/sedes/entradas públicas | OK vía Prisma repo | Ficha maratón sigue en fixtures/FotoRank | CTA nativo si Prisma tiene oferta |
| Crear inscripción + holds | OK | — | Servicio + Prisma `$transaction` |
| Expirar holds (job) | Gap | Cupo fantasma hasta cancel/expire | Documentado; sin cron improvisado |
| Anti-duplicado fuerte | Parcial (app) | Sin unique DB email+edición | Check en servicio |
| Resume sin token | Gap schema | Solo HMAC en query | Documentado |
| Versionado legal | Gap | Solo timestamps | Checkboxes + páginas `/legal/*` |
| Rate limiting | Gap | Abuso submit | Diferido |
| Pago | Diferido 10D3G | — | Copy “Próximamente: continuar al pago” |

## Arquitectura

```text
Server Component (maratón / inscripción / resumen)
  → server action
  → PublicRegistrationService
  → PublicRegistrationRepository (Prisma | in-memory)
  → createDraft/holds/transition (dominio 10D2) / Prisma transaction
```

Precio, cupo, composición y disponibilidad se recalculan en servidor. El cliente no es fuente de verdad.

## Rutas

| Ruta | Responsabilidad |
| ---- | --------------- |
| `/maratones/[slug]` | CTA nativo si hay oferta Prisma |
| `/maratones/[slug]/inscripcion` | Wizard sede → entrada → datos → revisión |
| `/maratones/[slug]/inscripcion/resumen/[registrationId]?t=` | Resumen con token HMAC |
| `/legal/terminos` | Términos mínimos |
| `/legal/privacidad` | Privacidad mínima |

## Pasos del wizard

1. **Sede** (si hay más de una activa)
2. **Entrada** (vendibles; variantes si `requiresVariantChoice`)
3. **Participante + consentimientos** (términos, privacidad, imagen opcional)
4. **Revisión** con advertencia de reserva temporal

## Estado inicial

Tras crear: **`PENDING_PAYMENT`**.

- Pago: `PENDING` si importe > 0; `NOT_REQUIRED` si gratis.
- Hold de cupo ACTIVE + stock holds ACTIVE.
- `holdExpiresAt` = ahora + `ticket.holdMinutes`.
- No confirma, no asigna `visibleCode`, no crea Order.

## Idempotencia y concurrencia

- Key generada en servidor al renderizar el wizard.
- Misma key + mismo fingerprint → misma inscripción.
- Misma key + fingerprint distinto → `IDEMPOTENCY_CONFLICT`.
- Lock por ticket (in-memory) / relectura de cupo en transacción Prisma.
- Email activo duplicado en la edición → `DUPLICATE_REGISTRATION`.

## Seguridad del resumen

- Query `t` = HMAC(`registrationId.exp`) con `AUTH_SECRET`.
- Sin token válido → `FORBIDDEN` (no IDOR trivial).
- No se listan audits/notas internas en DTO público.

## Server actions

| Action | Caso de uso |
| ------ | ----------- |
| `getPublicRegistrationOfferAction` | CTA |
| `getPublicRegistrationContextAction` | contexto wizard |
| `getPublicTicketAvailabilityAction` | disponibilidad puntual |
| `createPublicRegistrationAction` | crear reserva |
| `getPublicRegistrationSummaryAction` | resumen seguro |

## Selfcheck

```bash
pnpm --filter clickaton selfcheck:public-registration-reservation
```

In-memory: edición/sede/entrada inválidas, ventas, cupo, stock, variantes, consent, idempotencia, concurrencia, resumen, sin Prisma en client, sin Order, sin pago falso.

## Riesgos

1. Catálogo público de fichas (fixtures) ≠ Prisma hasta convergencia.
2. Sin job de expiración de holds.
3. HMAC en query no es sesión; filtrar logs de URL.
4. Upsert de `User` por email en creación pública.

## Decisiones diferidas

- 10D3G checkout DNX Payments
- `publicToken` persistido / resume email
- Unique parcial email+edición
- Cron expire holds
- Rate limiting
- Versionado de bases

## Veredicto esperado

`FLUJO PÚBLICO PARCIAL — GAP DE DOMINIO O SEGURIDAD` respecto a expiración automática y token persistido; flujo de reserva usable para avanzar a checkout.
