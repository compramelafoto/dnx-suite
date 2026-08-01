# Rutas canónicas — E2E / nav / probes (mínimo)

No inventariar las ~66 rutas globales. Solo las usadas por validación UX autenticada.

## Auth / cuenta

| Ruta | Uso |
|------|-----|
| `/login` | Login unificado |
| `/mi-cuenta` | Hub participante |
| `/mi-cuenta/inscripciones/[id]` | Detalle / QR |
| `/admin/acceso-denegado` | Forbidden |

## Admin (nav)

| Ruta | Uso |
|------|-----|
| `/admin` | Dashboard |
| `/admin/ediciones` | Listado |
| `/admin/ediciones/[editionId]` | Detalle edición |
| `/admin/ediciones/[editionId]/finanzas` | Finanzas edición |
| `/admin/ediciones/[editionId]/precios` | Precios |
| `/admin/ediciones/[editionId]/cronograma` | Cronograma |
| `/admin/ediciones/[editionId]/consignas` | Consignas |
| `/admin/ediciones/[editionId]/envios` | Entregas |
| `/admin/ediciones/[editionId]/admision` | Admisión |
| `/admin/ediciones/[editionId]/acreditacion` | Acreditación |
| `/admin/inscripciones` | Inscripciones |
| `/admin/promociones` | Promos |
| `/admin/catalogo` | Productos |
| `/admin/social` | Social |
| `/admin/integraciones` | Integraciones |
| `/admin/integraciones/diagnostico` | Diagnóstico |
| `/admin/finanzas/mi-cuenta` | Cobro partner |
| `/admin/finanzas/cuenta-owner` | Cuenta receptora (empty si flag off) |
| `/admin/banners-home` | Banners |
| `/admin/configuracion` | Config |

## Checkout público

| Ruta | Uso |
|------|-----|
| `/maratones/[slug]/inscripcion` | Funnel |
| `/maratones/[slug]/inscripcion/resumen/[registrationId]` | Resumen/pago |
| `/maratones/[slug]/inscripcion/pago/{exito,pendiente,error}` | Return |

## Código

`apps/clickaton/e2e/helpers/canonical-admin-routes.ts`
