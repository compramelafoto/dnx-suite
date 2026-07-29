# @repo/editorial-intelligence

Motor de **sugerencias editoriales por reglas** (sin LLM). Pensado para InfoSpot y reutilizable por otras apps DNX.

## Uso

```ts
import {
  createEditorialAssistantEngine,
  RuleBasedSuggestionProvider,
} from "@repo/editorial-intelligence";

const engine = createEditorialAssistantEngine();
const result = engine.analyzeSync(draftSnapshot);
```

## Futuro LLM

```ts
engine.setProvider(new OpenAiSuggestionProvider(...)); // no implementado
```

Interfaz: `EditorialSuggestionProvider`.

## Reglas

Configurables en `src/config.ts` (`EDITORIAL_MESSAGES`, `EDITORIAL_THRESHOLDS`, `CATEGORY_KEYWORD_RULES`).

## Apps

| App | Estado |
|-----|--------|
| InfoSpot | Panel en `ArticleForm` |
| Clickatón / FotoRank / CLF | Preparado vía package; sin wiring UI |
