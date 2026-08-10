# Manual del organizador — Jurado y votación pública (Clickatón)

**Etapa:** 15B  
**Fuente:** `jury-and-public-voting-master-rules.md`  
**No activa** jurado ni voto público por sí solo.

---

## 1. Calculador de jurados

Usá el calculador FotoRank (spec: `docs/fotorank/jury-capacity-calculator-spec.md`) **antes** de abrir inscripciones y otra vez con datos reales.

Outputs clave: fotos estimadas/elegibles, evaluaciones totales, jurados mínimos recomendados, confirmados, déficit, carga media, semáforo.  
**No bloquea** publicación: es recomendación.

Carga objetivo inicial sugerida: **500** fotos evaluadas / jurado.

---

## 2. Convocar y aceptación

1. Invitá jurados.  
2. Solo cuentan como disponibles los **ACEPTADOS**.  
3. Si alguien DECLINA → recalcular cobertura.  
4. No asignes fotos manualmente por ahora: FotoRank distribuye.

Estados: INVITED / ACCEPTED / DECLINED / ACTIVE / COMPLETED / REPLACED.

---

## 3. Admisión y elegibilidad (antes de abrir jurado)

Pipeline: upload → validación técnica → admisión → elegibilidad → jurado.

Checklist: `pre-jury-readiness-checklist.md`.

Regla Clickatón: mínimo **8** obras ADMISIBLES. Quien queda en 7 o menos: NO ELEGIBLE (fuera de toda la competencia; obras conservadas; no van a jurado).

Congelá elegibilidad tras cierre + admisiones + extensiones vigentes.

---

## 4. Abrir jurado

Configurá:

- rúbrica (3 criterios Clickatón, 1–10, pesos iguales);  
- N evaluaciones por foto (default 3);  
- `evaluationStartsAt` / `evaluationEndsAt`;  
- anonimización;  
- notificaciones.

No abras hasta checklist verde.

---

## 5. Monitorear

Podés ver:

- jurados aceptados / asignados;  
- progreso, completadas, pendientes, postergadas;  
- conflictos;  
- ETA;  
- cobertura;  
- ranking **provisional** con banner:  
  **RESULTADO PROVISORIO — EVALUACIÓN INCOMPLETA**

No edites notas de jurados.

Alertas útiles: cobertura insuficiente, jurado inactivo, conflicto sin reasignar, deadline cercano, déficit de evaluaciones.

---

## 6. Reemplazar jurado

Si abandona: el reemplazo toma **solo faltantes**. Evaluaciones completas previas siguen válidas.

---

## 7. Extender deadline

Podés extender `evaluationEndsAt` (y, ante incidente técnico, la ventana de upload de participantes de forma **global**).

Registro obligatorio: motivo, horario anterior, horario nuevo, operador, timestamp. Sin ediciones silenciosas.

---

## 8. Cerrar jurado y finalistas

Al cierre:

- evaluaciones completas computan;  
- pendientes se redistribuyen según política;  
- se resuelven desempates de finalistas si aplica;  
- se materializan **3 FINALISTAS por consigna** (30 en total).

Finalista ≠ ganador definitivo.

---

## 9. Preparar votación pública

Checklist: `pre-public-vote-checklist.md`.

Configurá unidad (consigna), métrica (Me Gusta), ventana (default 24 h), reglas de empate público, canal de publicación y verificación.

Si al cierre no se verifica la métrica: `PENDING_PUBLIC_VOTE_VERIFICATION` — no declarar ganador.

---

## 10. Otros concursos FotoRank

Podés elegir `JURY_ONLY` o `JURY_THEN_PUBLIC`. No asumas el modelo Clickatón en todos los concursos.
