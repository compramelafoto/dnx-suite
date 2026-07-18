# dani-conversation-v1 — motor conversacional natural

El Estilo Dani busca que el asistente converse como un colega fotógrafo, no que imite de manera literal o caricaturesca a una persona.

La revisión humana de Dani sigue siendo la referencia final para aprobar la comunicación.

## Qué es / qué no es

**Es:** un renderer determinista versionado (`dani-conversation-v1`) con catálogo de frases, estrategia de una pregunta por turno, confirmaciones sobrias y fallback seguro.

**No es:** un LLM, un clon de voz personal, ni un generador de presupuestos visibles.

## Principios

- Español rioplatense natural
- Una pregunta principal por turno
- No repreguntar datos conocidos
- Variar confirmaciones; no abrir todo con «Perfecto/Excelente»
- Sin lenguaje de formulario ni términos técnicos internos
- Pricing siempre oculto

## Arquitectura

```text
src/conversation/style/
  conversation-style-engine.ts     # default: dani-conversation-v1 | legacy
  compose-conversation-reply.ts    # selección + fallback
  legacy/legacy-style-renderer.ts
  dani-v1/
    dani-copy-catalog.ts
    dani-style-renderer.ts
    …
```

Integración gradual en `processMessage` vía `composeConversationReply`.

## Estrategia de preguntas

Orden estable del contrato real:

1. `SERVICE_TYPE`
2. `EVENT_DATE`
3. `CITY`
4. `DURATION_HOURS`

## Selección determinista

`stableHash(conversationId + field + turn)` sobre el catálogo; evita `Math.random()` y evita repetir el texto exacto reciente.

## Fallback

Si el renderer Dani lanza o viola protecciones críticas → respuesta legacy + log `Dani renderer fallback`.

## Evaluación

- Offline: `conversation:evaluate:all` + umbral 85 en escenarios críticos
- Comparación: `conversation:compare`
- Reglas de score: `dani-style-v1` (Etapa 14)

## Solicitudes visuales

Solo se reconocen; no se buscan ni muestran fotos.

## Privacidad

Sin precios, breakdown, perfil financiero ni secretos en logs/respuestas.

## Cómo agregar variantes

1. Sumar entrada tipada en `dani-copy-catalog.ts` con `id` estable
2. Cubrir con test de selección / escenario offline
3. Correr `conversation:compare` y revisar regresiones
