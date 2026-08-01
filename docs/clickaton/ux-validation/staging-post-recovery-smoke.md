# Smoke post-recuperación — staging Etapa 03 Imp. 02

Fecha: 2026-08-01  
Base: `https://clickaton-staging.vercel.app`  
Deploy: `dpl_6Q942pMuz31pwcAtNv8xCikrJvxM`

| Ruta | Esperado | Observado | Contenido clave | Error visible | Log | Resultado |
|------|----------|-----------|-----------------|---------------|-----|-----------|
| `/api/public/health/db` | 200 ok staging | 200 `ok:true`, `ep-round-fog…`, `publishedEditions:11` | source prisma | No | — | PASS |
| `/` | 200 | 200 | H1 marca | No Prisma | — | PASS |
| `/maratones` | 200 + listado | 200 | Cards con slugs reales | No | P2022 ausente en sample nuevo | PASS |
| `/maratones/clickaton-argentina-2026` | 200 | 200 | H1 Clickatón Argentina 2026 | No | — | PASS |
| `/maratones/clickaton-argentina-2026/inscripcion` | abre (puede cerrada) | 200 “Inscripción no disponible” | Copy ES; no 500 | Comercial comercial | — | PASS (schema) / BLOCKED (inscripción abierta) |
| `/maratones/slug-inexistente-ux03` | 404 | 404 | not-found | No | — | PASS |
| `/login` | 200 | 200 | Form ES | No | — | PASS |
| Links legales login | `/legal/*` | `/legal/terminos`, `/legal/privacidad` | Corregidos en deploy | No | — | PASS |
| `/mi-cuenta` | redirect login o 200 gate | 200 observado post-deploy | Gate cuenta | No | Validar sesión en Imp. siguiente | PASS_WITH_OBSERVATIONS |
| `/admin` | 307 login | 307 | Gate admin | No | — | PASS |
| `/legal/terminos` | 200 | 200 | Bases | No | LEGAL_REVIEW | PASS |
| `/legal/privacidad` | 200 | 200 | Privacidad | No | LEGAL_REVIEW | PASS |

## Checkout / Brick

| Check | Resultado |
|-------|-----------|
| Bloqueo por P2022 | **Resuelto** |
| Ruta inscripción alcanzable | Sí (200) |
| Wizard/pago usable | No — inscripción no disponible + sin credenciales TEST |
| Brick | `BRICK_STAGING_BLOCKED` (credenciales / oferta), **no** schema |
