# Matriz de rutas protegidas — Imp. 05

| Ruta | Anon | Noperm | Admin | Nota |
|------|------|--------|-------|------|
| `/admin` | 307 → login | acceso denegado | 200 | |
| `/admin/inscripciones` | 307 → login | denegado | 200 | |
| `/admin/finanzas` | 307/404 | — | 404 índice | usar rutas hijas |
| `/admin/finanzas/mi-cuenta` | 307 → login | denegado | 200 | canónica partner |
| `/admin/finanzas/cuenta-owner` | 307 → login | denegado | 200 empty state | onboarding off |
| `/admin/integraciones` | 307 → login | denegado | 200 | |
| `/admin/integraciones/diagnostico` | 307 → login | denegado | 200 | canónica diagnóstico |
| `/mi-cuenta` | shell/login | — | N/A | participante |
| `/mi-cuenta/inscripciones/[id]` | login | — | N/A | H1 no vacío |

Soft-404 de cuenta-owner: **cerrado**.
