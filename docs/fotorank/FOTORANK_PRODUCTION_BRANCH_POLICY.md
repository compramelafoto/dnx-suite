# FotoRank — Política de rama productiva canónica

**Estado:** vigente  
**Última actualización:** 2026-08-06  
**Rama canónica:** `release/fotorank-production`

---

## Advertencia (crítica)

```text
origin/main ≠ FotoRank productivo
```

**No desplegar FotoRank a producción desde `main`.**  
`main` del monorepo **no** contiene la línea completa de Santa Fe (ETAPA 10C) ni el sistema visual público desplegado en `fotorank.com`.

Hasta que se unifique de forma controlada, **todo trabajo y todo deploy productivo de FotoRank** debe partir de:

```text
origin/release/fotorank-production
```

---

## Por qué `main` no representa producción

- `origin/main` avanzó con cambios de otras apps / TypeScript del monorepo sin incorporar el tip productivo de FotoRank (Santa Fe + public design system).
- La producción real se reconstruyó sobre el tip Santa Fe / ETAPA 10C y luego recibió cherry-picks del sistema visual público.
- Desplegar desde `main` **borraría o rompería** Santa Fe, inscripción 10C y/o el shell público.

---

## SHA y deployment productivos (referencia)

| Concepto | Valor |
|----------|--------|
| Rama canónica | `release/fotorank-production` |
| SHA canónico al crear la rama (código en `fotorank.com`) | `808df242` |
| Deployment asociado | `dpl_H9Eo9CkCBXFzmDtLDJGSm4tHzJoj` |
| Proyecto Vercel | `fotorank-dnxsuite` |
| Dominio canónico | `https://fotorank.com` |
| Alias secundario | `https://fotorank.dnxsuite.com` |

**Nota histórica:** un brief de IMPL 04 citó `99af2c1c` / `dpl_2pMRx4hdWGuVhLLdLWHKT82r9go6`. Ese SHA quedó **superado** por hotfixes posteriores (home en dos secciones + ritmo anti-aplastamiento) ya desplegados. La rama canónica se ancló al tip **real** de producción (`808df242`), no al SHA obsoleto del brief.

La rama intermedia de integración visual/release:

```text
release/fotorank-public-design-system-prod-01
```

sigue existiendo como historial; la fuente operativa pasa a ser `release/fotorank-production`.

---

## Qué contiene la línea productiva

### Santa Fe / ETAPA 10C (funcional)

- Concurso **Santa Fe en Foco** (`santa-fe-en-foco`)
- Inscripción pública con reglas publicadas, categorías, Instagram, consentimientos, menores
- Pipeline participante de carga (`upload → confirm → cola`) y wizard 10C
- Lógica de elegibilidad / ventanas / `resolvePublicEntryStatus`

### Sistema visual público (ETAPA 01)

- Tokens `apps/fotorank/app/styles/public-tokens.css` (`.fr-public-*`)
- Componentes `apps/fotorank/app/components/public-ui/`
- Home, landing de concurso y área `/participaciones` migradas al shell público
- Inscripción: shell `PublicShell` + presentación alineada a public-ui (lógica 10C intacta)

---

## Cómo iniciar un nuevo trabajo

```bash
git fetch origin --prune
git worktree add -b feat/<nombre> ../dnx-suite-fotorank-<nombre> origin/release/fotorank-production
cd ../dnx-suite-fotorank-<nombre>
```

Reglas:

1. Base siempre `origin/release/fotorank-production`.
2. No partir de `origin/main` para features de FotoRank productivo.
3. No reutilizar worktrees antiguos de implementación visual salvo auditoría explícita.
4. No force-push a `release/fotorank-production` ni a `main`.

---

## Cómo desplegar

Desde la raíz del monorepo (worktree de la rama a promover), con el proyecto correcto:

```bash
vercel deploy --prod --yes --scope compramelafotos-projects
```

Verificar antes:

- directorio = monorepo FotoRank (no otra app);
- link al proyecto `fotorank-dnxsuite`;
- SHA a desplegar = tip auditado de `release/fotorank-production` (o PR mergeado ahí).

No cambiar alias, variables, dominio, DB ni buckets en un deploy rutinario.

---

## Rollback

1. Identificar el deployment previo Ready (Inspector Vercel / `vercel ls`).
2. Re-aliasar producción al deployment anterior (ejemplo conceptual):

```bash
vercel alias set <deployment-url-anterior> fotorank.com --scope compramelafotos-projects
vercel alias set <deployment-url-anterior> fotorank.dnxsuite.com --scope compramelafotos-projects
```

3. Confirmar HTTP 200 en home, landing Santa Fe e inscripción.
4. Conservar logs y marcar la implementación como `ROLLED BACK`.

**Rollback de referencia (pre–IMPL 04 tip):**  
`dpl_H9Eo9CkCBXFzmDtLDJGSm4tHzJoj` (SHA `808df242`).  
Rollback más antiguo documentado en IMPL 03: `dpl_2ZErbfBwZ2jQpLX8UdW6bkQxMcuP` (solo si se necesita volver a pre–public-DS).

---

## Condiciones para volver a unificar con `main`

Solo cuando se cumplan **todas**:

1. Auditoría de diff `main...release/fotorank-production` sin pérdida de Santa Fe / 10C / public-ui.
2. Plan de merge (no force) acordado con owners del monorepo.
3. CI verde en la integración.
4. Smoke productivo post-merge (home, Santa Fe, inscripción, participaciones).
5. Rollback preparado.

Hasta entonces: **`release/fotorank-production` es la fuente de verdad de FotoRank en producción.**
