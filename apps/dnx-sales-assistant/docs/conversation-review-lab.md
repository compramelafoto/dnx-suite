# Laboratorio local de revisión conversacional

El laboratorio es una herramienta local de revisión humana. No debe desplegarse ni exponerse a usuarios finales.

Una respuesta con score 100 puede igualmente requerir ajustes. La decisión final siempre pertenece a Dani.

## Activación

```bash
pnpm --filter dnx-sales-assistant conversation:lab
```

Requisitos:

* `DNX_SALES_ASSISTANT_REVIEW_LAB=true` (el script lo setea)
* `NODE_ENV !== "production"`

URL:

```text
http://localhost:8799/review-lab
```

Detener: `Ctrl+C` (SIGINT/SIGTERM). El puerto se libera al cerrar.

## Capacidades

* Conversación libre con el pipeline real
* Selector de los 25 escenarios versionados
* Diagnóstico por turno (intent, campos, score, flags, pricing silencioso)
* Comparación legacy vs Dani sin mutar el estado principal
* Revisión humana: APROBADA / NECESITA AJUSTE / INCORRECTA + nota
* Exportación JSON sanitizada

## Guardado local

Al exportar / guardar revisión:

```text
apps/dnx-sales-assistant/.local/review-lab/review-session-<timestamp>.json
```

Directorio ignorado por Git (`.local/`).

## Privacidad

Sin precios, breakdown, secretos ni stack traces en UI/export.

## Referencias visuales

Catálogo local curado (Etapa 17). Si hay referencias `APPROVED` autorizadas, el panel muestra hasta 6 tarjetas con autoría y atribución. Sin búsqueda web. Ver [`visual-references.md`](visual-references.md).

## Protección de producción

Si `NODE_ENV=production` o falta el flag, no se registran rutas ni se sirve la UI.
