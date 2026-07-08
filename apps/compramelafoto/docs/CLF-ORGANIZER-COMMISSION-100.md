# CLF-ORGANIZER-COMMISSION-100

## Resumen

Se elevó el tope de comisión del organizador de evento de **90%** a **100%** sobre el precio base del fotógrafo.

## Constante centralizada

- `MAX_ORGANIZER_COMMISSION_PERCENT = 100`
- Alias: `MAX_EVENT_ORGANIZER_COMMISSION_PERCENT`

Archivo: `lib/event-organizer-commission.ts`

## Validaciones

| Capa | Archivo | Regla |
|------|---------|-------|
| Backend create | `lib/event-organizer-commission.ts` → `resolveEventOrganizerCommissionForCreate` | `0 < pct ≤ 100` |
| Backend patch | `lib/event-organizer-commission.ts` → `resolveEventOrganizerCommissionForPatch` | `0 < pct ≤ 100` |
| UI wizard | `components/organizer/OrganizerNewEventWizard.tsx` | importa constante |
| UI sección | `components/organizer/EventOrganizerCommissionSection.tsx` | `max` del input + texto |
| UI edición | `app/organizador/(panel)/events/[id]/page.tsx` | validación cliente |
| API | `app/api/organizer/events/route.ts`, `[id]/route.ts` | resolvers backend |

## Mercado Pago

- **Modelo actual:** split 2 vías (OAuth fotógrafo + `marketplace_fee`).
- La comisión del organizador **sí** entra al `marketplace_fee` (retención plataforma + comisión organizador).
- Al **100%**: el cobrador OAuth recibe **$0**; `marketplace_fee` = total cobrado. Matemáticamente cierra.
- Validación defensiva: `validateEventOrganizerCommissionMpSplit` en `lib/event-organizer-commission-mp-marketplace-fee.ts`, usada en checkout (`lib/event-organizer-commission-mp-checkout.ts`).

## Comisión escolar (álbum)

`AlbumSchoolCommissionSection` ya permitía 0–100%; no forma parte de este cambio.

## Tests

```bash
node --import tsx --test lib/event-organizer-commission.test.ts lib/pricing/checkout-fee-financial-close.test.ts
```

## Checklist manual

- [ ] Crear evento con comisión 90%
- [ ] Crear evento con comisión 100%
- [ ] Rechazar 101% en UI y API
- [ ] Venta simulada con 100% (qa-financial-regression o checkout de prueba)
- [ ] Checkout MP no rompe con 100%
- [ ] UI muestra «máx. 100%»
