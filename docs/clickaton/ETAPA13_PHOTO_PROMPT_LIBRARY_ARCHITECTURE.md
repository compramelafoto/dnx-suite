# ETAPA 13 — Biblioteca central de consignas DNX

## Decisión arquitectónica (auditoría previa)

### Reutilizar

| Pieza | Rol |
|---|---|
| `ClickatonPrompt` | Instancia por edición (sequence, secreto, upload) |
| `ClickatonEditionUploadConfig` | SoT temporal ETAPA 12 (reveal / capture / upload) |
| `externalPromptId` → `ClickatonPrompt.id` | Soft-ref FotoRank Entry / jurado / resultados |
| `toPromptPublicDto` | Secreto pre-reveal |
| `getPreEventReadyChecklist` | Extender ítems biblioteca |
| Test Mode `isOpsTest` | DRAFT solo en fixture |
| Super Admin hub + `recordPlatformAudit` | Gate + audit platform |

### Crear (una sola biblioteca global)

| Modelo | Rol |
|---|---|
| `PhotoPromptTheme` / `PhotoPromptSubtheme` | Catálogo administrable |
| `PhotoPromptLibraryItem` | Plantilla reutilizable (workflow) |
| `PhotoPromptLibraryVersion` | Historial de versiones |
| `PhotoPromptLibraryAuditEvent` | Auditoría append-only |

### No crear

- Biblioteca paralela en Clickatón y otra en FotoRank
- Producto visible “MARATHON”
- Mezclar APPROVED con “publicado al participante”
- Cambiar `externalPromptId` a library id

### Cadena

```
PhotoPromptLibraryItem (global, workflow)
        ↓ assign + snapshot
ClickatonPrompt (instancia edición)
        ↓ upload
FotorankContestEntry.externalPromptId = ClickatonPrompt.id
```

### Source of truth

- **Contenido editorial reutilizable:** `packages/db` → modelos `PhotoPrompt*`
- **Dominio compartido:** `packages/photo-prompt-library`
- **Admin UI SoT:** FotoRank Super Admin `/super-admin/consignas`
- **Consumo:** Clickatón admin edición → asignar APPROVED + snapshot
- **Temporal (reveal/capture/upload):** sigue en `ClickatonEditionUploadConfig` (ETAPA 12)

### Reglas críticas

1. APPROVED ≠ publicado al participante.
2. Snapshot inmutable tras asignación.
3. Solo APPROVED en edición comercial; DRAFT solo Test Mode (`isOpsTest`).
4. Migración aditiva; no tocar datos comerciales.
