# Flujos críticos — staging Etapa 03 Imp. 01

## Inscripción

| Campo | Valor |
|-------|-------|
| Precondición | Edición pública listable + CTA inscripción |
| Pasos | Home → Maratones → Detalle → Inscribirme |
| Esperado | Wizard usable, fases/precio/talle/promo |
| Observado (Imp.02) | `/maratones` **200**, detalle AR2026 **200**; inscripción **200** con “Inscripción no disponible” |
| Estado | Schema **RESOLVED**; inscripción abierta **BLOCKED** (config/creds) |
| Evidencia | `staging-post-recovery-smoke.md` |
| Riesgo | Brick sigue pendiente de oferta TEST + claves |

## Checkout

| Campo | Valor |
|-------|-------|
| Precondición | Resumen con hold + MP TEST |
| Pasos | Resumen → pagar → Brick / Pro |
| Esperado | Contenedor responsive, estados, anti doble pago |
| Observado (Imp.02) | Funnel ya no cae por P2022; paso pago no alcanzado (oferta cerrada) |
| Estado | **BLOCKED** (creds/oferta; no schema) |
| Evidencia | Inscripción 200 “no disponible” |
| Riesgo | Declarar usabilidad checkout sería falso |

## Mercado Pago Brick

| Campo | Valor |
|-------|-------|
| Precondición | Claves TEST + ruta pago |
| Pasos | Init Brick en 320–430 + desktop |
| Esperado | Campos/botones usables, sin overflow |
| Observado | No inicializado |
| Estado | **`BRICK_STAGING_BLOCKED`** (credenciales/oferta; schema OK) |
| Evidencia | — |
| Riesgo | Solo wrappers estructurales (suites UX) validados en código |

## Mi cuenta

| Campo | Valor |
|-------|-------|
| Precondición | Sesión participante de prueba |
| Pasos | Login → Mi cuenta → detalle inscripción |
| Esperado | Estado, próximo paso, QR/placa, pagos |
| Observado | Redirect a `/login?next=/mi-cuenta` |
| Estado | Gate **PASS**; contenido **BLOCKED** |
| Evidencia | E2E public-ux-smoke |
| Riesgo | Estados postpago no verificados en browser |

## Admin inscripciones

| Campo | Valor |
|-------|-------|
| Precondición | Admin de prueba |
| Pasos | Listado → filtros → detalle → acciones (sin mutar reales) |
| Esperado | Cards mobile, chips, confirms |
| Observado | `/admin` → login |
| Estado | **BLOCKED** |
| Evidencia | HTTP 307 |
| Riesgo | Solo contratos estructurales Imp. 02 |

## Acreditación

| Campo | Valor |
|-------|-------|
| Precondición | Scanner + QR de prueba |
| Pasos | Abrir acreditación / escáner |
| Esperado | Copy ES, permisos cámara, errores |
| Observado | No abierto |
| Estado | **BLOCKED** |
| Evidencia | — |
| Riesgo | Cámara puede no existir en CI; documentar alternativa |

## Finanzas

| Campo | Valor |
|-------|-------|
| Precondición | Admin + edición |
| Pasos | Ver estado, checklist, sin conectar/desconectar |
| Esperado | Copy humano, sin secretos |
| Observado | No abierto |
| Estado | **BLOCKED** · `FINANCE_REVIEW` intacto |
| Evidencia | Suites `test:finance-ux` verdes |

## Cronograma

| Campo | Valor |
|-------|-------|
| Precondición | Admin |
| Pasos | Ver próximas / estados sin publicar reales |
| Esperado | TZ visible, confirms |
| Observado | No abierto |
| Estado | **BLOCKED** |
| Evidencia | `test:timeline-ux` |

## Entregas

| Campo | Valor |
|-------|-------|
| Precondición | Admin |
| Pasos | Listado/filtros/preview sin admitir reales |
| Esperado | Checklist, metadatos humanos |
| Observado | No abierto |
| Estado | **BLOCKED** |
| Evidencia | `test:submissions-ux` |

## Admisión

| Campo | Valor |
|-------|-------|
| Precondición | Admin |
| Pasos | Revisar sin mutar fotos reales |
| Esperado | Separación técnica vs jurado |
| Observado | No abierto |
| Estado | **BLOCKED** |
| Evidencia | `test:submissions-ux` / jury UX |

## Social

| Campo | Valor |
|-------|-------|
| Precondición | Admin; LIVE off |
| Pasos | Ver cola/placas sin publicar |
| Esperado | Banner LIVE, estados ES |
| Observado | No abierto |
| Estado | **BLOCKED** |
| Evidencia | `test:social-communications-ux` |

## Integraciones / diagnóstico

| Campo | Valor |
|-------|-------|
| Precondición | Admin |
| Pasos | Leer propósito/estado/próximo paso; sin secretos |
| Esperado | Copy humano |
| Observado | No abierto |
| Estado | **BLOCKED** |
| Evidencia | `test:global-ux` contratos fuente |

## Imp. 03

Flujos auth admin/participante/forbidden validados en browser. Checkout profundo / Brick pendiente.
