# Calibración humana, casos dorados y regresiones

Las revisiones humanas no modifican automáticamente el comportamiento del asistente.

Una respuesta aprobada por Dani puede transformarse en caso dorado únicamente mediante una promoción explícita y auditable.

Los casos dorados deben proteger el comportamiento y la intención, no congelar innecesariamente cada palabra de la conversación.

## Flujo

1. Revisar turnos en el laboratorio (`APROBADA` / `NECESITA AJUSTE` / `INCORRECTA` + nota).
2. **Enviar sesión a calibración** (opcionalmente con redacción de datos personales).
3. Categorizar observaciones (auto + manual).
4. Agrupar por copy ID / campo / intención.
5. Proponer cambio de copy → **Probar propuesta** (simulación in-memory).
6. Proponer / confirmar caso dorado (doble confirmación).
7. Generar candidatos locales.
8. Promover / aplicar solo con `--confirm` (dry-run por defecto).

## Comandos

```bash
pnpm --filter dnx-sales-assistant calibration:import <file> [--redact]
pnpm --filter dnx-sales-assistant calibration:list
pnpm --filter dnx-sales-assistant calibration:report
pnpm --filter dnx-sales-assistant calibration:validate
pnpm --filter dnx-sales-assistant calibration:generate-candidates
pnpm --filter dnx-sales-assistant calibration:simulate <proposal-id>
pnpm --filter dnx-sales-assistant calibration:apply <proposal-id>           # dry-run
pnpm --filter dnx-sales-assistant calibration:apply <proposal-id> --confirm
pnpm --filter dnx-sales-assistant calibration:promote-golden <candidate-id> # dry-run
pnpm --filter dnx-sales-assistant calibration:promote-golden <candidate-id> --confirm
```

## Almacenamiento local (gitignored)

```text
apps/dnx-sales-assistant/.local/calibration/
  store.json
  candidates/
  golden/
  history/
  exports/
```

## Política de tests no frágiles

Validar intención, campos, preguntas, continuidad, score mínimo y conceptos.
Fijar respuesta exacta solo para copy crítico / legal / seguridad aprobado explícitamente.

## Privacidad

Usá conversaciones ficticias o anonimizadas siempre que sea posible.
Flag `--redact` / checkbox del lab.
