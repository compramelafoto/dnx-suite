# Cobertura global de rutas — Clickatón UX

Inventario base: `docs/clickaton/ux-audit/panel-inventory.md` (66 páginas).  
Estados: `PASS` · `PARTIAL` · `BLOCKED` · `OUT_OF_SCOPE`.

## Públicas

| Ruta | Rol | Etapa | Estado actual | Mobile | Idioma | Técnico | Riesgo | Resultado |
|---|---|---|---|---|---|---|---|---|
| `/` | Público | 01/09 | Home OK | OK | ES | — | — | PASS |
| `/maratones` | Público | 01 | Listado | OK | ES | — | — | PASS |
| `/maratones/[slug]` | Público | 01/07/09 | Ficha + sponsors label | OK | ES | — | — | PASS |
| `…/inscripcion` | Público | 01/02/07 | Wizard | OK | ES | — | LEGAL_REVIEW | PASS |
| `…/resumen/[id]` | Público | 01/02 | Checkout | OK | ES | IDs ocultos | — | PASS |
| `…/pago/*` | Público | 01/02 | Postpago | OK | ES | — | — | PASS |
| `…/activar/[id]` | Público | 01 | Activar cuenta | OK | ES | — | — | PASS |
| `/mi-cuenta` | Participante | 01/02/09 | Panel + loading | OK | ES | — | — | PASS |
| `/mi-cuenta/inscripciones/[id]` | Participante | 01/02/08 | Hub QR/placa | OK | ES | — | LEGAL_REVIEW | PASS |
| `/login` `/crear-cuenta` `/recuperar*` `/verificar-email` | Público | 01 | Auth | OK | ES | — | — | PASS |
| `/como-funciona` `/comunidad` `/organizar` `/formar-parte` `/sobre` `/contacto` `/manualdemarca` | Público | 01/09 | Marketing | OK | ES (residual “Sponsors locales” content) | — | copy residual | PARTIAL |
| `/legal/*` | Público | 01 | Legal | OK | ES | — | LEGAL_REVIEW body | OUT_OF_SCOPE |
| `/design-system` | Interno | — | Showcase | OK | mixto DS | — | interno | OUT_OF_SCOPE |
| `error` / `not-found` públicos | Público | 09 | Humanizados | OK | ES | digest solo log | — | PASS |

## Admin

| Ruta | Rol | Etapa | Estado actual | Mobile | Idioma | Técnico | Riesgo | Resultado |
|---|---|---|---|---|---|---|---|---|
| `/admin` | Admin | 09 | Inicio + acciones | OK | ES | — | — | PASS |
| `/admin/ediciones*` | Admin | 01/09 | Listado/form labels | OK | ES | IDs técnico | — | PASS |
| `…/precios` | Admin | 07 | Fases | OK | ES | colapsado | COMMERCIAL_REVIEW | PASS |
| `…/finanzas` | Admin | 03 | Distribución | OK | ES | colapsado | FINANCE_REVIEW | PASS |
| `…/cronograma` `…/consignas` | Admin | 04 | Timeline/prompts | OK | ES | colapsado | — | PASS |
| `…/envios` `…/admision` | Admin | 05 | Envíos/admisión | OK | ES | colapsado | — | PASS |
| `…/acreditacion*` | Admin | 05/08/09 | Sede + scanner | OK | ES | serverNow técnico | — | PASS |
| `/admin/sedes*` | Admin | 01/09 | Sedes | OK | ES | — | — | PASS |
| `/admin/catalogo**` | Admin | 07/09 | Productos/kits | OK cards | ES | SKU técnico | — | PASS |
| `/admin/inscripciones**` | Admin | 02/08 | Listado/detalle | OK cards | ES | colapsado | — | PASS |
| `/admin/promociones` | Admin | 07 | Códigos | OK | ES | colapsado | COMMERCIAL_REVIEW | PASS |
| `/admin/social` | Admin | 08/09 | Publicaciones | OK cards | ES | colapsado | LEGAL_REVIEW | PASS |
| `/admin/sponsors` | Admin | 09 | Vacío humanizado | OK | ES | — | — | PASS |
| `/admin/banners-home*` | Admin | 09 | Banners inicio | OK | ES | — | — | PASS |
| `/admin/mensajes*` | Admin | 01 | Inbox | OK | ES | — | — | PARTIAL |
| `/admin/configuracion` | Admin | 09 | Config | OK | ES | — | — | PASS |
| `/admin/finanzas/mi-cuenta` | Admin | 03 | Partner MP | OK | ES | colapsado | FINANCE_REVIEW | PASS |
| `/admin/finanzas/cuenta-owner` | Admin | 03 | Owner MP | OK | ES | colapsado | FINANCE_REVIEW | PASS |
| `/admin/integraciones` | Admin | 03/09 | Hub | OK | ES | env names técnico | FotoRank | PASS |
| `/admin/integraciones/diagnostico` | Admin | 03/08 | Operativo+técnico | OK | ES | colapsado | — | PASS |
| `/admin/acceso-denegado` | Auth | 09 | Forbidden humanizado | OK | ES | — | — | PASS |
| Jurado / resultados Clickatón | — | 06 | Vive en FotoRank | — | — | — | FotoRank | BLOCKED / OUT_OF_SCOPE |

## Shells

| Superficie | Etapa | Resultado |
|---|---|---|
| Admin nav / sidebar / mobile | 09 | PASS |
| Admin breadcrumbs | 09 | PASS |
| SiteHeader / AccountMenu | 01/02 | PASS |
| Admin loading | 09 | PASS |
| Account loading | 09 | PASS |
