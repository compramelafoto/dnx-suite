# 19 — Reporte Dominio: Cuánto Cobro

**Fecha:** 2026-07-04  
**Archivo modificado:** `packages/db/prisma/schema.prisma`  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto/prisma/schema.prisma`  
**Guía:** [`18-prisma-gap-after-video.md`](./18-prisma-gap-after-video.md)

**Restricciones respetadas:**

- ✅ Solo `packages/db/prisma/schema.prisma`
- ✅ `npx prisma validate` + `npx prisma format --check`
- ❌ Sin migraciones, `generate`, `migrate`, `db push`, `db pull`
- ❌ Sin cambios en `apps/*`
- ❌ Sin commit

---

## Veredicto

| Comando | Resultado |
|---------|-----------|
| `npx prisma validate` | ✅ **Schema válido** |
| `npx prisma format --check` | ✅ **Formateado** (tras `prisma format` automático) |

---

## Resumen cuantitativo

| Métrica | Post Video | Post Cuánto Cobro | Δ |
|---------|----------:|------------------:|--:|
| Modelos | 221 | **230** | **+9** |
| Enums | 158 | **164** | **+6** |
| Líneas (git diff) | — | — | **+289** |

---

## 1. Modelos agregados (9)

Bloque `// BEGIN LEGACY MERGE — dominio 11 cuánto cobro (modelos)`:

| Modelo | Propósito |
|--------|-----------|
| `CuantoCobroFinancialProfile` | Perfil financiero wizard (1:1 `User`) |
| `CuantoCobroConsultaSequence` | Secuencia anual números de consulta |
| `CuantoCobroConsulta` | Consulta comercial (embudo CC) |
| `CuantoCobroConsultaActivity` | Timeline de actividades |
| `CuantoCobroConsultaNote` | Notas internas |
| `CuantoCobroConsultaFile` | Adjuntos (fase posterior) |
| `CuantoCobroQuoteSequence` | Secuencia anual números de presupuesto |
| `CuantoCobroQuote` | Cabecera de presupuesto |
| `CuantoCobroQuoteVersion` | Versión inmutable de presupuesto |

---

## 2. Modelos modificados (1)

| Modelo | Cambios |
|--------|---------|
| **`User`** | +3 campos escalares, +4 relaciones |

---

## 3. Enums agregados (6)

Bloque `// BEGIN LEGACY MERGE — dominio 11 cuánto cobro (enums)`:

| Enum | Valores |
|------|---------|
| `CuantoCobroConsultaPipelineStage` | `NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL_SENT`, `NEGOTIATION`, `WON`, `LOST` |
| `CuantoCobroConsultaStatus` | `OPEN`, `WON`, `LOST`, `ARCHIVED` |
| `CuantoCobroConsultaSourceChannel` | `MANUAL`, `REFERRAL`, `CLF`, `WEBSITE_FORM`, `META_ADS`, `WHATSAPP`, `INSTAGRAM`, `OTHER` |
| `CuantoCobroConsultaPriority` | `LOW`, `NORMAL`, `HIGH` |
| `CuantoCobroConsultaActivityKind` | 12 valores (consulta, stage, quote, etc.) |
| `CuantoCobroQuoteStatus` | `DRAFT`, `SENT`, `VIEWED`, `ACCEPTED`, `REJECTED` |

**Enums modificados:** ninguno.

---

## 4. Relaciones agregadas en `User`

| Relación | Destino |
|----------|---------|
| `cuantoCobroFinancialProfile` | `CuantoCobroFinancialProfile?` |
| `cuantoCobroConsultas` | `CuantoCobroConsulta[]` |
| `cuantoCobroQuotes` | `CuantoCobroQuote[]` |
| `cuantoCobroQuoteVersionsCreated` | `CuantoCobroQuoteVersion[]` |

---

## 5. Campos `User` agregados

| Campo | Tipo |
|-------|------|
| `cuantoCobroUser` | `Boolean @default(false)` |
| `cuantoCobroFirstSeenAt` | `DateTime?` |
| `cuantoCobroLastSeenAt` | `DateTime?` |

---

## 6. Conflictos encontrados

| ID | Conflicto | Resolución |
|----|-----------|------------|
| — | Ninguno | Merge directo desde legacy |

---

## 7. Suite intacta

- **FotoOffice** / **FotoRank** — sin modelos tocados; solo relaciones/campos compartidos en `User`.

---

## 8. Pendientes post-dominio 11

| # | Pendiente | Dominio |
|---|-----------|---------|
| P1 | Blog / marketing / leads (15 modelos, 5 enums) | 12 |
| P2 | `User` payout/flags + `Template.@@index([version])` | 16 |
| P3 | Migración forward SQL | Fase SQL |

---

## Diff resumido

```
packages/db/prisma/schema.prisma | +289
```
