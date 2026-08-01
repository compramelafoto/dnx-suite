# Accesibilidad básica — staging Etapa 03 Imp. 01

**Alcance:** checks manuales/automatizados ligeros en browser. **No** es conformidad WCAG completa.

## Teclado

- En `/login` (desktop), Tab llega a controles; tercer Tab enfocó «Abrir menú de navegación».
- Outline visible: `solid 2px`.

## Foco

- Controles de header/menú muestran foco aparente.
- No se auditó anillo en todos los inputs del wizard (no alcanzado).

## Labels

- Login vía `@repo/auth-ui`: labels ES.
- Links legales visibles «Términos» / «Privacidad» (href incorrectos en deploy).

## Encabezados

- Home: H1 «Salí a buscar el instante.»; secciones con H2.
- Error `/maratones`: H1 «No pudimos cargar esta página».
- 404: copy ES de página no encontrada.
- Orden completo por página admin: no verificado.

## Modales / menús

- Menú mobile: botón con nombre accesible; cierre no re-validado exhaustivamente en esta sesión (contrato Imp. 09 en código).

## Tabs

- Carrusel banners home: `tablist` «Banners» presente en snapshot.

## Errores

- Error boundary público explica que no se modifican datos y ofrece reintentar / volver al inicio.
- Errores de formulario inscripción/checkout: no alcanzados.

## Contraste aparente

- Marca oscura + amarillo Clickatón; contraste aparente OK en hero/login.
- Sin medición instrumental (axe/Lighthouse formal no corrido).

## Zoom

- ~200% en home 390: sin overflow X detectado.

## Uso sin hover

- CTAs principales son links/botones; no dependen de hover para marketing.

## Lectura de estados por texto

- Badges/estados admin: no vistos en browser; capas de presentación cubiertas por suites UX.

## Límites

1. Sin VoiceOver/TalkBack.
2. Sin auditoría automatizada axe completa.
3. Sin wizard, Brick, scanner, admin autenticado.
4. Zoom solo spot-check.

## Recomendaciones

1. Redeploy legal links + degradación 500.
2. Migrar schema staging.
3. Pasar axe + teclado en inscripción/checkout/admin con cuentas de prueba.
4. Validar cámara/escáner en device físico.

## Imp. 03

Login labels email/password OK. Forbidden copy comprensible. Detalle inscripción: H1 vacío (P2).
