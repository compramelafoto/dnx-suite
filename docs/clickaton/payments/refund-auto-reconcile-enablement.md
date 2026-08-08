# Cron refund auto-reconcile — habilitación segura

Estado por defecto (producción):

- `DNX_CLICKATON_REFUND_AUTO_RECONCILE_ENABLED` ausente → **off**
- `DNX_CLICKATON_REFUND_AUTO_RECONCILE_WRITES_ENABLED` ausente → **off** (shadow/dry)

No activar writes sin el procedimiento siguiente.

## Procedimiento futuro

1. **Shadow**  
   Setear solo `DNX_CLICKATON_REFUND_AUTO_RECONCILE_ENABLED=true`.  
   Dejar `…_WRITES_ENABLED` ausente/false. El cron observa y registra planes sin mutar.

2. **Observar**  
   Revisar logs/métricas: candidatos, `already_in_sync`, errores S2S, rate limits.  
   Correr `pnpm clickaton:payments:audit` (local) y, con límite bajo, `--provider`.

3. **Alertas**  
   Confirmar alertas de fallos de peek MP, conflictos `MANUAL_REVIEW` y picos de candidatos.

4. **Writes**  
   Solo entonces `DNX_CLICKATON_REFUND_AUTO_RECONCILE_WRITES_ENABLED=true`.  
   Preferir ventana controlada y un solo payment/edición piloto.

5. **Rollback**  
   Quitar o poner en false `…_WRITES_ENABLED` (vuelve a shadow).  
   Si hace falta, desactivar también `…_ENABLED`.

## Guardas

- Nunca crear refunds en Mercado Pago desde este cron.
- No batch wildcard sin límite.
- Los cinco casos de Imp-05 no requieren re-apply salvo tests READ-ONLY/idempotencia.
