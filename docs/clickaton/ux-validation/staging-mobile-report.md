# Mobile report — staging Etapa 03 Imp. 01

## Pantallas prioritarias probadas

Home, login, crear-cuenta, cómo funciona, comunidad, sobre, contacto, legales, error `/maratones`, 404, menú fullscreen.

**No probadas en mobile autenticado:** Mi cuenta detalle, checkout Brick, admin cards/filtros/scanner.

## Viewports

| Viewport | Resultado agregado |
|----------|-------------------|
| 320 × 568 | Sin overflow X en rutas abiertas; login usable |
| 360 × 800 | Sin overflow X |
| 375 × 667 | Cubierto por familia 360/390 (probe) |
| 390 × 844 | Referencia principal; menú OK; capturas |
| 414 × 896 | Cubierto por 390/430 |
| 430 × 932 | Sin overflow X |
| Tablet 768 × 1024 | Home/marketing OK |
| Desktop 1366 × 768 | OK |

## Overflow

**0** detecciones de scroll horizontal involuntario en probe automatizado (`browser-probe-raw.json`).

## Menús

- Botón «Abrir menú de navegación» visible en 390.
- Menú abre con enlaces ES (Maratones, Cómo funciona, Comunidad, etc.).
- Captura: `home-menu__390.jpeg`.

## Forms

- Login / crear-cuenta apilados en mobile; controles alcanzables.
- Contacto visible; **no** se envió mensaje real.
- Wizard inscripción: **no alcanzado**.

## Modales

- Menú fullscreen funciona.
- Modales admin/checkout: **BLOCKED**.

## Teclado móvil

- No se validó teclado nativo iOS/Android real (solo Chromium headless).
- Limitación documentada: inputs tapados por teclado = **no verificado en device lab**.

## Tablas

- Admin tablas→cards: no verificadas en browser (sesión).
- Contratos estructurales Imp. 02 siguen en verde.

## Imágenes

- Home hero/figuras cargan; alt presentes en snapshot.
- Placas/QR: no alcanzados.

## Acciones

- CTAs home/login alcanzables sin hover.
- CTA «Próximas maratones» lleva a ruta 500 (P1 funcional).

## Resultado mobile

**Usable para marketing + auth.**  
**No usable** para funnel de edición/inscripción/pago en staging actual.

## Imp. 03

Inscripciones admin 320–430 + tablet/desktop: sin overflow horizontal detectado. Mi cuenta 320/390/430: PASS.
