# Etapa 02 Imp. 03 — Finanzas y Mercado Pago comprensibles

**Estado:** DONE (con limitaciones y `FINANCE_REVIEW`)  
**Fecha:** 2026-08-01  
**Alcance:** presentación UX admin de finanzas / MP.  
**No modificado:** OAuth, PKCE, tokens, webhooks, split, ledger, reconciliación, cuentas, porcentajes, APIs, permisos, Prisma, DNX Payments, Mercado Pago.

---

## Rutas intervenidas

| Ruta | Cambio |
|---|---|
| `/admin/ediciones/[editionId]/finanzas` | Estado general, checklist, distribución humana, cards mobile, técnico colapsable |
| `/admin/finanzas/cuenta-owner` | Cuenta receptora, CTA humanos, técnico colapsable |
| `/admin/finanzas/mi-cuenta` | Copy humano + técnico colapsable |
| `/admin/integraciones` | Copy + env vars en técnico |
| `/admin/integraciones/diagnostico` | Verificación de pagos + capas |

---

## Componentes modificados

- `EditionDistributionEditor.tsx`
- `OwnerMpConnectActions.tsx`
- `PartnerMpConnectActions.tsx`
- `config/admin/integrations.ts`
- Páginas listadas arriba
- `package.json` (`test:finance-ux`)

## Componentes / capas creadas

- `lib/admin/edition-finance/ui/finance-status-presentation.ts`
- `lib/admin/edition-finance/ui/finance-status-presentation.test.ts`
- Reutiliza `AdminTechnicalInfo.tsx`

---

## Estados traducidos

Ver `finance-status-map.md`.

Síntesis: Listo para recibir pagos / Falta conectar Mercado Pago / Configuración incompleta / Requiere atención / Solo para pruebas.

---

## Términos técnicos reemplazados o reubicados

| Antes (operativo) | Después |
|---|---|
| Collector / collector account | Cuenta que recibirá los pagos |
| OAuth / Estado OAuth | Estado de la conexión |
| PKCE | Información técnica |
| Webhook | Actualizaciones automáticas de pagos |
| Split 1:N / allocations | Distribución de los pagos |
| Ledger | Registro contable interno (técnico) |
| Reconciliación | Verificación de pagos |
| Activar (distribución) | Publicar distribución |
| DRAFT / ACTIVE (UI) | Borrador / publicada |
| Recipient | Cuenta receptora |

---

## Estrategia simple / técnica

- **Operativo:** estado, cuenta receptora, distribución, checklist, bloqueos humanizados, CTAs.
- **Técnico:** `AdminTechnicalInfo` cerrado por defecto (IDs, provider, flags, URLs, PKCE, cron).

---

## Responsive

- Finanzas: tabla distribución `hidden md:block`; cards `md:hidden`.
- Botones `min-h-11` / stack en mobile.
- Sin `min-w-[640+]`.
- Diagnóstico y cuentas: una columna, IDs en técnico con `break-all`.

---

## Acciones sensibles

Ver `finance-sensitive-actions.md`. Desconectar exige confirmación explícita. No se ejecutaron acciones reales.

---

## Pruebas

- `npm run test:finance-ux`
- Typecheck / lint archivos tocados / build Clickatón

---

## Limitaciones

1. No hay resumen de totales cobrados/pendientes/rechazados en la página de finanzas de edición (no existía UI de movimientos); no se inventó.
2. Código promocional / comisiones netas confirmadas: fuera de datos disponibles en esta pantalla.
3. Gate sigue generando blockers técnicos internamente; la UI los traduce.
4. `FINANCE_REVIEW` en textos de titularidad / 100 % / obligaciones fiscales.

---

## Fallas previas ajenas

- Posible error Prisma `coverImageVerticalUrl` en build estático (ajeno).
- Reembolsos y ledger completo siguen pendientes en readiness interno (preexistente).
