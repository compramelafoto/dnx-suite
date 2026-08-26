# Santa Fe en Foco — Matriz legal ↔ técnica

`BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR`

| Tema legal | Implementación técnica ETAPA 05 | Estado |
| ---------- | ------------------------------- | ------ |
| Participación abierta | `residencyRequired: false`; registro no bloquea por provincia | Implementado (producto) |
| Territorio obra | Declaración + localidad; GPS opcional; coords no públicas | Implementado v1 |
| Período captura | `DateTimeOriginal` + timezone AR; revisión si falta/fuera | Implementado v1 |
| Categorías ×4 | Preset + seed categories slugs | Implementado |
| Profesional / celular | `evaluateSantaFeCategoryDeviceEligibility` → revisión | Implementado |
| Amateur / celular+cámara | Misma política | Implementado |
| ARGRA | `answersJson.argraMembershipNumber`; privado; verificación manual | Implementado (+ migración `answersJson`) |
| Aérea / dron | Política DRONE | Implementado |
| 1 obra / 1 cat | `maxEntries` / `maxCategories` en rules | Implementado |
| Consentimientos | Flag / borrador | No APPROVED |
| Bases públicas | — | No publicar |
