# FotoRank Preview — descubrimiento de `ep-empty-moon`

**Fecha:** 2026-07-29  
**Etapa:** 10B.6.3  

## Veredicto de descubrimiento

```text
FOTORANK SOURCE DOMAIN EMPTY — NO IMPORT REQUIRED
```

Clasificación de la DB histórica `ep-empty-moon-ad4teeyd…`:

```text
IDENTITY_ONLY_OR_DISPOSABLE
```

(no almacén de dominio FotoRank con concursos; evidencia apunta a sandbox Preview de ComprameLaFoto monorepo con credenciales rotas).

---

## Endpoint buscado

| Campo | Valor |
| ----- | ----- |
| Host (docs históricos) | `ep-empty-moon-ad4teeyd` / `-pooler` |
| Región implícita | `c-2.us-east-1` (mismo prefijo de endpoint que proyecto `divine-hall` / ComprameLaFoto) |
| Database (docs) | `neondb` |

---

## Fuentes agotadas

| Fuente | Resultado |
| ------ | --------- |
| Neon API org `org-bold-morning-27184918` (Dnx) | **0** endpoints con `empty`/`moon` en 6 proyectos |
| Neon orgs visibles para `dnxfotografia@gmail.com` | Solo org Dnx |
| Branches `divine-hall` / `dnx-suite-staging` / `compramelafoto-staging` | Sin branch/endpoint empty-moon |
| Vercel team (8 proyectos) — decrypt hosts | **Ningún** `DATABASE_URL` actual apunta a empty-moon |
| `compramelafoto-dnxsuite` Preview | Hoy `ep-round-fog…` |
| `fotorank-dnxsuite` Production | `ep-dawn-dew…` (**no tocada**) |
| `fotorank-dnxsuite` Preview branch override | Re-seteado 10B.6.3 → `ep-round-fog…` |
| Repo / docs / scripts | empty-moon documentado como **Preview CLF** con auth fail (`28P01`), no como DB de concursos FotoRank |
| `.env*` locales | Sin connection string usable a empty-moon |
| Agent transcripts / informes 10B.6 | Atribución previa a FotoRank **heredada** del diagnóstico CLF; no hay inventario de contests en empty-moon |

Documento clave: `services/dnx-mcp/docs/operations/compramelafoto-preview-functional-errors-diagnostic.md` (empty-moon = CLF Preview, password auth failed).

---

## ¿Sigue vivo?

**No visible** en la organización Neon actual. Probable endpoint/branch eliminado o cuenta distinta no autorizada. No hay connection URI recuperable vía API.

---

## Evidencia de dominio FotoRank

| Evidencia | Hallazgo |
| --------- | -------- |
| Contests en `ep-round-fog` (identidad Staging) | **0** |
| Seeds / fixtures FotoRank con counts Staging | No documentan datos en empty-moon |
| Preview deployments FotoRank recientes | Serie **ERROR** (build), sin smoke de dominio vivo |
| Production FotoRank | `dawn-dew` — fuera de alcance; no migrar desde ahí |

No se asume vacía “por inaccesible”; se clasifica por **atribución histórica a CLF + ausencia total de inventario de contests/entries/judges** ligado a ese host.

---

## Acción requerida al usuario

Ninguna por ahora (descubrimiento agotado).  
Si más adelante aparece evidencia de contests reales en otra org Neon, estado alternativo:

`FOTORANK SOURCE DB REQUIRES MANUAL ACCESS`

---

## Destino Staging (identidad + dominio)

```text
DNX_STAGING_IDENTITY_DATABASE = ep-round-fog-a4xgibtv… / neondb
```

Backup adicional 10B.6.3: branch Neon `backup-before-fotorank-import` (`br-rough-base-a482gvuw`, endpoint `ep-misty-lake-a4hzpxra…`).

---

## Cierre 10B.6.3

FotoRank Staging apunta a round-fog; health confirma host compartido.  
No se solicitó credencial manual al usuario (descubrimiento agotado en org Dnx).  
Informe de cutover/dominio: `FOTORANK_STAGING_DOMAIN_CUTOVER_REPORT.md`.
