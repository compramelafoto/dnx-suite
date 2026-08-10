# Especificación — Calculador de jurados FotoRank

**Etapa:** Clickatón 15B (spec genérica FotoRank)  
**Estado:** DOCUMENTAL / FUNCIONAL  
**No implementa** UI ni motor en esta etapa.

---

## 1. Propósito

Ayudar a organizadores a dimensionar el jurado **antes** de abrir inscripciones y a **recalcular** con datos reales.  
**No bloqueante:** nunca impide publicar un concurso.

Default de carga recomendada: **500 fotografías evaluadas por jurado** (configurable).  
1 foto + sus criterios = **1 foto evaluada** (no N trabajos por criterio).

---

## 2. Alcance por tipo de concurso

| Tipo | Factores típicos |
|------|------------------|
| Clásica (1 obra / categoría) | participantes × categorías × obras |
| Múltiple obra | max obras × participantes |
| Clickatón / maratón | consignas × participantes × mínimo competitivo × tasa de entrega |
| Por prompts | prompts activos × entregas |
| Mixto | combinación configurable |

---

## 3. Inputs

| Input | Uso |
|-------|-----|
| Participantes estimados | Pre-apertura |
| Participantes reales | Recálculo |
| Cantidad máxima de fotos | Capacidad teórica |
| Consignas / prompts | Clickatón y similares |
| Mínimo competitivo | p. ej. 8/10 |
| Promedio estimado de entregas | Tasa de completitud |
| Evaluaciones requeridas por foto (`N`) | Default Clickatón: 3 |
| Carga objetivo por jurado | Default 500 |
| Jurados invitados | Pipeline |
| Jurados aceptados | Disponibles reales |
| Categorías | Concursos clásicos |
| Factores futuros | Extensible |

---

## 4. Outputs

| Output | Descripción |
|--------|-------------|
| Fotos estimadas | Universo bruto |
| Fotos elegibles estimadas | Tras mínimo competitivo / filtros |
| Evaluaciones totales | elegibles × N |
| Jurados mínimos recomendados | ceil(evaluaciones / carga_objetivo) |
| Jurados confirmados | Aceptados |
| Déficit | recomendados − confirmados |
| Carga media | evaluaciones / confirmados |
| Semáforo | GREEN / YELLOW / RED |

### Semáforo (umbrales configurables; no definitivos)

| Color | Idea |
|-------|------|
| GREEN | Carga razonable vs objetivo |
| YELLOW | Carga elevada; monitorear |
| RED | Carga excesiva; conviene convocar más |

Los umbrales exactos quedan configurables tras análisis; no fijar hardcode rígido en esta spec.

---

## 5. Fórmulas conceptuales (Clickatón ejemplo)

```text
entregas_estimadas ≈ participantes × consignas × tasa_entrega
elegibles_estimadas ≈ participantes_elegibles × obras_válidas_promedio
                     (o filtro por minimumCompletedPrompts)
evaluaciones_totales = fotos_elegibles × N
jurados_recomendados = ceil(evaluaciones_totales / carga_objetivo)
deficit = max(0, jurados_recomendados − jurados_aceptados)
carga_media = evaluaciones_totales / max(1, jurados_aceptados)
```

Variantes clásicas reemplazan consignas por categorías/obras.

---

## 6. Momentos de uso

1. **Pre-inscripción:** con estimados → recomendación de convocatoria.  
2. **Pre-jurado:** con datos reales + admisión + elegibilidad → cobertura.  
3. **Durante evaluación:** recálculo si hay declines/reemplazos.

---

## 7. UX mínima

- Mostrar supuestos editables.  
- Mostrar semáforo + déficit.  
- Copy: «Recomendación — no bloquea la publicación».  
- Link a manual organizador.

---

## 8. Fuera de alcance (esta etapa)

UI, persistencia, notificaciones automáticas, integración Instagram.
