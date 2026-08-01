# Matriz mobile global — Imp. 09

Validación **estructural** (markup + patrones). No se ejecutó laboratorio visual automatizado por viewport en CI.

Leyenda: OK · PARTIAL · N/A · RISK

| Ruta / superficie | 320 | 360 | 390 | 430 | Escritorio | Overflow | Navegación | Acciones | Resultado |
|---|---|---|---|---|---|---|---|---|---|
| Admin shell + menú móvil | OK | OK | OK | OK | OK | No obligatorio | Drawer ESC/focus | Cerrar 44px | PASS |
| `/admin` inicio | OK | OK | OK | OK | OK | No | — | Links min-h-11 | PASS |
| Inscripciones list/detalle | OK | OK | OK | OK | OK | Cards | — | Abrir | PASS (Imp.02) |
| Precios / promos / catálogo | OK | OK | OK | OK | Tabla md+ | Cards | — | Confirms | PASS (Imp.07) |
| Social / comunicaciones | OK | OK | OK | OK | OK | Cards | — | Confirms | PASS (Imp.08) |
| Finanzas MP | OK | OK | OK | OK | OK | — | — | Confirms | PASS (Imp.03) |
| Cronograma / consignas / envíos / admisión | OK | OK | OK | OK | OK | — | — | — | PASS (Imp.04/05) |
| Acreditación / escanear | OK | OK | OK | OK | OK | Una columna | — | Scan | PASS |
| Integraciones / diagnóstico | OK | OK | OK | OK | OK | Técnico colapsado | — | Links | PASS |
| Mi cuenta / inscripción | OK | OK | OK | OK | OK | Story 9:16 | — | CTAs full | PASS |
| Checkout / postpago | OK | OK | OK | OK | OK | Brick wrap | — | Pagar | PASS (Imp.01) |
| 404 / forbidden / error | OK | OK | OK | OK | OK | No | Salidas claras | min-h-11 | PASS |
| Mensajes admin | PARTIAL | PARTIAL | OK | OK | OK | Posible densidad | — | — | PARTIAL |
| Design-system | N/A | N/A | N/A | N/A | OK | Interno | — | — | OUT_OF_SCOPE |

## Hallazgos residuales mobile

- Algunas tablas especializadas (composición de tickets en desktop) siguen con scroll horizontal controlado en md+; listados principales tienen cards.
- Tabs densos: no hay sistema nuevo; se documenta riesgo si crecen.
- Tooltips hover: no hay sistema de tooltips admin; sin dependencia nueva.
