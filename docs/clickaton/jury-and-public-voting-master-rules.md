# Clickatón + FotoRank — Reglas maestras de jurado, elegibilidad, admisión y votación pública

**Etapa:** 15B  
**Estado:** CANÓNICO FUNCIONAL (documental)  
**Fecha:** 2026-08-10  
**Alcance:** especificación de producto. **No** activa jurado, resultados ni votación pública.  
**Frase conceptual:** *«EL JURADO SELECCIONA. EL PÚBLICO DECIDE.»*

> Este documento es la **fuente funcional canónica** para Clickatón respecto de elegibilidad competitiva, admisión previa, evaluación de jurado, finalistas y votación pública.  
> Specs técnicas previas (p. ej. `CLICKATON_JURY_SCORING.md` Etapa 14) describen implementación/auditoría existente; **las decisiones de producto de esta etapa prevalecen** cuando hay divergencia (p. ej. 3 criterios, default 24 h de voto público).

**LEGAL REVIEW REQUIRED** antes de publicar Bases v3, abrir jurado real, votación pública o integración con redes sociales.

---

## 1. Principio general

Clickatón tiene **dos etapas de decisión**:

| Etapa | Quién | Qué decide |
|-------|--------|------------|
| 1. Jurado profesional | Jurados | Selecciona **finalistas** |
| 2. Votación pública | Público | Determina **1.º, 2.º y 3.º definitivos** por consigna |

- **Finalista ≠ ganador definitivo.**
- En Clickatón: 10 consignas; mínimo competitivo 8; 3 finalistas por consigna; el público ordena esos 3.
- FotoRank debe soportar otros concursos con modos distintos (ver §15).

---

## 2. Términos obligatorios

| Término | Uso |
|---------|-----|
| **FINALISTA** | Obra seleccionada por jurado; aún no es ganadora definitiva |
| **EVALUACIÓN** | Puntuación del jurado (nunca «voto» del jurado) |
| **VOTACIÓN PÚBLICA** | Instancia social posterior al jurado |
| **ME GUSTA** | Métrica pública default en Clickatón |
| **ADMISIBLE / NO ADMISIBLE** | Estado de una **obra** tras admisión |
| **ELEGIBLE / NO ELEGIBLE** | Estado competitivo de un **participante** |

---

## 3. Elegibilidad competitiva (Clickatón)

| Parámetro | Valor edición actual | Notas |
|-----------|----------------------|-------|
| Consignas totales | 10 | 1 foto por consigna |
| `minimumCompletedPrompts` | **8** | Configurable por edición |
| Compite | 8, 9 o 10 obras **válidas/admisibles** | |
| No elegible | 7 o menos | Descalificado de **toda** la competencia |

Reglas:

1. Fotografías de quien queda NO ELEGIBLE **se conservan**.
2. **No** pasan al jurado.
3. **No** puede ganar una consigna individual.
4. Si tenía 8 válidas y una pasa a NO ADMISIBLE → queda en 7 → **fuera de toda la competencia**.
5. El corte se **congela** tras cierre de upload, admisión, extensiones vigentes y resolución técnica → se crea el roster del jurado.

---

## 4. Pipeline previo al jurado

```text
upload → validación técnica → admisión → elegibilidad → jurado
```

### 4.1 Semáforo de admisión

| Color | Significado | Acción |
|-------|-------------|--------|
| **GREEN** | Compatible / sin observaciones relevantes | Puede avanzar |
| **YELLOW** | Requiere revisión humana | No auto-rechazar |
| **RED** | Incumplimiento confirmado o técnicamente no admisible | Rechazo confirmado |

**Nunca auto-rechazar por señales débiles.** Separar capas:

| Capa | Significado |
|------|-------------|
| `DETECTED_SIGNAL` | Señal automática (no es veredicto) |
| `MANUAL_REVIEW` | Revisión humana |
| `CONFIRMED_REJECTION` | Rechazo confirmado y auditado |

Catálogo preliminar: ver `technical-admission-policy.md`.

### 4.2 EXIF / metadatos

FotoRank puede leer (entre otros): `DateTimeOriginal`, Make, Model, Lens, orientation, dimensiones, GPS presente/ausente, software de edición, campos técnicos disponibles.

Reglas:

- EXIF **no** prueba autoría.
- EXIF **no** determina culpabilidad automática.
- EXIF ausente → **YELLOW / REVIEW**.
- **Nunca** reescribir EXIF original.

### 4.3 Reloj de cámara desajustado

Soporte conceptual: `POSSIBLE_CAMERA_CLOCK_OFFSET`.

El sistema puede detectar un offset consistente (p. ej. EXIF repetidamente −3 h). UI/ops puede mostrar:

- Hora EXIF original  
- Offset estimado  
- Hora corregida estimada  

Prohibido: modificar archivo, modificar EXIF, auto-aprobar, auto-rechazar. El operador valida; decisión auditada.

### 4.4 Reemplazos de foto

Si el participante reemplazó correctamente antes del deadline, el jurado recibe **solo la versión activa final**.

---

## 5. Criterios y scoring (Clickatón)

Tres criterios (pesos iguales, ~33,33 % conceptual cada uno):

1. Interpretación de la consigna  
2. Creatividad / originalidad  
3. Composición / calidad fotográfica  

| Parámetro | Default Clickatón |
|-----------|-------------------|
| Escala | Enteros **1–10** |
| Evaluaciones por foto | **3** independientes (configurable) |
| Agregación | Promedios normalizados (no sumar puntos brutos) |
| Entrada a ranking | Solo con N evaluaciones completas |

**Rúbrica explicativa:** ver `jury-regulations.md` / manual. No ciencia exacta; reduce variabilidad.

**Motor FotoRank:** debe permitir otros criterios, cantidades, pesos y escalas. **No hardcodear Clickatón en el core de scoring.**

### 5.1 Ranking de jurado y desempate

Orden inicial: promedio general.

Empate para selección de finalistas:

1. mayor Interpretación  
2. mayor Creatividad  
3. mayor Composición  

Si sigue empatado y afecta finalistas: evaluación de desempate por **un jurado adicional que aún no evaluó esa foto**. No reconvocar a todos. Auditado.

---

## 6. Asignación, carga e invitaciones

- FotoRank **distribuye automáticamente**. Organizador **no** asigna manualmente por ahora.
- Objetivos: equilibrar carga, cubrir todas las fotos, N evaluaciones/foto, distribuir por consignas cuando convenga, respetar conflictos, manejar reemplazos.
- Carga recomendada inicial: **500 fotografías evaluadas / jurado** (1 foto + 3 criterios = 1 foto evaluada). Es **recomendación**, no bloqueo.
- Semáforo de carga (umbrales configurables, no definitivos sin análisis): GREEN razonable / YELLOW elevada / RED excesiva.
- Calculador genérico: `docs/fotorank/jury-capacity-calculator-spec.md`.

Estados de jurado (o equivalentes): `INVITED` → `ACCEPTED` | `DECLINED` → `ACTIVE` → `COMPLETED` | `REPLACED`.

Un jurado cuenta como disponible **solo con invitación aceptada**. Si declina → recalcular cobertura.

---

## 7. Flujo de evaluación (ciego)

**Ve:** consigna, fotografía, criterios, sus notas, comentario privado opcional.

**No ve:** nombre, apellido, email, Instagram, identidad, nº identificable, EXIF, GPS, notas de otros, ranking, Me Gusta, datos comerciales.

En otros concursos: título/statement configurables. Autor siempre anónimo mientras la evaluación sea ciega.

Orden de fotos: **aleatorio**, preferentemente distinto por jurado.

### 7.1 UX de calificación (especificación)

- Números/estrellas 1–10 con número visible  
- 3 criterios; navegación rápida  
- Atajos conceptuales (keymap no definitivo si afecta accesibilidad): `1–0` nota, TAB/flechas criterio, NEXT, `P` postergar, `Z` zoom; ayuda visible  

### 7.2 Postergar

«Revisar después» → estado `POSTPONED`. Antes de confirmar: 0 postergadas / 0 pendientes.

### 7.3 Conflicto de interés

Opción **secundaria** (no botón primario): «Tengo conflicto de interés».

Efectos: se quita de su carga, se reasigna, no penaliza, auditado. Motivo opcional/privado. Sin detalles públicos.

### 7.4 Notas y comentario

- Mientras no esté bloqueada: puede cambiar notas; autoguardado.  
- Comentario privado opcional: independiente del scoring; visible a autor, organizador autorizado, Super Admin; **nunca** al participante.

### 7.5 Grilla final y confirmación

Antes de confirmar: grid de toda su evaluación (foto, 3 notas, promedio, estado). Abrir / zoom / slideshow / editar / comentar / ordenar (aleatorio, mayor/menor propio, postergadas).

**CONFIRMAR EVALUACIÓN** solo si: todas completas, 3 criterios/foto, 0 postergadas, 0 pendientes → **LOCKED**. Confirmación por consigna/bloque.

### 7.6 Cierre, reemplazo, reapertura, extensión

| Acción | Regla |
|--------|--------|
| Ventana | `evaluationStartsAt` / `evaluationEndsAt` configurables |
| Al deadline | Completas computan; pendientes se redistribuyen; no invalidar trabajo parcial |
| Reemplazo de jurado | Solo fotos faltantes; evaluaciones completas previas válidas |
| Reapertura excepcional | Motivo + operador + timestamp + estado anterior + auditoría |
| Extensión deadline | Motivo + deadline anterior/nuevo + operador + timestamp |
| Extensión upload participante | Por defecto **global**; individual solo mecanismo excepcional futuro |

### 7.7 Tiempo activo y ETA

Métrica `ACTIVE_EVALUATION_TIME`: señales de actividad (mouse, teclado, scroll, puntuación, navegación, zoom); pausa por inactividad. **No** es evaluación de desempeño humano.

ETA: fotos hechas/restantes, tiempo activo, s/foto, ritmo reciente. No ETA confiable antes de ~20–30 evaluaciones. Jurado y organizador ven progreso + ETA sin cronómetro de vigilancia.

### 7.8 Visibilidad de resultados

- Jurado: **no** ve ranking mientras evalúa ni tras confirmar hasta cierre general.  
- Organizador: puede ver ranking **provisional** con banner *RESULTADO PROVISORIO — EVALUACIÓN INCOMPLETA*. No edita notas.

---

## 8. Finalistas (Clickatón)

- Jurado selecciona **3 FINALISTAS por consigna**.  
- 10 consignas → **30 finalistas**.  
- Una persona puede ser finalista en varias consignas.  
- Jurado **no** define ganadores definitivos.

---

## 9. Votación pública (Clickatón)

Tras el jurado, los 3 finalistas de cada consigna compiten públicamente.

| Parámetro | Default Clickatón |
|-----------|-------------------|
| Unidad | **CONSIGNA** |
| Métrica | Cantidad de **Me Gusta** |
| Duración | Configurable; default **24 horas** |
| Resultado | 1.º, 2.º y 3.º **definitivos** de esa consigna |

### 9.1 Desempate público

Si hay empate al cierre:

- **NO** usar puntaje del jurado.  
- **NO** sumar scores.  
- Crear `PUBLIC_TIEBREAK` (nueva instancia pública).  
- Preferencia Clickatón: votación en Historias / red social.  
- Duración configurable; puede repetirse. El público sigue decidiendo.

### 9.2 Error de red social

Si no se puede verificar el dato al cierre: **no** declarar ganador. Estado `PENDING_PUBLIC_VOTE_VERIFICATION` (o equivalente). Resolver cuando se verifique.

### 9.3 Automatización redes (futuro — no implementar ahora)

Arquitectura conceptual: `SocialAccountConnection`, provider, publication, `votingWindow`, metric snapshot, `openedAt`/`closesAt` exactos, `fetchedAt`/`frozenAt`, audit, provider errors. Conexión por organizador. No asumir capacidades de Instagram sin auditarlas.

---

## 10. Otros concursos FotoRank

La votación pública es **opcional**:

| Modo | Descripción |
|------|-------------|
| `JURY_ONLY` | Solo jurado |
| `JURY_THEN_PUBLIC` | Jurado luego público |

Unidad de votación pública configurable: consigna / categoría / obra / ronda / otra.

---

## 11. Premios

Esta etapa **no** define distribución de premios. Los resultados generan **posiciones**. Premios se configuran por edición posteriormente. **LEGAL REVIEW REQUIRED**.

---

## 12. Documentos satélite

| Documento | Rol |
|-----------|-----|
| `CLICKATON_BASES_DRAFT_v3_jury_public_vote.md` | Borrador Bases (LEGAL REVIEW) |
| `jury-regulations.md` | Reglamento del jurado |
| `jury-user-manual.md` | Manual completo |
| `jury-quick-guide.md` | Guía 1 página |
| `jury-faq.md` | FAQ jurados |
| `jury-organizer-manual.md` | Manual organizador |
| `competition-participant-faq.md` | FAQ participantes |
| `technical-admission-policy.md` | Admisión / EXIF / semáforo |
| `../fotorank/jury-capacity-calculator-spec.md` | Calculador genérico FR |
| `pre-jury-readiness-checklist.md` | Checklist pre-jurado |
| `pre-public-vote-checklist.md` | Checklist pre-voto |
| `blog-como-se-eligen-ganadores.md` | Nota de blog |
| `jury-and-public-vote-communications.md` | Copy emails/mensajes |
| `jury-public-vote-consistency-audit.md` | Auditoría de consistencia |

---

## 13. Fuera de alcance de esta etapa

No crear tablas, APIs, scoring runtime, activación de jurado/resultados, integración Instagram ni envío de emails reales. Solo documentación / copy / especificación.
