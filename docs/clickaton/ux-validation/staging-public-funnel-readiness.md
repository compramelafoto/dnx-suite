# Readiness funnel público staging — Imp. 07

**Fixture:** `ar2026-commercial-ux-test`  
**Selfcheck:** `READY_FOR_PUBLIC_FUNNEL_SMOKE`  
**Host DB:** `ep-round-fog…`

## Checklist

| Requisito | Estado | Evidencia |
| --------- | ------ | --------- |
| Staging DB | PASS | assertStagingDatabaseUrl |
| Edición publicada | PASS | isPublished=true |
| registrationEnabled | PASS | true |
| status REGISTRATION_OPEN | PASS | |
| Fase vigente $25.000 | PASS | amount=2500000 |
| Referencia $35.000 | PASS | highest=3500000 |
| Remera + talles | PASS | REMERA-CLICKATON / 9 variants |
| FAQ 9 | PASS | código |
| Ventana open + ticket | PASS | getContext |
| Meta LIVE off | PASS | env false |
| Public URL no prod | PASS | clickaton-staging |
| Brick | BLOCKED | no ejercido |
| Correo / pago | NO | política |

## Imp. 08

Smoke HTTP + Playwright tras deploy `dpl_3mvpY1bQ8jiq9dLqhDbaLbt659GR`: fixture inscripción 200 con precios/remera/FAQ; robots noindex; footer nuevo. Selfcheck CLI local no re-ejecutado (sin `DATABASE_URL` en shell); health DB staging PASS.

## Próxima acción

1. Commit/push patch limpio SEO/footer.  
2. Recorrer wizard hasta resumen sin Brick (opcional).  
3. Imp. MP TEST readiness (separada).
