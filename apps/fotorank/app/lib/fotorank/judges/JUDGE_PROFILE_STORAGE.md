# Perfil de jurado: avatar, storage y bio

## Avatar — capa de almacenamiento

- **Interfaz:** `JudgeAvatarStorageAdapter` en `judgeAvatarStorage.ts`
  - `save(buffer, ext)` → `{ publicUrl }` (valor que se guarda en `FotorankJudgeProfile.avatarUrl`)
  - `deleteIfManagedPublicUrl(publicUrl)` → borra solo si la URL coincide con el patrón de objetos gestionados por ese adapter (no toca URLs externas).

- **Implementación actual:** `createLocalFilesystemJudgeAvatarStorage()` escribe en `public/uploads/judges/{32hex}.{jpg|png|webp}`.
- **Singleton:** `getJudgeAvatarStorage()` (hoy siempre local). Para tests se puede usar `setJudgeAvatarStorageForTests(adapter)`.

### Migrar a R2 / S3 / Vercel Blob

1. Implementar un adapter que cumpla `JudgeAvatarStorageAdapter`.
2. En `save`, subir bytes al bucket y devolver `publicUrl` absoluta (CDN) o path firmado según política.
3. En `deleteIfManagedPublicUrl`, parsear la URL o clave almacenada y llamar al API de borrado del proveedor (solo si la URL pertenece a vuestro bucket; **nunca** borrar URLs arbitrarias).
4. Cambiar `getJudgeAvatarStorage()` para devolver el adapter cloud según `process.env` (p. ej. `JUDGE_AVATAR_STORAGE_PROVIDER=r2`).

`uploadJudgeAvatarImage` (server action) y el borrado post-update usan solo el adapter, no paths fijos.

## Borrado del avatar anterior

En `updateJudgeProfileByAdmin` ( `judges.ts` ), tras persistir el perfil:

- Se compara `previousAvatarUrl` con el nuevo `avatarRef`.
- Solo si el anterior es **gestionado** (`isManagedJudgeAvatarPublicUrl`) y distinto del nuevo, se llama a `deleteIfManagedPublicUrl`.
- URLs externas (`https://...`) **no** se borran del disco.

Patrón de archivo local válido: helper `managedJudgeAvatarFilenameFromPublicUrl` en `judgeAvatar.ts` (misma regla que `normalizeStoredJudgeAvatarRef`).

## Bio enriquecida — renderer y preview

- Esquema JSON: `judgeBioRich.ts` (sin cambios de contrato).
- **Render seguro:** `JudgeBioRenderer` (`components/judges/JudgeBioRenderer.tsx`) mapea bloques a elementos React (sin `dangerouslySetInnerHTML`).
- **Variantes:**
  - `variant="public"` (default): tipografías y márgenes para la ficha pública.
  - `variant="preview"`: misma lógica, escala compacta para el formulario admin.
- El editor (`JudgeBioEditor`) incrusta `JudgeBioRenderer` con `variant="preview"` para alinear preview y público.

## Notas

- Si falla el guardado en BD después de un `save` local, puede quedar un archivo huérfano en disco; un job de limpieza opcional puede enumerar archivos sin referencia en BD.
- Configurar `NEXT_PUBLIC_APP_URL` / URLs absolutas no afecta al path relativo `/uploads/judges/...` salvo que en cloud el adapter devuelva URLs absolutas distintas.
