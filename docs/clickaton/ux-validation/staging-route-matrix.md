# Matriz de rutas — staging Etapa 03 Imp. 01

Leyenda resultados: `PASS` · `PASS_WITH_OBSERVATIONS` · `FAIL` · `BLOCKED` · `OUT_OF_SCOPE`  
Viewports: D=desktop 1366 · 320 · 360 · 390 · 430 (cuando “—” = no capturado; HTTP sí verificado)

Evidencia: `screenshots/*` + `browser-probe-raw.json` salvo notas.

| Ruta | Rol | Perfil | D | 320 | 360 | 390 | 430 | Funcional | Copy | Overflow | A11y | Resultado | Hallazgo | Corrección | Evidencia |
|------|-----|--------|---|-----|-----|-----|-----|-----------|------|----------|------|-----------|----------|------------|-----------|
| `/` | público | visitante | OK | OK | OK | OK | OK | Agenda vacía (error Prisma silencioso) | Prelaunch residual | No | Menú+foco OK | PASS_WITH_OBSERVATIONS | Oculta 11 ediciones | — | home__*.jpeg |
| `/login` | público | visitante | OK | OK | — | OK | — | Form ES + Google | Links legales 404 | No | Tab→foco outline | PASS_WITH_OBSERVATIONS | `/terminos` `/privacidad` | Brand `/legal/*` local | login__*.jpeg |
| `/crear-cuenta` | público | visitante | OK | — | — | OK | — | Form | Mismos links legales | No | — | PASS_WITH_OBSERVATIONS | Igual login | Brand fix | crear-cuenta__*.jpeg |
| `/recuperar` | público | visitante | HTTP200 | — | — | — | — | — | ES | — | — | PASS | — | — | HTTP |
| `/como-funciona` | público | visitante | OK | OK | OK | OK | OK | Links OK | ES | No | — | PASS | — | — | como-funciona__*.jpeg |
| `/comunidad` | público | visitante | OK | OK | OK | OK | OK | OK | ES | No | — | PASS | — | — | comunidad__*.jpeg |
| `/sobre` | público | visitante | OK | OK | OK | OK | OK | OK | ES | No | — | PASS | — | — | sobre__*.jpeg |
| `/contacto` | público | visitante | OK | OK | OK | OK | OK | Form visible | ES | No | — | PASS | No envío real | — | contacto__*.jpeg |
| `/organizar` | público | visitante | HTTP200 | — | — | — | — | — | ES | — | — | PASS | — | — | HTTP |
| `/formar-parte` | público | visitante | HTTP200 | — | — | — | — | — | ES | — | — | PASS | — | — | HTTP |
| `/manualdemarca` | público | visitante | HTTP200 | — | — | — | — | — | — | — | — | PASS | — | — | HTTP |
| `/legal/terminos` | público | visitante | OK | OK | OK | OK | OK | 200 | LEGAL_REVIEW | No | — | PASS | No reescrito | — | legal-terminos__*.jpeg |
| `/legal/privacidad` | público | visitante | HTTP200 | — | — | — | — | 200 | LEGAL_REVIEW | — | — | PASS | — | — | HTTP |
| `/terminos` | público | visitante | 404 | — | — | — | — | Roto desde login | — | — | — | FAIL | Link legacy | Fix brand local | HTTP |
| `/privacidad` | público | visitante | 404 | — | — | — | — | Roto desde login | — | — | — | FAIL | Link legacy | Fix brand local | HTTP |
| `/maratones` | público | visitante | 200 | — | — | 200 | — | Listado con ediciones | ES | No | — | PASS (post Imp.02) | P2022 RESOLVED | migrate deploy | smoke Imp.02 |
| `/maratones/clickaton-argentina-2026` | público | visitante | 200 | — | — | 200 | — | Detalle OK | ES | No | — | PASS (post Imp.02) | slug real ≠ argentina-2026 | — | smoke Imp.02 |
| `/maratones/*/inscripcion*` | participante | — | 200 | — | — | — | — | “Inscripción no disponible” | ES | — | — | PASS_WITH_OBSERVATIONS | Oferta cerrada | — | smoke Imp.02 |
| `/maratones/*/inscripcion/pago*` | participante | — | — | — | — | — | — | Brick | — | — | — | BLOCKED | BRICK_STAGING_BLOCKED (creds) | — | — |
| `/mi-cuenta` | participante | sin sesión | 307→login | — | — | — | — | Gate OK | ES login | — | — | PASS_WITH_OBSERVATIONS | Contenido no visto | — | E2E |
| `/mi-cuenta/inscripciones/[id]` | participante | — | — | — | — | — | — | — | — | — | — | BLOCKED | Sin sesión prueba | — | — |
| `/admin` | admin | sin sesión | 307→login | — | — | — | — | Gate OK | — | — | — | BLOCKED | Sin creds admin | — | HTTP |
| `/admin/*` (ediciones, inscripciones, finanzas, cronograma, consignas, envíos, admisión, precios, promos, catálogo, social, integraciones, diagnóstico, scanner, sponsors, banners) | admin | — | — | — | — | — | — | — | — | — | — | BLOCKED | Sin sesión | — | — |
| `/admin/acceso-denegado` | admin | sin sesión | 307 login | — | — | — | — | No llega a forbidden | — | — | — | BLOCKED | Requiere sesión sin permiso | Copy local Imp.09 | HTTP |
| `/ruta-inexistente-ux-03` | público | visitante | 404 | — | — | 404 | — | OK | ES | No | — | PASS | — | — | 404__*.jpeg |
| `/tienda` | público | visitante | 404 | — | — | — | — | No operativa | — | — | — | OUT_OF_SCOPE | Tienda pública | COMMERCIAL_REVIEW | HTTP |
| Jurado / ranking FR | — | — | — | — | — | — | — | — | — | — | — | OUT_OF_SCOPE | Vive en FotoRank | Hand-off docs | — |
| Publicación Meta LIVE | admin | — | — | — | — | — | — | — | — | — | — | OUT_OF_SCOPE | No publicar | — | — |

### Tablet / zoom

| Check | Resultado |
|-------|-----------|
| Tablet 768×1024 home+marketing | Sin overflow |
| Zoom ~200% home 390 | Sin overflow X |

## Imp. 03

Rutas protegidas: ver `staging-protected-route-matrix.md`. Oferta piloto abierta; Brick no renderizado E2E.
