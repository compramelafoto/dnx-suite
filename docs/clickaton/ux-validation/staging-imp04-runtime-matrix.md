# Matriz runtime Imp. 04 en staging — Imp. 05

**Alias:** `https://clickaton-staging.vercel.app`  
**Deployment:** `dpl_B5EDq4UE5FJ5R2yKS7NSj45zNLKr`  
**Evidencia cruda:** `imp05-runtime-raw.json` · capturas `screenshots/imp05/`

| Ruta | Status | Rol | Desktop | 320 | 390 | Copy | H1 | URL | Resultado | Evidencia |
|------|--------|-----|---------|-----|-----|------|----|-----|-----------|-----------|
| `/api/public/health/db` | 200 | público | — | — | — | ok JSON | — | staging DB | PASS | health `ep-round-fog…`, 12 ediciones |
| `/` | 200 | público | OK | — | OK | marketing | marca | canonical staging | PASS | meta + hosts 0 prod |
| `/maratones` | 200 | público | OK | — | — | listado | — | staging | PASS | smoke |
| `/maratones/clickaton-argentina-2026` | 200 | público | OK | — | — | detalle | — | og/canonical staging | PASS | meta |
| `/login` | 200 | público | OK | OK | OK | login | Iniciar sesión | staging | PASS | `login-390.png` |
| `/mi-cuenta` | 200 | participante | OK | — | — | saludo | Hola, TEST UX… | staging | PASS | `mi-cuenta-participant.png` |
| `/mi-cuenta/inscripciones/[id]` | 200 | participante | OK | OK sin overflow | OK | estado | Inscripción de TEST UX Confirmado | staging | PASS | `detalle-confirmed-h1.png` |
| `/admin` | 200 auth / 307 anon | admin | OK | — | — | panel | Inicio del panel | staging | PASS | `admin-dashboard.png` |
| `/admin/inscripciones` | 200 | admin | OK | — | — | listado | Inscripciones | staging | PASS | probe routes |
| `/admin/finanzas` | 404 | admin | — | — | — | not found | No encontramos… | — | residual P3 | no índice; usar rutas hijas |
| `/admin/finanzas/cuenta-owner` | 200 | admin | OK | OK | OK | empty state | Cuenta que recibirá los pagos | staging | PASS | `cuenta-owner-*.png` |
| `/admin/finanzas/mi-cuenta` | 200 | admin | OK | — | — | partner | (canónica) | staging | PASS | E2E finance routes |
| `/admin/integraciones` | 200 | admin | OK | — | — | integraciones | Integraciones | staging | PASS | `admin-integraciones.png` |
| `/admin/integraciones/diagnostico` | 200 | admin | OK | — | — | diagnóstico | Diagnóstico de integraciones | staging | PASS | `admin-diagnostico.png` |
| `/admin/finanzas/cuenta-owner` | denegado | noperm | OK | — | — | acceso denegado | No tenés permiso… | staging | PASS | `noperm-cuenta-owner.png` |
| `/admin/finanzas/cuenta-owner` | 307→login | anon | OK | — | — | login | Iniciar sesión | staging | PASS | auth probe |
| `/ruta-inexistente-xyz` | 404 | público | — | — | — | 404 real | — | — | PASS | smoke |
| `/admin/ruta-inexistente-xyz` | 404 | admin/anon | — | — | — | 404 real | — | — | PASS | smoke |

## Mobile overflow

| Viewport | Detalle inscripción | cuenta-owner |
|----------|---------------------|--------------|
| 320×568 | overflowX false | overflowX false |
| 360×800 | — | overflowX false |
| 390×844 | overflowX false | overflowX false |
| 430×932 | — | overflowX false |
| tablet | — | overflowX false |
| desktop | OK | OK |

## Notas

* Participante empty: sin link a detalle en Mi cuenta (fixture sin inscripción visible).  
* H1 sin nombre / solo edición: cubiertos por unit tests (sin fixture runtime).  
* Logout admin: control presente; click → `/`.
