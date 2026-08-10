# Meta App Review Checklist — FotoRank Instagram (17B)

**Estado:** preparación técnica — **no enviado** en 17B  
**Fecha:** 2026-08-10

## Permisos que requieren App Review (Live)

| Permission | Reason | Screen recording | Test instructions |
|------------|--------|------------------|-------------------|
| `instagram_basic` | Leer perfil IG conectado y media IDs para mapping votación | Sí — flujo conectar cuenta | Login org → Redes sociales → Conectar → ver cuenta |
| `instagram_content_publish` | Publicar finalistas (imagen) tras aprobación organizador | Sí — preview + aprobar (staging) | Crear publicación PREPARED → Aprobar → Publicar en cuenta test |
| `instagram_manage_insights` | Leer `like_count` durante votación | Sí — monitor ronda abierta | Abrir ronda test → ver sync métricas |
| `pages_show_list` | Seleccionar Page vinculada | Sí — OAuth | Flujo OAuth completo |
| `pages_read_engagement` | Validar engagement Page | Sí — diagnostics | Panel conexión → permisos |

## Documentación requerida

- [ ] Privacy Policy URL pública
- [ ] Data deletion instructions URL
- [ ] Business Verification (si Meta lo exige para permisos)
- [ ] App icon + categoría
- [ ] Descripción uso de datos Meta (account id, media id, like_count)

## Development Mode (17B)

- Test users / roles en app Meta
- **Cero** publicaciones comerciales Clickatón reales
- Probe manual: `FOTORANK_ALLOW_INSTAGRAM_PROBE=1` only

## Webhook (futuro)

Si se implementan webhooks no-like: verify token + signature HMAC + idempotency.

## Compliance

- Data deletion callback según Meta Platform Terms (documentar proceso; no inventar endpoint sin revisión legal)
