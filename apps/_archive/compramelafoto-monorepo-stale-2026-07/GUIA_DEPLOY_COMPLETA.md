# Guía Completa: Git → Deploy en Vercel

## Comandos para bump de versión

```bash
git add package.json package-lock.json
git commit -m "Bump version to 0.1.1"
git push origin main
```

## Checklist Pre-Deploy

- [ ] Verificar que `npm run build` funciona localmente
- [ ] Revisar cambios con `git diff`
- [ ] Hacer commit con mensaje descriptivo
- [ ] Push a `main`
- [ ] Verificar que Vercel inicie deploy automático
- [ ] Configurar `R2_PUBLIC_URL` en Vercel (si no está configurada)
- [ ] Verificar deploy completado en Vercel
- [ ] Probar funcionalidad en producción

## Si el Deploy Falla

1. **Revisar logs en Vercel**:
   - Ve a Deployments → Click en el deploy fallido → Ver logs

2. **Errores comunes**:
   - Build errors: Revisar `npm run build` localmente
   - Environment variables: Verificar que todas estén configuradas
   - TypeScript errors: Corregir antes de hacer push

3. **Redeploy**:
   - Si corriges errores, haz otro commit y push
   - O haz "Redeploy" desde Vercel (solo si no hay cambios de código)

## Comandos Rápidos (Todo en Uno)

```bash
# 1. Ver estado
git status

# 2. Agregar cambios
git add -A

# 3. Commit
git commit -m "Feat: Re-habilitar marca de agua PNG 35% en grid 3x3 y mejorar normalización de URLs R2"

# 4. Push
git push origin main

# 5. Verificar en Vercel Dashboard que el deploy se inició
```

## Nota Importante

**NO hagas commit de**:
- `.env.local` (archivos de entorno local)
- `node_modules/` (dependencias)
- Archivos temporales o de build

Estos deberían estar en `.gitignore` y no aparecerán en `git status`.
