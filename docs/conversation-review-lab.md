# Laboratorio local de revisión conversacional (DNX Sales Assistant)

El laboratorio es una herramienta local de revisión humana. No debe desplegarse ni exponerse a usuarios finales.

Una respuesta con score 100 puede igualmente requerir ajustes. La decisión final siempre pertenece a Dani.

Documentación completa del asistente:

[`apps/dnx-sales-assistant/docs/conversation-review-lab.md`](../apps/dnx-sales-assistant/docs/conversation-review-lab.md)

## Uso mínimo

```bash
pnpm --filter dnx-sales-assistant conversation:lab
```

URL: `http://localhost:8799/review-lab`

Detener: `Ctrl+C`.

Revisiones / exportaciones: `apps/dnx-sales-assistant/.local/review-lab/` (ignorado por Git).
