# Banco de pruebas conversacionales (Etapa 14)

Herramienta **interna y offline** para observar cómo conversa el asistente antes de exponer precios.

El sistema de evaluación no reemplaza la revisión humana de Dani.

## Propósito

- Ejecutar conversaciones completas sin HTTP.
- Ver intent, draft, faltantes, estado y pricing silencioso.
- Medir métricas deterministas (preguntas repetidas, tono de formulario, etc.).
- Comparar respuestas contra `dani-style-v1` (score 0–100 de regresión).
- Detectar (solo diagnóstico) pedidos de referencias visuales / fotos.

## Cómo ejecutar

```bash
pnpm --filter dnx-sales-assistant conversation:evaluate:all
pnpm --filter dnx-sales-assistant conversation:evaluate:scenario wedding-complete-first-message
pnpm --filter dnx-sales-assistant conversation:report
pnpm --filter dnx-sales-assistant conversation:evaluate:all -- --json
```

- Exit code `0` si todas las expectativas críticas pasan; `1` si alguna falla.
- `--json` imprime JSON seguro en stdout (sin precios ni breakdown).
- Opcional: redirigir JSON a `apps/dnx-sales-assistant/.tmp-evaluation/` (gitignored).

No levanta servidor HTTP.

## Cómo agregar un escenario

1. Editar `src/evaluation/scenarios/catalog.ts`.
2. Definir `id`, `messages[]` y `expectations` estructurales (intent, campos, READY, pricing).
3. Preferir palabras que activen `QUOTE_REQUEST` (`presupuesto`, `cotizar`, `cuánto sale`) si el caso es de cotización.
4. Evitar asserts sobre la frase exacta completa del asistente.
5. Correr el escenario aislado y luego `:all`.

## Métricas

Calculadas en `computeConversationMetrics` de forma determinista (regex / conteos):

| Métrica | Significado |
|---------|------------|
| `assistantQuestions` | Turnos con al menos un `?` |
| `repeatedQuestions` | Misma pregunta normalizada repetida |
| `alreadyKnownFieldQuestions` | Pregunta por campo ya informado |
| `formLikeMessages` | Lenguaje de formulario |
| `technicalLanguageFlags` | Términos internos (draft, DTO, etc.) |
| `multiQuestionMessages` | Más de un `?` en el mismo turno |

## Score Estilo Dani (`dani-style-v1`)

Parte de 100 y descuenta según pesos en `dani-style-profile.ts`.

Es una herramienta de **regresión interna**, no una medida absoluta de calidad humana.

## Códigos de regla

- `DANI_STYLE_FORM_LANGUAGE`
- `DANI_STYLE_TOO_LONG`
- `DANI_STYLE_MULTIPLE_QUESTIONS`
- `DANI_STYLE_REPEATED_CONFIRMATION`
- `DANI_STYLE_REPEATED_QUESTION`
- `DANI_STYLE_ALREADY_KNOWN_FIELD`
- `DANI_STYLE_TECHNICAL_LANGUAGE`
- `DANI_STYLE_CHATBOT_PHRASE`
- `DANI_STYLE_EXCESSIVE_ENTHUSIASM`
- `DANI_STYLE_CONTEXT_LOSS`

## Privacidad y precios

- El transcript no guarda breakdown económico ni perfil financiero.
- Los reportes ocultan / fallan si detectan fugas de precios.
- El pricing runtime puede quedar `READY` en memoria de evaluación; **no se muestra al usuario**.

## Detección visual (diagnóstico)

`detectVisualReferenceIntent` solo marca si el usuario pide ejemplos/fotos. No busca ni muestra imágenes.

## Comparación legacy vs Dani (Etapa 15)

```bash
pnpm --filter dnx-sales-assistant conversation:compare
pnpm --filter dnx-sales-assistant conversation:compare -- --json
```

El renderer activo por defecto es `dani-conversation-v1`. Ver [`dani-conversation-v1.md`](dani-conversation-v1.md).

## Fuera de esta etapa

Precios visibles, PDF, WhatsApp, panel público, persistencia, generación de imágenes, propuestas comerciales finales.
